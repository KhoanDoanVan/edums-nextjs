"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  shouldHideFeedbackMessage,
  useToastFeedback,
} from "@/hooks/use-toast-feedback";
import {
  createAccount,
  getDynamicListByPath,
  getAccountById,
  getAccounts,
  getRoles,
  resetAccountPassword,
  updateAccount,
  updateAccountStatus,
} from "@/lib/admin/service";
import { TablePaginationControls } from "@/components/admin/table-pagination-controls";
import { formatDateTime, toErrorMessage } from "@/components/admin/format-utils";
import { useTablePagination } from "@/hooks/use-table-pagination";
import type {
  AccountListItem,
  AccountStatus,
  DynamicRow,
  PagedRows,
  RoleListItem,
} from "@/lib/admin/types";

interface AccountManagementPanelProps {
  authorization?: string;
}

type AccountModalMode = "create" | "edit";
type FilterRoleValue = "ALL" | `${number}`;
type FilterStatusValue = "ALL" | AccountStatus;

interface AccountFormState {
  id: number | null;
  username: string;
  password: string;
  confirmPassword: string;
  roleId: string;
  linkedStudentId: string;
  avatarUrl: string;
  desiredStatus: AccountStatus;
}

interface ResetPasswordFormState {
  newPassword: string;
  confirmPassword: string;
}

const accountStatusOptions: AccountStatus[] = ["ACTIVE", "INACTIVE", "LOCKED"];

const isAccountStatus = (value: unknown): value is AccountStatus => {
  return (
    value === "ACTIVE" || value === "INACTIVE" || value === "LOCKED"
  );
};

const emptyAccounts: PagedRows<AccountListItem> = { rows: [] };

const buildStatusDraftMap = (
  rows: AccountListItem[],
): Record<number, AccountStatus> => {
  const draftMap: Record<number, AccountStatus> = {};

  for (const row of rows) {
    if (isAccountStatus(row.status)) {
      draftMap[row.id] = row.status;
    }
  }

  return draftMap;
};

const parseRoleId = (value: string): number | null => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
};

interface StudentLookupItem {
  id: number;
  studentCode: string;
  fullName: string;
  guardianId: number | null;
}

const toTrimmedString = (value: unknown): string => {
  return typeof value === "string" ? value.trim() : "";
};

const toPositiveIntegerOrNull = (value: unknown): number | null => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
};

const toStudentLookupItems = (rows: DynamicRow[]): StudentLookupItem[] => {
  return rows
    .map((row) => {
      const id = toPositiveIntegerOrNull(row.id);
      if (!id) {
        return null;
      }

      const studentCode = toTrimmedString(row.studentCode);
      const fullName = toTrimmedString(row.fullName);
      const guardianId = toPositiveIntegerOrNull(row.guardianId);

      return {
        id,
        studentCode,
        fullName,
        guardianId,
      } satisfies StudentLookupItem;
    })
    .filter((item): item is StudentLookupItem => item !== null);
};

const normalizeRoleName = (roleName: string): string => {
  return roleName
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/^ROLE_/, "")
    .replace(/[\s_-]+/g, "");
};

const isGuardianLikeRole = (roleName: string): boolean => {
  const normalized = normalizeRoleName(roleName);
  return normalized === "GUARDIAN" || normalized === "PARENT" || normalized === "PHUHUYNH";
};

const getAccountStatusClass = (status: AccountStatus): string => {
  switch (status) {
    case "ACTIVE":
      return "bg-[#edf9f1] text-[#23724b]";
    case "INACTIVE":
      return "bg-[#fff8e8] text-[#9a6a00]";
    case "LOCKED":
      return "bg-[#fff1f1] text-[#b54444]";
    default:
      return "bg-[#eef4f8] text-[#4a687d]";
  }
};

