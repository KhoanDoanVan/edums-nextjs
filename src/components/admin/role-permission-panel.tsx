"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  shouldHideFeedbackMessage,
  useToastFeedback,
} from "@/hooks/use-toast-feedback";
import {
  createRole,
  deleteRole,
  getRoleById,
  getRolePermissions,
  getRoles,
  updateRole,
} from "@/lib/admin/service";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { toErrorMessage } from "@/components/admin/format-utils";
import type { RoleListItem } from "@/lib/admin/types";

interface RolePermissionPanelProps {
  authorization?: string;
}

type RoleModalMode = "create" | "edit";

interface RoleFormState {
  id: number | null;
  roleName: string;
  functionCodes: string[];
}

const formatFunctionCodes = (codes?: string[]): string => {
  if (!codes || codes.length === 0) {
    return "-";
  }

  return codes.join(", ");
};

const buildPermissionLoadClass = (count: number): string => {
  if (count >= 8) {
    return "bg-[#edf9f1] text-[#23724b]";
  }

  if (count >= 4) {
    return "bg-[#fff8e8] text-[#9a6a00]";
  }

  return "bg-[#eef4f8] text-[#47677e]";
};

export const RolePermissionPanel = ({
  authorization,
}: RolePermissionPanelProps) => {
  const [roles, setRoles] = useState<RoleListItem[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [roleKeyword, setRoleKeyword] = useState("");
  const [permissionKeyword, setPermissionKeyword] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useToastFeedback({
    errorMessage,
    successMessage,
    errorTitle: "Thao tác vai trò thất bại",
    successTitle: "Thao tác vai trò thành công",
  });

  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [roleModalMode, setRoleModalMode] = useState<RoleModalMode>("create");
  const [roleForm, setRoleForm] = useState<RoleFormState>({
    id: null,
    roleName: "",
    functionCodes: [],
  });
  const [roleToDelete, setRoleToDelete] = useState<RoleListItem | null>(null);

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

  const loadRolesAndPermissions = useCallback(async () => {
    if (!authorization) {
      setErrorMessage("Không tìm thấy phiên đăng nhập. Vui lòng đăng nhập lại.");
      return;
    }

    await runAction(async () => {
      const [roleRows, permissionRows] = await Promise.all([
        getRoles(authorization),
        getRolePermissions(authorization),
      ]);

      setRoles(roleRows);
      setPermissions(permissionRows);
      setSuccessMessage(
        `Đã tải ${roleRows.length} vai trò và ${permissionRows.length} quyền.`,
      );
    });
  }, [authorization, runAction]);

  useEffect(() => {
    void loadRolesAndPermissions();
  }, [loadRolesAndPermissions]);

  const filteredRoles = useMemo(() => {
    const keyword = roleKeyword.trim().toLowerCase();
    if (!keyword) {
      return roles;
    }

    return roles.filter((role) => {
      const roleName = role.roleName?.toLowerCase() || "";
      const codeText = (role.functionCodes || []).join(" ").toLowerCase();
      return roleName.includes(keyword) || codeText.includes(keyword);
    });
  }, [roleKeyword, roles]);

  const filteredPermissions = useMemo(() => {
    const keyword = permissionKeyword.trim().toLowerCase();
    if (!keyword) {
      return permissions;
    }

    return permissions.filter((permission) =>
      permission.toLowerCase().includes(keyword),
    );
  }, [permissionKeyword, permissions]);


  const openCreateRoleModal = () => {
    setErrorMessage("");
    setRoleModalMode("create");
    setRoleForm({
      id: null,
      roleName: "",
      functionCodes: [],
    });
    setIsRoleModalOpen(true);
  };

  const openEditRoleModal = async (roleId: number) => {
    if (!authorization) {
      setErrorMessage("Không tìm thấy phiên đăng nhập. Vui lòng đăng nhập lại.");
      return;
    }

    await runAction(async () => {
      const role = await getRoleById(roleId, authorization);
      setRoleModalMode("edit");
      setRoleForm({
        id: role.id,
        roleName: role.roleName || "",
        functionCodes: role.functionCodes || [],
      });
      setIsRoleModalOpen(true);
    });
  };

  const closeRoleModal = () => {
    if (isLoading) {
      return;
    }
    setIsRoleModalOpen(false);
  };

  const toggleFunctionCode = (functionCode: string) => {
    setRoleForm((prev) => {
      const exists = prev.functionCodes.includes(functionCode);
      return {
        ...prev,
        functionCodes: exists
          ? prev.functionCodes.filter((item) => item !== functionCode)
          : [...prev.functionCodes, functionCode],
      };
    });
  };

  const handleSubmitRole = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");

    if (!authorization) {
      setErrorMessage("Không tìm thấy phiên đăng nhập. Vui lòng đăng nhập lại.");
      return;
    }

    const roleName = roleForm.roleName.trim();
    if (!roleName) {
      setErrorMessage("Vui lòng nhập tên vai trò.");
      return;
    }

    const functionCodes = [...new Set(roleForm.functionCodes)];

    await runAction(async () => {
      if (roleModalMode === "create") {
        const createdRole = await createRole(
          {
            roleName,
            functionCodes,
          },
          authorization,
        );

        setSuccessMessage(
          `Tạo vai trò thành công: ${createdRole.roleName || roleName}.`,
        );
      } else {
        if (!roleForm.id) {
          throw new Error("Không tìm thấy mã vai trò để cập nhật.");
        }

        const updatedRole = await updateRole(
          roleForm.id,
          {
            roleName,
            functionCodes,
          },
          authorization,
        );

        setSuccessMessage(
          `Cập nhật vai trò thành công: ${updatedRole.roleName || roleName}.`,
        );
      }

      setIsRoleModalOpen(false);
      const roleRows = await getRoles(authorization);
      setRoles(roleRows);
    });
  };

  const handleDeleteRole = (role: RoleListItem) => {
    if (!authorization) {
      setErrorMessage("Không tìm thấy phiên đăng nhập. Vui lòng đăng nhập lại.");
      return;
    }

    if (!role.id) {
      setErrorMessage("Không tìm thấy mã vai trò để xóa.");
      return;
    }

    setRoleToDelete(role);
  };

  const handleConfirmDeleteRole = async () => {
    if (!authorization || !roleToDelete) {
      return;
    }

    const role = roleToDelete;
    setRoleToDelete(null);

    await runAction(async () => {
      await deleteRole(role.id, authorization);
      const roleRows = await getRoles(authorization);
      setRoles(roleRows);
      setSuccessMessage(`Đã xóa vai trò ${role.roleName || role.id}.`);
    });
  };

  return (
    <div className="space-y-4">

      <section className="rounded-[10px] border border-[#8ab3d1] bg-white shadow-[0_1px_2px_rgba(7,51,84,0.16)]">
        <div className="flex items-center justify-between border-b border-[#c5dced] px-4 py-3 text-[18px] font-semibold text-[#1a4f75]">
          <div>
            <h2>Quản lý vai trò</h2>
            <p className="mt-1 text-sm font-medium text-[#5a7890]">
              Theo dõi vai trò theo tên và mức độ gán quyền.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openCreateRoleModal}
              disabled={isLoading}
              className="rounded-[4px] bg-[#0d6ea6] px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-[#085d90] disabled:opacity-60"
            >
              Tạo vai trò
            </button>
            <button
              type="button"
              onClick={() => {
                void loadRolesAndPermissions();
              }}
              disabled={isLoading}
              className="rounded-[4px] border border-[#9ec3dd] bg-white px-3 py-1.5 text-sm font-semibold text-[#165a83] transition hover:bg-[#edf6fd] disabled:opacity-60"
            >
              Làm mới
            </button>
          </div>
        </div>

        <div className="space-y-3 px-4 py-4">
          <div className="max-w-[420px]">
            <input
              className="h-10 w-full rounded-[6px] border border-[#c8d3dd] px-3 text-sm text-[#111827] outline-none focus:border-[#6aa8cf]"
              placeholder="Tìm vai trò theo tên hoặc mã quyền..."
              value={roleKeyword}
              onChange={(event) => setRoleKeyword(event.target.value)}
            />
          </div>

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
                  <th className="px-2 py-2">Tên vai trò</th>
                  <th className="px-2 py-2">Quyền</th>
                  <th className="px-2 py-2">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredRoles.map((role, index) => (
                  <tr key={role.id} className="border-b border-[#e0ebf4] text-[#1f3344]">
                    <td className="px-2 py-2">{index + 1}</td>
                    <td className="px-2 py-2">
                      <p className="font-semibold text-[#1f567b]">
                        {role.roleName || "-"}
                      </p>
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${buildPermissionLoadClass(
                            role.functionCodes?.length || 0,
                          )}`}
                        >
                          {(role.functionCodes?.length || 0)} quyền
                        </span>
                        <span className="line-clamp-2">
                          {formatFunctionCodes(role.functionCodes)}
                        </span>
                      </div>
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex min-w-[160px] items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            void openEditRoleModal(role.id);
                          }}
                          disabled={isLoading}
                          className="h-9 rounded-[6px] border border-[#9ec3dd] bg-white px-3 text-xs font-semibold text-[#245977] transition hover:bg-[#edf6fd] disabled:opacity-60"
                        >
                          Sửa
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            void handleDeleteRole(role);
                          }}
                          disabled={isLoading}
                          className="h-9 rounded-[6px] bg-[#cc3a3a] px-3 text-xs font-semibold text-white transition hover:bg-[#aa2e2e] disabled:opacity-60"
                        >
                          Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredRoles.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-2 py-4 text-center text-[#577086]">
                      Chưa có dữ liệu vai trò.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="rounded-[10px] border border-[#8ab3d1] bg-white shadow-[0_1px_2px_rgba(7,51,84,0.16)]">
        <div className="flex items-center justify-between border-b border-[#c5dced] px-4 py-3 text-[18px] font-semibold text-[#1a4f75]">
          <div>
            <h2>Tập quyền hệ thống</h2>
            <p className="mt-1 text-sm font-medium text-[#5a7890]">
              Bộ lọc nhanh để tra cứu function code khi cấu hình vai trò.
            </p>
          </div>
          <span className="text-sm font-medium text-[#396786]">
            {permissions.length} quyền
          </span>
        </div>
        <div className="space-y-3 px-4 py-4">
          <div className="max-w-[420px]">
            <input
              className="h-10 w-full rounded-[6px] border border-[#c8d3dd] px-3 text-sm text-[#111827] outline-none focus:border-[#6aa8cf]"
              placeholder="Tìm quyền..."
              value={permissionKeyword}
              onChange={(event) => setPermissionKeyword(event.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {filteredPermissions.length > 0 ? (
              filteredPermissions.map((permission) => (
                <span
                  key={permission}
                  className="rounded-full border border-[#9ec3dd] bg-[#edf5fb] px-3 py-1 text-xs font-semibold text-[#1f5d86]"
                >
                  {permission}
                </span>
              ))
            ) : (
              <p className="text-sm text-[#577086]">Không tìm thấy quyền.</p>
            )}
          </div>
        </div>
      </section>

      {isRoleModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#08273f]/55 px-3 py-6 backdrop-blur-[1px]"
          onClick={closeRoleModal}
        >
          <div
            className="w-full max-w-[860px] rounded-[14px] border border-[#8db7d5] bg-white shadow-[0_18px_60px_rgba(7,35,62,0.36)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#d2e4f1] px-5 py-3">
              <h3 className="text-[20px] font-semibold text-[#154f75]">
                {roleModalMode === "create"
                  ? "Tạo vai trò mới"
                  : `Cập nhật vai trò #${roleForm.id}`}
              </h3>
              <button
                type="button"
                onClick={closeRoleModal}
                className="rounded-full border border-[#bdd5e7] px-2 py-0.5 text-xl leading-none text-[#346180] transition hover:bg-[#edf6fd]"
                disabled={isLoading}
                aria-label="Đóng popup"
              >
                ×
              </button>
            </div>

            <form className="space-y-3 px-5 py-4" onSubmit={handleSubmitRole}>
              <label className="space-y-1">
                <span className="text-sm font-semibold text-[#2c5877]">Tên vai trò</span>
                <input
                  className="h-10 w-full rounded-[6px] border border-[#c8d3dd] px-3 text-sm text-[#111827] outline-none focus:border-[#6aa8cf]"
                  placeholder="VD: STUDENT, LECTURER, ADMIN_SUPPORT"
                  value={roleForm.roleName}
                  onChange={(event) =>
                    setRoleForm((prev) => ({
                      ...prev,
                      roleName: event.target.value,
                    }))
                  }
                />
              </label>

              <div className="space-y-1">
                <p className="text-sm font-semibold text-[#2c5877]">
                  Gán quyền (function codes)
                </p>
                <div className="max-h-[280px] overflow-y-auto rounded-[8px] border border-[#d2e4f1] p-3">
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {permissions.map((permission) => {
                      const checked = roleForm.functionCodes.includes(permission);
                      return (
                        <label
                          key={permission}
                          className="flex cursor-pointer items-center gap-2 rounded-[6px] border border-[#d8e6f2] bg-[#f9fcff] px-2.5 py-2 text-sm text-[#1f3344]"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleFunctionCode(permission)}
                          />
                          <span className="break-all">{permission}</span>
                        </label>
                      );
                    })}
                    {permissions.length === 0 ? (
                      <p className="text-sm text-[#577086]">Chưa tải được quyền.</p>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="mt-1 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeRoleModal}
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
                    : roleModalMode === "create"
                      ? "Tạo vai trò"
                      : "Lưu thay đổi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(roleToDelete)}
        title="Xác nhận xóa vai trò"
        message={
          roleToDelete
            ? `Bạn có chắc muốn xóa vai trò "${roleToDelete.roleName || roleToDelete.id}"?`
            : ""
        }
        confirmText="Xóa"
        isProcessing={isLoading}
        onCancel={() => setRoleToDelete(null)}
        onConfirm={() => {
          void handleConfirmDeleteRole();
        }}
      />
    </div>
  );
};