export const AccountManagementPanel = ({
  authorization,
}: AccountManagementPanelProps) => {
  const [accounts, setAccounts] = useState<PagedRows<AccountListItem>>(emptyAccounts);
  const [roles, setRoles] = useState<RoleListItem[]>([]);
  const [statusDraftByAccountId, setStatusDraftByAccountId] = useState<
    Record<number, AccountStatus>
  >({});
  const [studentLookupItems, setStudentLookupItems] = useState<StudentLookupItem[]>(
    [],
  );
  const [isStudentLookupLoading, setIsStudentLookupLoading] = useState(false);

  const [keywordFilter, setKeywordFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState<FilterRoleValue>("ALL");
  const [statusFilter, setStatusFilter] = useState<FilterStatusValue>("ALL");

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useToastFeedback({
    errorMessage,
    successMessage,
    errorTitle: "Thao tác tài khoản thất bại",
    successTitle: "Thao tác tài khoản thành công",
  });

  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [accountModalMode, setAccountModalMode] =
    useState<AccountModalMode>("create");
  const [accountForm, setAccountForm] = useState<AccountFormState>({
    id: null,
    username: "",
    password: "",
    confirmPassword: "",
    roleId: "",
    linkedStudentId: "",
    avatarUrl: "",
    desiredStatus: "ACTIVE",
  });

  const [resetTargetAccount, setResetTargetAccount] =
    useState<AccountListItem | null>(null);
  const [resetPasswordForm, setResetPasswordForm] = useState<ResetPasswordFormState>(
    {
      newPassword: "",
      confirmPassword: "",
    },
  );

  const resolveAccountFilters = useCallback(() => {
    const trimmedKeyword = keywordFilter.trim();
    const roleId = roleFilter === "ALL" ? undefined : Number(roleFilter);
    const status = statusFilter === "ALL" ? undefined : statusFilter;

    return {
      keyword: trimmedKeyword || undefined,
      roleId,
      status,
      page: 0,
      size: 20,
      sortBy: "createdAt",
    };
  }, [keywordFilter, roleFilter, statusFilter]);

  const runAction = useCallback(async (action: () => Promise<void>) => {
    try {
      setIsLoading(true);
      setErrorMessage("");
      setSuccessMessage("");
      await action();
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadInitialData = useCallback(async () => {
    if (!authorization) {
      setErrorMessage("Không tìm thấy phiên đăng nhập. Vui lòng đăng nhập lại.");
      return;
    }

    await runAction(async () => {
      const [roleRows, accountRows] = await Promise.all([
        getRoles(authorization),
        getAccounts(authorization, {
          page: 0,
          size: 20,
          sortBy: "createdAt",
        }),
      ]);

      setRoles(roleRows);
      setAccounts(accountRows);
      setStatusDraftByAccountId(buildStatusDraftMap(accountRows.rows));
      setSuccessMessage(`Đã tải ${accountRows.rows.length} tài khoản.`);
    });
  }, [authorization, runAction]);

  useEffect(() => {
    void loadInitialData();
  }, [loadInitialData]);

  const loadRolesAndAccounts = useCallback(async () => {
    if (!authorization) {
      setErrorMessage("Không tìm thấy phiên đăng nhập. Vui lòng đăng nhập lại.");
      return;
    }

    await runAction(async () => {
      const [roleRows, accountRows] = await Promise.all([
        getRoles(authorization),
        getAccounts(authorization, resolveAccountFilters()),
      ]);

      setRoles(roleRows);
      setAccounts(accountRows);
      setStatusDraftByAccountId(buildStatusDraftMap(accountRows.rows));
      setSuccessMessage(`Đã tải ${accountRows.rows.length} tài khoản.`);
    });
  }, [authorization, resolveAccountFilters, runAction]);

  const roleOptions = useMemo(() => {
    return roles.map((role) => ({
      id: role.id,
      name: role.roleName || `Vai trò ${role.id}`,
    }));
  }, [roles]);

  const accountPagination = useTablePagination(accounts.rows);

  const guardianRoleIds = useMemo(() => {
    return new Set(
      roles
        .filter((role) => isGuardianLikeRole(role.roleName || ""))
        .map((role) => role.id),
    );
  }, [roles]);

  const selectedRoleId = parseRoleId(accountForm.roleId);
  const isGuardianRoleSelected =
    selectedRoleId !== null && guardianRoleIds.has(selectedRoleId);

  const selectedLinkedStudent = useMemo(() => {
    const studentId = parseRoleId(accountForm.linkedStudentId);
    if (!studentId) {
      return null;
    }

    return studentLookupItems.find((item) => item.id === studentId) || null;
  }, [accountForm.linkedStudentId, studentLookupItems]);

  const loadStudentLookup = useCallback(async () => {
    if (!authorization) {
      return;
    }

    setIsStudentLookupLoading(true);
    try {
      const data = await getDynamicListByPath(
        "/api/v1/students",
        authorization,
        {
          page: 0,
          size: 200,
          sortBy: "studentCode",
        },
      );
      setStudentLookupItems(toStudentLookupItems(data.rows));
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    } finally {
      setIsStudentLookupLoading(false);
    }
  }, [authorization]);

  const openCreateModal = () => {
    setErrorMessage("");
    setAccountModalMode("create");
    setAccountForm({
      id: null,
      username: "",
      password: "",
      confirmPassword: "",
      roleId: roleOptions[0] ? String(roleOptions[0].id) : "",
      linkedStudentId: "",
      avatarUrl: "",
      desiredStatus: "ACTIVE",
    });
    setIsAccountModalOpen(true);

    void loadStudentLookup();
  };

  const openEditModal = async (accountId: number) => {
    if (!authorization) {
      setErrorMessage("Không tìm thấy phiên đăng nhập. Vui lòng đăng nhập lại.");
      return;
    }

    await runAction(async () => {
      const account = await getAccountById(accountId, authorization);
      setAccountModalMode("edit");
      setAccountForm({
        id: account.id,
        username: account.username || "",
        password: "",
        confirmPassword: "",
        roleId: account.roleId ? String(account.roleId) : "",
        linkedStudentId: "",
        avatarUrl: account.avatarUrl || "",
        desiredStatus: isAccountStatus(account.status) ? account.status : "ACTIVE",
      });
      setIsAccountModalOpen(true);
    });
  };

  const closeAccountModal = () => {
    if (isLoading) {
      return;
    }

    setIsAccountModalOpen(false);
  };

  const handleSubmitFilters = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await loadRolesAndAccounts();
  };

  const handleClearFilters = async () => {
    setKeywordFilter("");
    setRoleFilter("ALL");
    setStatusFilter("ALL");

    if (!authorization) {
      return;
    }

    await runAction(async () => {
      const rows = await getAccounts(authorization, {
        page: 0,
        size: 20,
        sortBy: "createdAt",
      });

      setAccounts(rows);
      setStatusDraftByAccountId(buildStatusDraftMap(rows.rows));
      setSuccessMessage(`Đã tải ${rows.rows.length} tài khoản.`);
    });
  };

  const handleSubmitAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");

    if (!authorization) {
      setErrorMessage("Không tìm thấy phiên đăng nhập. Vui lòng đăng nhập lại.");
      return;
    }

    const username = accountForm.username.trim();
    const roleId = parseRoleId(accountForm.roleId);
    const avatarUrl = accountForm.avatarUrl.trim();
    const linkedStudentId = parseRoleId(accountForm.linkedStudentId);

    if (!username || !roleId) {
      setErrorMessage("Vui lòng nhập username và vai trò hợp lệ.");
      return;
    }

    if (accountModalMode === "create" && guardianRoleIds.has(roleId)) {
      if (!linkedStudentId) {
        setErrorMessage("Tài khoản phụ huynh bắt buộc phải gắn với một sinh viên.");
        return;
      }

      const linkedStudent =
        studentLookupItems.find((item) => item.id === linkedStudentId) || null;

      if (!linkedStudent) {
        setErrorMessage("Không tìm thấy sinh viên đã chọn. Vui lòng tải lại danh sách.");
        return;
      }

      if (!linkedStudent.guardianId) {
        setErrorMessage(
          "Sinh viên đã chọn chưa có hồ sơ phụ huynh. Vui lòng cập nhật guardianId ở tab Quản lý sinh viên trước khi tạo tài khoản phụ huynh.",
        );
        return;
      }
    }

    if (accountModalMode === "create") {
      if (!accountForm.password || !accountForm.confirmPassword) {
        setErrorMessage("Vui lòng nhập mật khẩu và xác nhận mật khẩu.");
        return;
      }

      if (accountForm.password.length < 6) {
        setErrorMessage("Mật khẩu tối thiểu 6 ký tự.");
        return;
      }

      if (accountForm.password !== accountForm.confirmPassword) {
        setErrorMessage("Mật khẩu và xác nhận mật khẩu không khớp.");
        return;
      }
    }

    await runAction(async () => {
      if (accountModalMode === "create") {
        const created = await createAccount(
          {
            username,
            password: accountForm.password,
            roleId,
            avatarUrl: avatarUrl || undefined,
          },
          authorization,
        );

        if (
          created.id &&
          isAccountStatus(accountForm.desiredStatus) &&
          created.status !== accountForm.desiredStatus
        ) {
          await updateAccountStatus(created.id, accountForm.desiredStatus, authorization);
        }

        if (guardianRoleIds.has(roleId) && selectedLinkedStudent) {
          const studentLabel =
            selectedLinkedStudent.studentCode ||
            selectedLinkedStudent.fullName ||
            `#${selectedLinkedStudent.id}`;
          setSuccessMessage(
            `Tạo tài khoản phụ huynh thành công: ${created.username}. Sinh viên ràng buộc: ${studentLabel}.`,
          );
        } else {
          setSuccessMessage(`Tạo tài khoản thành công: ${created.username}.`);
        }
      } else {
        if (!accountForm.id) {
          throw new Error("Không tìm thấy ID tài khoản để cập nhật.");
        }

        const updated = await updateAccount(
          accountForm.id,
          {
            username,
            roleId,
            avatarUrl: avatarUrl || undefined,
          },
          authorization,
        );

        setSuccessMessage(`Cập nhật tài khoản thành công: ${updated.username}.`);
      }

      const refreshed = await getAccounts(authorization, resolveAccountFilters());
      setAccounts(refreshed);
      setStatusDraftByAccountId(buildStatusDraftMap(refreshed.rows));
      setIsAccountModalOpen(false);
    });
  };

  const handleSaveAccountStatus = async (account: AccountListItem) => {
    if (!authorization) {
      setErrorMessage("Không tìm thấy phiên đăng nhập. Vui lòng đăng nhập lại.");
      return;
    }

    const nextStatus = statusDraftByAccountId[account.id];
    if (!nextStatus || nextStatus === account.status) {
      setSuccessMessage("Trạng thái không thay đổi.");
      return;
    }

    await runAction(async () => {
      await updateAccountStatus(account.id, nextStatus, authorization);
      const refreshed = await getAccounts(authorization, resolveAccountFilters());
      setAccounts(refreshed);
      setStatusDraftByAccountId(buildStatusDraftMap(refreshed.rows));
      setSuccessMessage(`Đã cập nhật trạng thái tài khoản #${account.id}.`);
    });
  };

  const handleOpenResetPassword = (account: AccountListItem) => {
    setErrorMessage("");
    setResetTargetAccount(account);
    setResetPasswordForm({
      newPassword: "",
      confirmPassword: "",
    });
  };

  const handleCloseResetPassword = () => {
    if (isLoading) {
      return;
    }

    setResetTargetAccount(null);
  };

  const handleSubmitResetPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");

    if (!authorization) {
      setErrorMessage("Không tìm thấy phiên đăng nhập. Vui lòng đăng nhập lại.");
      return;
    }

    if (!resetTargetAccount?.id) {
      setErrorMessage("Không tìm thấy tài khoản cần đặt lại mật khẩu.");
      return;
    }

    const newPassword = resetPasswordForm.newPassword;
    const confirmPassword = resetPasswordForm.confirmPassword;

    if (!newPassword || !confirmPassword) {
      setErrorMessage("Vui lòng nhập đầy đủ mật khẩu mới và xác nhận.");
      return;
    }

    if (newPassword.length < 6) {
      setErrorMessage("Mật khẩu mới tối thiểu 6 ký tự.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage("Mật khẩu mới và xác nhận không khớp.");
      return;
    }

    await runAction(async () => {
      await resetAccountPassword(
        resetTargetAccount.id,
        {
          newPassword,
          confirmPassword,
        },
        authorization,
      );

      setResetTargetAccount(null);
      setSuccessMessage(`Đã đặt lại mật khẩu cho tài khoản #${resetTargetAccount.id}.`);
    });
  };

  return (
    <section className="rounded-[10px] border border-[#8ab3d1] bg-white shadow-[0_1px_2px_rgba(7,51,84,0.16)]">
      <div className="flex flex-col gap-3 border-b border-[#c5dced] px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-[20px] font-semibold text-[#1a4f75]">
            Quản lý tài khoản
          </h2>
          <p className="mt-1 text-sm text-[#5a7890]">
            Tổng hợp tài khoản, vai trò và trạng thái để thao tác nhanh hơn.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openCreateModal}
            disabled={isLoading}
            className="rounded-[6px] bg-[#0d6ea6] px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-[#085d90] disabled:opacity-60"
          >
            Tạo tài khoản
          </button>
          <button
            type="button"
            onClick={() => {
              void loadRolesAndAccounts();
            }}
            disabled={isLoading}
            className="rounded-[6px] border border-[#9ec3dd] bg-white px-3.5 py-2 text-sm font-semibold text-[#165a83] transition hover:bg-[#edf6fd] disabled:opacity-60"
          >
            Làm mới
          </button>
        </div>
      </div>

      <div className="space-y-4 px-4 py-4">
        <form className="grid gap-2 md:grid-cols-4" onSubmit={handleSubmitFilters}>
          <input
            className="h-10 rounded-[6px] border border-[#c8d3dd] px-3 text-sm text-[#111827] outline-none focus:border-[#6aa8cf]"
            placeholder="Tìm theo username..."
            value={keywordFilter}
            onChange={(event) => setKeywordFilter(event.target.value)}
          />
          <select
            className="h-10 rounded-[6px] border border-[#c8d3dd] px-3 text-sm text-[#111827] outline-none focus:border-[#6aa8cf]"
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value as FilterRoleValue)}
          >
            <option value="ALL">Tất cả vai trò</option>
            {roleOptions.map((role) => (
              <option key={role.id} value={String(role.id)}>
                {role.name}
              </option>
            ))}
          </select>
          <select
            className="h-10 rounded-[6px] border border-[#c8d3dd] px-3 text-sm text-[#111827] outline-none focus:border-[#6aa8cf]"
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as FilterStatusValue)
            }
          >
            <option value="ALL">Tất cả trạng thái</option>
            {accountStatusOptions.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={isLoading}
              className="h-10 rounded-[6px] bg-[#0d6ea6] px-4 text-sm font-semibold text-white transition hover:bg-[#085d90] disabled:opacity-60"
            >
              Lọc
            </button>
            <button
              type="button"
              onClick={() => {
                void handleClearFilters();
              }}
              disabled={isLoading}
              className="h-10 rounded-[6px] border border-[#9ec3dd] bg-white px-4 text-sm font-semibold text-[#245977] transition hover:bg-[#edf6fd] disabled:opacity-60"
            >
              Bộ lọc
            </button>
          </div>
        </form>

        {errorMessage ? (
          <p className="rounded-[4px] border border-[#e8b2b2] bg-[#fff4f4] px-3 py-2 text-sm text-[#b03d3d]">
            {errorMessage}
          </p>
        ) : null}

        {successMessage && !shouldHideFeedbackMessage(successMessage) ? (
          <p className="rounded-[4px] border border-[#b3dbc1] bg-[#f2fbf5] px-3 py-2 text-sm text-[#2f7b4f]">
            {successMessage}
          </p>
        ) : null}

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#cfdfec] text-[#305970]">
                <th className="px-2 py-2">STT</th>
                <th className="px-2 py-2">Username</th>
                <th className="px-2 py-2">Vai trò</th>
                <th className="px-2 py-2">Trạng thái</th>
                <th className="px-2 py-2">Ngày tạo</th>
                <th className="px-2 py-2">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {accountPagination.paginatedRows.map((item, index) => {
                const currentStatus = isAccountStatus(item.status)
                  ? item.status
                  : "ACTIVE";
                const draftStatus = statusDraftByAccountId[item.id] || currentStatus;

                return (
                  <tr key={item.id} className="border-b border-[#e0ebf4] text-[#1f3344]">
                    <td className="px-2 py-2">{accountPagination.startItem + index}</td>
                    <td className="px-2 py-2">
                      <div>
                        <p className="font-semibold text-[#1f567b]">
                          {item.username || "-"}
                        </p>
                        <p className="mt-1 text-xs text-[#6b8497]">
                          Avatar: {item.avatarUrl || "Không có"}
                        </p>
                      </div>
                    </td>
                    <td className="px-2 py-2">
                      <span className="rounded-full bg-[#eef4f8] px-2.5 py-1 text-xs font-semibold text-[#47677e]">
                        {item.roleName || "-"}
                      </span>
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex min-w-[210px] items-center gap-2">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getAccountStatusClass(
                            currentStatus,
                          )}`}
                        >
                          {currentStatus}
                        </span>
                        <select
                          className="h-9 w-[130px] rounded-[6px] border border-[#c8d3dd] px-2 text-sm text-[#111827] outline-none focus:border-[#6aa8cf]"
                          value={draftStatus}
                          onChange={(event) =>
                            setStatusDraftByAccountId((prev) => ({
                              ...prev,
                              [item.id]: event.target.value as AccountStatus,
                            }))
                          }
                        >
                          {accountStatusOptions.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            void handleSaveAccountStatus(item);
                          }}
                          disabled={isLoading}
                          className="h-9 rounded-[6px] border border-[#9ec3dd] bg-white px-2.5 text-xs font-semibold text-[#245977] transition hover:bg-[#edf6fd] disabled:opacity-60"
                        >
                          Lưu
                        </button>
                      </div>
                    </td>
                    <td className="px-2 py-2">{formatDateTime(item.createdAt)}</td>
                    <td className="px-2 py-2">
                      <div className="flex min-w-[220px] items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            void openEditModal(item.id);
                          }}
                          className="h-9 rounded-[6px] border border-[#9ec3dd] bg-white px-3 text-xs font-semibold text-[#245977] transition hover:bg-[#edf6fd]"
                          disabled={isLoading}
                        >
                          Sửa
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenResetPassword(item)}
                          className="h-9 rounded-[6px] bg-[#0d6ea6] px-3 text-xs font-semibold text-white transition hover:bg-[#085d90]"
                          disabled={isLoading}
                        >
                          Đặt lại MK
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {accounts.rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-2 py-4 text-center text-[#577086]">
                    Chưa có dữ liệu tài khoản.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <TablePaginationControls
          pageIndex={accountPagination.pageIndex}
          pageSize={accountPagination.pageSize}
          totalItems={accountPagination.totalItems}
          totalPages={accountPagination.totalPages}
          startItem={accountPagination.startItem}
          endItem={accountPagination.endItem}
          onPageChange={accountPagination.setPageIndex}
          onPageSizeChange={accountPagination.setPageSize}
        />
      </div>

      {isAccountModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#08273f]/55 px-3 py-6 backdrop-blur-[1px]"
          onClick={closeAccountModal}
        >
          <div
            className="w-full max-w-[640px] rounded-[14px] border border-[#8db7d5] bg-white shadow-[0_18px_60px_rgba(7,35,62,0.36)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#d2e4f1] px-5 py-3">
              <h3 className="text-[20px] font-semibold text-[#154f75]">
                {accountModalMode === "create"
                  ? "Tạo Tài Khoản Mới"
                  : `Cập Nhật Tài Khoản #${accountForm.id}`}
              </h3>
              <button
                type="button"
                onClick={closeAccountModal}
                className="rounded-full border border-[#bdd5e7] px-2 py-0.5 text-xl leading-none text-[#346180] transition hover:bg-[#edf6fd]"
                disabled={isLoading}
                aria-label="Đóng popup"
              >
                ×
              </button>
            </div>

            <form className="grid gap-3 px-5 py-4 md:grid-cols-2" onSubmit={handleSubmitAccount}>
              <label className="space-y-1 md:col-span-2">
                <span className="text-sm font-semibold text-[#2c5877]">Username</span>
                <input
                  className="h-10 w-full rounded-[6px] border border-[#c8d3dd] px-3 text-sm text-[#111827] placeholder:text-[#5f6b76] outline-none focus:border-[#6aa8cf]"
                  placeholder="Nhập username"
                  value={accountForm.username}
                  onChange={(event) =>
                    setAccountForm((prev) => ({
                      ...prev,
                      username: event.target.value,
                    }))
                  }
                />
              </label>

              <label className="space-y-1">
                <span className="text-sm font-semibold text-[#2c5877]">Vai trò</span>
                <select
                  className="h-10 w-full rounded-[6px] border border-[#c8d3dd] px-3 text-sm text-[#111827] outline-none focus:border-[#6aa8cf]"
                  value={accountForm.roleId}
                  onChange={(event) =>
                    setAccountForm((prev) => ({
                      ...prev,
                      roleId: event.target.value,
                      linkedStudentId: "",
                    }))
                  }
                >
                  <option value="">Chọn vai trò</option>
                  {roleOptions.map((role) => (
                    <option key={role.id} value={String(role.id)}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </label>

              {accountModalMode === "create" && isGuardianRoleSelected ? (
                <label className="space-y-1 md:col-span-2">
                  <span className="text-sm font-semibold text-[#2c5877]">
                    Sinh viên liên kết (bắt buộc cho phụ huynh)
                  </span>
                  <select
                    className="h-10 w-full rounded-[6px] border border-[#c8d3dd] px-3 text-sm text-[#111827] outline-none focus:border-[#6aa8cf]"
                    value={accountForm.linkedStudentId}
                    onChange={(event) =>
                      setAccountForm((prev) => ({
                        ...prev,
                        linkedStudentId: event.target.value,
                      }))
                    }
                    disabled={isStudentLookupLoading}
                  >
                    <option value="">
                      {isStudentLookupLoading ? "Đang tải danh sách..." : "Chọn sinh viên"}
                    </option>
                    {studentLookupItems.map((student) => (
                      <option key={student.id} value={String(student.id)}>
                        {[
                          student.studentCode,
                          student.fullName,
                          `ID ${student.id}`,
                        ]
                          .filter(Boolean)
                          .join(" - ")}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-[#4f6b7f]">
                    Hệ thống yêu cầu chọn sinh viên để đảm bảo tài khoản phụ huynh được tạo đúng ngữ cảnh quản lý.
                  </p>
                </label>
              ) : null}

              <label className="space-y-1">
                <span className="text-sm font-semibold text-[#2c5877]">
                  Avatar URL (không bắt buộc)
                </span>
                <input
                  className="h-10 w-full rounded-[6px] border border-[#c8d3dd] px-3 text-sm text-[#111827] placeholder:text-[#5f6b76] outline-none focus:border-[#6aa8cf]"
                  placeholder="https://..."
                  value={accountForm.avatarUrl}
                  onChange={(event) =>
                    setAccountForm((prev) => ({
                      ...prev,
                      avatarUrl: event.target.value,
                    }))
                  }
                />
              </label>

              {accountModalMode === "create" ? (
                <>
                  <label className="space-y-1">
                    <span className="text-sm font-semibold text-[#2c5877]">Mật khẩu</span>
                    <input
                      type="password"
                      className="h-10 w-full rounded-[6px] border border-[#c8d3dd] px-3 text-sm text-[#111827] placeholder:text-[#5f6b76] outline-none focus:border-[#6aa8cf]"
                      placeholder="Tối thiểu 6 ký tự"
                      value={accountForm.password}
                      onChange={(event) =>
                        setAccountForm((prev) => ({
                          ...prev,
                          password: event.target.value,
                        }))
                      }
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-sm font-semibold text-[#2c5877]">
                      Xác nhận mật khẩu
                    </span>
                    <input
                      type="password"
                      className="h-10 w-full rounded-[6px] border border-[#c8d3dd] px-3 text-sm text-[#111827] placeholder:text-[#5f6b76] outline-none focus:border-[#6aa8cf]"
                      placeholder="Nhập lại mật khẩu"
                      value={accountForm.confirmPassword}
                      onChange={(event) =>
                        setAccountForm((prev) => ({
                          ...prev,
                          confirmPassword: event.target.value,
                        }))
                      }
                    />
                  </label>

                  <label className="space-y-1 md:col-span-2">
                    <span className="text-sm font-semibold text-[#2c5877]">
                      Trạng thái sau khi tạo
                    </span>
                    <select
                      className="h-10 w-full rounded-[6px] border border-[#c8d3dd] px-3 text-sm text-[#111827] outline-none focus:border-[#6aa8cf]"
                      value={accountForm.desiredStatus}
                      onChange={(event) =>
                        setAccountForm((prev) => ({
                          ...prev,
                          desiredStatus: event.target.value as AccountStatus,
                        }))
                      }
                    >
                      {accountStatusOptions.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              ) : null}

              <div className="mt-1 flex justify-end gap-2 md:col-span-2">
                <button
                  type="button"
                  onClick={closeAccountModal}
                  className="h-10 rounded-[6px] border border-[#9ec3dd] bg-white px-4 text-sm font-semibold text-[#245977] transition hover:bg-[#edf6fd] disabled:opacity-60"
                  disabled={isLoading}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="h-10 rounded-[6px] bg-[#0d6ea6] px-4 text-sm font-semibold text-white transition hover:bg-[#085d90] disabled:opacity-60"
                >
                  {isLoading
                    ? "Đang xử lý..."
                    : accountModalMode === "create"
                      ? "Tạo tài khoản"
                      : "Lưu thay đổi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {resetTargetAccount ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#08273f]/55 px-3 py-6 backdrop-blur-[1px]"
          onClick={handleCloseResetPassword}
        >
          <div
            className="w-full max-w-[520px] rounded-[14px] border border-[#8db7d5] bg-white shadow-[0_18px_60px_rgba(7,35,62,0.36)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#d2e4f1] px-5 py-3">
              <h3 className="text-[20px] font-semibold text-[#154f75]">
                Đặt lại mật khẩu tài khoản #{resetTargetAccount.id}
              </h3>
              <button
                type="button"
                onClick={handleCloseResetPassword}
                className="rounded-full border border-[#bdd5e7] px-2 py-0.5 text-xl leading-none text-[#346180] transition hover:bg-[#edf6fd]"
                disabled={isLoading}
                aria-label="Đóng popup"
              >
                ×
              </button>
            </div>

            <form className="space-y-3 px-5 py-4" onSubmit={handleSubmitResetPassword}>
              <label className="space-y-1">
                <span className="text-sm font-semibold text-[#2c5877]">Mật khẩu mới</span>
                <input
                  type="password"
                  className="h-10 w-full rounded-[6px] border border-[#c8d3dd] px-3 text-sm text-[#111827] placeholder:text-[#5f6b76] outline-none focus:border-[#6aa8cf]"
                  placeholder="Tối thiểu 6 ký tự"
                  value={resetPasswordForm.newPassword}
                  onChange={(event) =>
                    setResetPasswordForm((prev) => ({
                      ...prev,
                      newPassword: event.target.value,
                    }))
                  }
                />
              </label>

              <label className="space-y-1">
                <span className="text-sm font-semibold text-[#2c5877]">
                  Xác nhận mật khẩu mới
                </span>
                <input
                  type="password"
                  className="h-10 w-full rounded-[6px] border border-[#c8d3dd] px-3 text-sm text-[#111827] placeholder:text-[#5f6b76] outline-none focus:border-[#6aa8cf]"
                  placeholder="Nhập lại mật khẩu mới"
                  value={resetPasswordForm.confirmPassword}
                  onChange={(event) =>
                    setResetPasswordForm((prev) => ({
                      ...prev,
                      confirmPassword: event.target.value,
                    }))
                  }
                />
              </label>

              <div className="mt-1 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCloseResetPassword}
                  className="h-10 rounded-[6px] border border-[#9ec3dd] bg-white px-4 text-sm font-semibold text-[#245977] transition hover:bg-[#edf6fd] disabled:opacity-60"
                  disabled={isLoading}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="h-10 rounded-[6px] bg-[#0d6ea6] px-4 text-sm font-semibold text-white transition hover:bg-[#085d90] disabled:opacity-60"
                >
                  {isLoading ? "Đang xử lý..." : "Xác nhận đặt lại"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
};



