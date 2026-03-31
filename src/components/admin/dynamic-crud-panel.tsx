"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  shouldHideFeedbackMessage,
  useToastFeedback,
} from "@/hooks/use-toast-feedback";
import {
  createDynamicByPath,
  deleteDynamicByPath,
  getDynamicByPath,
  getDynamicListByPath,
  patchDynamicByPath,
  updateDynamicByPath,
} from "@/lib/admin/service";
import type { DynamicRow, PagedRows } from "@/lib/admin/types";

interface StatusPatchConfig {
  fieldName: string;
  pathSuffix: string;
  options: string[];
}

interface FieldLookupConfig {
  path: string;
  query?: Record<string, string | number | undefined>;
  valueKey?: string;
  labelKeys?: string[];
  dependsOn?: string;
  pathTemplate?: string;
  disableUntilDependsOn?: boolean;
}

interface DynamicCrudPanelProps {
  authorization?: string;
  title: string;
  basePath: string;
  listPath?: string;
  listQuery?: Record<string, string | number | undefined>;
  priorityColumns?: string[];
  createTemplate: Record<string, unknown>;
  updateTemplate: Record<string, unknown>;
  idFieldCandidates?: string[];
  statusPatch?: StatusPatchConfig;
  fieldLookups?: Record<string, FieldLookupConfig>;
}

type FormMode = "create" | "edit";

const emptyRows: PagedRows<DynamicRow> = { rows: [] };
const defaultIdFieldCandidates = ["id"];

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Thao tác thất bại. Vui lòng thử lại.";
};

const isObject = (value: unknown): value is Record<string, unknown> => {
  return value !== null && typeof value === "object" && !Array.isArray(value);
};

const toColumnLabel = (field: string): string => {
  const spaced = field
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .trim();

  return spaced ? `${spaced[0].toUpperCase()}${spaced.slice(1)}` : field;
};

const toDisplayValue = (value: unknown): string => {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (Array.isArray(value)) {
    return `${value.length} mục`;
  }

  if (typeof value === "object") {
    return "Có dữ liệu";
  }

  return String(value);
};

const buildColumns = (
  rows: DynamicRow[],
  priorityColumns: string[],
): string[] => {
  const scalarKeys = new Set<string>();
  const complexKeys = new Set<string>();

  for (const row of rows.slice(0, 80)) {
    for (const [key, value] of Object.entries(row)) {
      if (Array.isArray(value) || (value !== null && typeof value === "object")) {
        complexKeys.add(key);
        continue;
      }

      scalarKeys.add(key);
    }
  }

  const visibleKeys = [...scalarKeys].filter((key) => !complexKeys.has(key));
  const priority = priorityColumns.filter((key) => visibleKeys.includes(key));
  const others = visibleKeys
    .filter((key) => !priorityColumns.includes(key))
    .sort();

  return [...priority, ...others];
};

const resolveRowId = (row: DynamicRow, idFieldCandidates: string[]): string | null => {
  for (const field of idFieldCandidates) {
    const value = row[field];
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
};

const hydratePayloadFromTemplate = (
  template: Record<string, unknown>,
  source: DynamicRow,
): Record<string, unknown> => {
  const result: Record<string, unknown> = {};

  for (const [key, templateValue] of Object.entries(template)) {
    const sourceValue = source[key];

    if (Array.isArray(templateValue)) {
      result[key] = Array.isArray(sourceValue) ? sourceValue : templateValue;
      continue;
    }

    if (isObject(templateValue)) {
      result[key] = hydratePayloadFromTemplate(
        templateValue,
        isObject(sourceValue) ? sourceValue : {},
      );
      continue;
    }

    result[key] = sourceValue ?? templateValue;
  }

  return result;
};

const cloneRecord = (value: Record<string, unknown>): Record<string, unknown> => {
  const cloned: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (Array.isArray(item)) {
      cloned[key] = [...item];
      continue;
    }
    if (isObject(item)) {
      cloned[key] = cloneRecord(item);
      continue;
    }
    cloned[key] = item;
  }
  return cloned;
};

const getValueByPath = (source: Record<string, unknown>, path: string): unknown => {
  const keys = path.split(".");
  let cursor: unknown = source;
  for (const key of keys) {
    if (!isObject(cursor) || !(key in cursor)) {
      return undefined;
    }
    cursor = cursor[key];
  }
  return cursor;
};

const setValueByPath = (
  source: Record<string, unknown>,
  path: string,
  value: unknown,
): Record<string, unknown> => {
  const keys = path.split(".");
  const next = cloneRecord(source);
  let cursor: Record<string, unknown> = next;
  for (let index = 0; index < keys.length - 1; index += 1) {
    const key = keys[index];
    const currentValue = cursor[key];
    if (!isObject(currentValue)) {
      cursor[key] = {};
    }
    cursor = cursor[key] as Record<string, unknown>;
  }
  cursor[keys[keys.length - 1]] = value;
  return next;
};

const toInputText = (value: unknown): string => {
  if (value === undefined || value === null) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "";
  }
};

const hasLookupDependencyValue = (value: unknown): boolean => {
  if (value === undefined || value === null) {
    return false;
  }

  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  return true;
};

const coercePayloadByTemplate = (
  template: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> => {
  const result: Record<string, unknown> = {};

  for (const [key, templateValue] of Object.entries(template)) {
    const sourceValue = source[key];

    if (Array.isArray(templateValue)) {
      if (Array.isArray(sourceValue)) {
        result[key] = sourceValue;
      } else if (typeof sourceValue === "string") {
        try {
          const parsed = JSON.parse(sourceValue) as unknown;
          result[key] = Array.isArray(parsed) ? parsed : templateValue;
        } catch {
          result[key] = templateValue;
        }
      } else {
        result[key] = templateValue;
      }
      continue;
    }

    if (isObject(templateValue)) {
      result[key] = coercePayloadByTemplate(
        templateValue,
        isObject(sourceValue) ? sourceValue : {},
      );
      continue;
    }

    if (typeof templateValue === "number") {
      if (typeof sourceValue === "number") {
        result[key] = sourceValue;
      } else {
        const parsed = Number(sourceValue);
        result[key] = Number.isFinite(parsed) ? parsed : templateValue;
      }
      continue;
    }

    if (typeof templateValue === "boolean") {
      if (typeof sourceValue === "boolean") {
        result[key] = sourceValue;
      } else {
        result[key] = String(sourceValue).toLowerCase() === "true";
      }
      continue;
    }

    result[key] =
      sourceValue === undefined || sourceValue === null
        ? templateValue
        : String(sourceValue);
  }

  return result;
};

export const DynamicCrudPanel = ({
  authorization,
  title,
  basePath,
  listPath,
  listQuery,
  priorityColumns = ["id", "code", "name", "status"],
  createTemplate,
  updateTemplate,
  idFieldCandidates = defaultIdFieldCandidates,
  statusPatch,
  fieldLookups,
}: DynamicCrudPanelProps) => {
  const [dataRows, setDataRows] = useState<PagedRows<DynamicRow>>(emptyRows);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  useToastFeedback({
    errorMessage,
    successMessage,
    errorTitle: "Thao tác dữ liệu thất bại",
    successTitle: "Thao tác dữ liệu thành công",
  });
  const [statusDraftByRowId, setStatusDraftByRowId] = useState<
    Record<string, string>
  >({});
  const [keyword, setKeyword] = useState("");

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>("create");
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [formPayload, setFormPayload] = useState<Record<string, unknown>>({});
  const [lookupOptionsByField, setLookupOptionsByField] = useState<
    Record<string, Array<{ value: string; label: string }>>
  >({});

  const lookupDependencyKey = useMemo(() => {
    if (!fieldLookups) {
      return "";
    }

    const parts = Object.entries(fieldLookups)
      .map(([fieldPath, config]) => {
        if (!config.dependsOn) {
          return `${fieldPath}=`;
        }

        const dependencyValue = getValueByPath(formPayload, config.dependsOn);
        const token = hasLookupDependencyValue(dependencyValue)
          ? String(dependencyValue).trim()
          : "";
        return `${fieldPath}=${token}`;
      })
      .sort();

    return parts.join("|");
  }, [fieldLookups, formPayload]);

  const effectiveListPath = listPath || basePath;

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

  const loadData = useCallback(async () => {
    if (!authorization) {
      setErrorMessage("Không tìm thấy phiên đăng nhập. Vui lòng đăng nhập lại.");
      return;
    }

    await runAction(async () => {
      const rows = await getDynamicListByPath(effectiveListPath, authorization, listQuery);
      setDataRows(rows);

      if (statusPatch) {
        const draft: Record<string, string> = {};
        for (const row of rows.rows) {
          const rowId = resolveRowId(row, idFieldCandidates);
          const rawStatus = row[statusPatch.fieldName];
          if (!rowId || typeof rawStatus !== "string") {
            continue;
          }
          if (statusPatch.options.includes(rawStatus)) {
            draft[rowId] = rawStatus;
          }
        }
        setStatusDraftByRowId(draft);
      }

      setSuccessMessage(`Đã tải ${rows.rows.length} bản ghi.`);
    });
  }, [
    authorization,
    effectiveListPath,
    idFieldCandidates,
    listQuery,
    runAction,
    statusPatch,
  ]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!authorization || !fieldLookups || !isEditorOpen) {
      return;
    }

    let cancelled = false;

    const loadLookups = async () => {
      const dependencyValuesByField = new Map<string, string>();
      if (lookupDependencyKey) {
        for (const token of lookupDependencyKey.split("|")) {
          const [fieldPath, ...valueParts] = token.split("=");
          dependencyValuesByField.set(fieldPath, valueParts.join("="));
        }
      }

      const entries = Object.entries(fieldLookups);
      const loaded = await Promise.all(
        entries.map(async ([fieldPath, config]) => {
          const dependencyValue = dependencyValuesByField.get(fieldPath) || "";
          const requiresDependency =
            Boolean(config.dependsOn) && config.disableUntilDependsOn !== false;

          if (requiresDependency && !dependencyValue) {
            return [fieldPath, [] as Array<{ value: string; label: string }>] as const;
          }

          const resolvedPath = dependencyValue
            ? (config.pathTemplate || config.path).replace(
                "{value}",
                encodeURIComponent(dependencyValue),
              )
            : config.path;

          try {
            const rows = await getDynamicListByPath(
              resolvedPath,
              authorization,
              config.query,
            );
            const valueKey = config.valueKey || "id";
            const labelKeys = config.labelKeys || [
              "name",
              "fullName",
              "className",
              "courseName",
              "facultyName",
              "majorName",
              "specializationName",
              "cohortName",
              "sectionCode",
              "displayName",
              "code",
            ];

            const options = rows.rows
              .map((row) => {
                const rawValue = row[valueKey];
                if (
                  rawValue === undefined ||
                  rawValue === null ||
                  (typeof rawValue === "string" && !rawValue.trim())
                ) {
                  return null;
                }

                const label =
                  labelKeys
                    .map((key) => row[key])
                    .find((value) => typeof value === "string" && value.trim())
                    ?.toString() || String(rawValue);

                return {
                  value: String(rawValue),
                  label,
                };
              })
              .filter((item): item is { value: string; label: string } => item !== null);

            return [fieldPath, options] as const;
          } catch {
            return [fieldPath, [] as Array<{ value: string; label: string }>] as const;
          }
        }),
      );

      if (cancelled) {
        return;
      }

      setLookupOptionsByField((prev) => {
        const next = { ...prev };
        for (const [fieldPath, options] of loaded) {
          next[fieldPath] = options;
        }
        return next;
      });
    };

    void loadLookups();

    return () => {
      cancelled = true;
    };
  }, [authorization, fieldLookups, isEditorOpen, lookupDependencyKey]);

  const tableColumns = useMemo(() => {
    return buildColumns(dataRows.rows, priorityColumns);
  }, [dataRows.rows, priorityColumns]);

  const filteredRows = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    if (!normalizedKeyword) {
      return dataRows.rows;
    }

    return dataRows.rows.filter((row) =>
      tableColumns.some((column) =>
        toDisplayValue(row[column]).toLowerCase().includes(normalizedKeyword),
      ),
    );
  }, [dataRows.rows, keyword, tableColumns]);

  const openCreateEditor = () => {
    setFormMode("create");
    setEditingRowId(null);
    setFormPayload(cloneRecord(createTemplate));
    setIsEditorOpen(true);
  };

  const openEditEditor = async (rowId: string) => {
    if (!authorization) {
      setErrorMessage("Không tìm thấy phiên đăng nhập. Vui lòng đăng nhập lại.");
      return;
    }

    await runAction(async () => {
      const detail = await getDynamicByPath(`${basePath}/${rowId}`, authorization);
      const hydrated = hydratePayloadFromTemplate(updateTemplate, detail);
      setFormMode("edit");
      setEditingRowId(rowId);
      setFormPayload(hydrated);
      setIsEditorOpen(true);
    });
  };

  const closeEditor = () => {
    if (isLoading) {
      return;
    }
    setIsEditorOpen(false);
  };

  const handleSubmitEditor = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");

    if (!authorization) {
      setErrorMessage("Không tìm thấy phiên đăng nhập. Vui lòng đăng nhập lại.");
      return;
    }

    const payload = coercePayloadByTemplate(
      formMode === "create" ? createTemplate : updateTemplate,
      formPayload,
    );

    await runAction(async () => {
      if (formMode === "create") {
        await createDynamicByPath(basePath, payload, authorization);
        setSuccessMessage("Tạo moi thành công.");
      } else {
        if (!editingRowId) {
          throw new Error("Không tìm thấy ID bản ghi để cập nhật.");
        }
        await updateDynamicByPath(`${basePath}/${editingRowId}`, payload, authorization);
        setSuccessMessage("Cập nhật thành công.");
      }

      setIsEditorOpen(false);
      const rows = await getDynamicListByPath(effectiveListPath, authorization, listQuery);
      setDataRows(rows);
    });
  };

  const handleDeleteRow = async (rowId: string) => {
    if (!authorization) {
      setErrorMessage("Không tìm thấy phiên đăng nhập. Vui lòng đăng nhập lại.");
      return;
    }

    const accepted = window.confirm(`Bạn có chắc muốn xoa bản ghi #${rowId}?`);
    if (!accepted) {
      return;
    }

    await runAction(async () => {
      await deleteDynamicByPath(`${basePath}/${rowId}`, authorization);
      const rows = await getDynamicListByPath(effectiveListPath, authorization, listQuery);
      setDataRows(rows);
      setSuccessMessage(`Đã xóa bản ghi #${rowId}.`);
    });
  };

  const handleSaveStatus = async (row: DynamicRow, rowId: string) => {
    if (!authorization || !statusPatch) {
      return;
    }

    const nextStatus = statusDraftByRowId[rowId];
    if (!nextStatus) {
      return;
    }

    if (row[statusPatch.fieldName] === nextStatus) {
      setSuccessMessage("Trạng thái không thay doi.");
      return;
    }

    await runAction(async () => {
      await patchDynamicByPath(
        `${basePath}/${rowId}${statusPatch.pathSuffix}`,
        { [statusPatch.fieldName]: nextStatus },
        authorization,
      );
      const rows = await getDynamicListByPath(effectiveListPath, authorization, listQuery);
      setDataRows(rows);
      setSuccessMessage(`Đã cập nhật trạng thái bản ghi #${rowId}.`);
    });
  };

  const renderFormFields = (
    template: Record<string, unknown>,
    parentPath = "",
  ) => {
    return Object.entries(template).map(([key, templateValue]) => {
      const path = parentPath ? `${parentPath}.${key}` : key;
      const currentValue = getValueByPath(formPayload, path);
      const lookupConfig = fieldLookups?.[path];
      const lookupOptions: Array<{ value: string; label: string }> =
        lookupOptionsByField[path] || [];
      const hasLookup = Boolean(lookupConfig);
      const dependencyValue = lookupConfig?.dependsOn
        ? getValueByPath(formPayload, lookupConfig.dependsOn)
        : undefined;
      const isLookupDisabled =
        Boolean(lookupConfig?.dependsOn) &&
        lookupConfig?.disableUntilDependsOn !== false &&
        !hasLookupDependencyValue(dependencyValue);

      if (isObject(templateValue)) {
        return (
          <fieldset key={path} className="rounded-[8px] border border-[#d3e3ef] p-3">
            <legend className="px-1 text-sm font-semibold text-[#2c5877]">
              {toColumnLabel(key)}
            </legend>
            <div className="grid gap-3 md:grid-cols-2">
              {renderFormFields(templateValue, path)}
            </div>
          </fieldset>
        );
      }

      if (Array.isArray(templateValue)) {
        return (
          <label key={path} className="space-y-1">
            <span className="text-sm font-semibold text-[#2c5877]">
              {toColumnLabel(key)} (JSON array)
            </span>
            <textarea
              value={toInputText(currentValue ?? templateValue)}
              onChange={(event) =>
                setFormPayload((prev) => setValueByPath(prev, path, event.target.value))
              }
              className="min-h-[90px] w-full rounded-[6px] border border-[#c8d3dd] bg-[#fbfdff] px-3 py-2 font-mono text-xs text-[#111827] outline-none focus:border-[#6aa8cf]"
              spellCheck={false}
            />
          </label>
        );
      }

      if (typeof templateValue === "boolean") {
        return (
          <label key={path} className="space-y-1">
            <span className="text-sm font-semibold text-[#2c5877]">
              {toColumnLabel(key)}
            </span>
            <select
              value={String(currentValue ?? templateValue)}
              onChange={(event) =>
                setFormPayload((prev) => setValueByPath(prev, path, event.target.value))
              }
              className="h-10 w-full rounded-[6px] border border-[#c8d3dd] px-3 text-sm text-[#111827] outline-none focus:border-[#6aa8cf]"
            >
              <option value="true">True</option>
              <option value="false">False</option>
            </select>
          </label>
        );
      }

      if (typeof templateValue === "number") {
        if (hasLookup) {
          return (
            <label key={path} className="space-y-1">
              <span className="text-sm font-semibold text-[#2c5877]">
                {toColumnLabel(key)}
              </span>
              <select
                value={toInputText(currentValue ?? templateValue)}
                onChange={(event) =>
                  setFormPayload((prev) => setValueByPath(prev, path, event.target.value))
                }
                disabled={isLookupDisabled}
                className="h-10 w-full rounded-[6px] border border-[#c8d3dd] px-3 text-sm text-[#111827] outline-none focus:border-[#6aa8cf]"
              >
                <option value="">Chọn {toColumnLabel(key)}</option>
                {lookupOptions.map((option) => (
                  <option key={`${path}-${option.value}`} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {isLookupDisabled ? (
                <span className="text-xs text-[#6b8497]">
                  Chọn {toColumnLabel(lookupConfig?.dependsOn || "")} trước để tải danh sách.
                </span>
              ) : null}
            </label>
          );
        }

        return (
          <label key={path} className="space-y-1">
            <span className="text-sm font-semibold text-[#2c5877]">
              {toColumnLabel(key)}
            </span>
            <input
              type="number"
              step="any"
              value={toInputText(currentValue ?? templateValue)}
              onChange={(event) =>
                setFormPayload((prev) => setValueByPath(prev, path, event.target.value))
              }
              className="h-10 w-full rounded-[6px] border border-[#c8d3dd] px-3 text-sm text-[#111827] outline-none focus:border-[#6aa8cf]"
            />
          </label>
        );
      }

      if (hasLookup) {
        return (
          <label key={path} className="space-y-1">
            <span className="text-sm font-semibold text-[#2c5877]">
              {toColumnLabel(key)}
            </span>
            <select
              value={toInputText(currentValue ?? templateValue)}
              onChange={(event) =>
                setFormPayload((prev) => setValueByPath(prev, path, event.target.value))
              }
              disabled={isLookupDisabled}
              className="h-10 w-full rounded-[6px] border border-[#c8d3dd] px-3 text-sm text-[#111827] outline-none focus:border-[#6aa8cf]"
            >
              <option value="">Chọn {toColumnLabel(key)}</option>
              {lookupOptions.map((option) => (
                <option key={`${path}-${option.value}`} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {isLookupDisabled ? (
              <span className="text-xs text-[#6b8497]">
                Chọn {toColumnLabel(lookupConfig?.dependsOn || "")} trước để tải danh sách.
              </span>
            ) : null}
          </label>
        );
      }

      return (
        <label key={path} className="space-y-1">
          <span className="text-sm font-semibold text-[#2c5877]">
            {toColumnLabel(key)}
          </span>
          <input
            type="text"
            value={toInputText(currentValue ?? templateValue)}
            onChange={(event) =>
              setFormPayload((prev) => setValueByPath(prev, path, event.target.value))
            }
            className="h-10 w-full rounded-[6px] border border-[#c8d3dd] px-3 text-sm text-[#111827] outline-none focus:border-[#6aa8cf]"
          />
        </label>
      );
    });
  };

  return (
    <section className="rounded-[10px] border border-[#8ab3d1] bg-white shadow-[0_1px_2px_rgba(7,51,84,0.16)]">
      <div className="flex items-center justify-between border-b border-[#c5dced] px-4 py-3 text-[18px] font-semibold text-[#1a4f75]">
        <div>
          <h2>{title}</h2>
          <p className="mt-1 text-sm font-medium text-[#5a7890]">
            Quản lý dữ liệu danh muc voi bo loc nhanh va thao tac tap trung hon.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openCreateEditor}
            disabled={isLoading}
            className="rounded-[6px] bg-[#0d6ea6] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#085d90] disabled:opacity-60"
          >
            Tạo moi
          </button>
          <button
            type="button"
            onClick={() => {
              void loadData();
            }}
            disabled={isLoading}
            className="rounded-[6px] border border-[#9ec3dd] bg-white px-3 py-2 text-sm font-semibold text-[#165a83] transition hover:bg-[#edf6fd] disabled:opacity-60"
          >
            Làm mới
          </button>
        </div>
      </div>

      <div className="space-y-4 px-4 py-4">
        <div className="grid gap-3 md:grid-cols-3">
          <article className="rounded-[10px] border border-[#c7dceb] bg-[#f8fcff] px-4 py-3">
            <p className="text-sm font-medium text-[#5f7d93]">Tổng bản ghi</p>
            <p className="mt-2 text-[28px] font-bold text-[#1d5b82]">
              {dataRows.rows.length}
            </p>
          </article>
          <article className="rounded-[10px] border border-[#c7dceb] bg-[#f8fcff] px-4 py-3">
            <p className="text-sm font-medium text-[#5f7d93]">Sau bo loc</p>
            <p className="mt-2 text-[28px] font-bold text-[#2b67a1]">
              {filteredRows.length}
            </p>
          </article>
          <article className="rounded-[10px] border border-[#c7dceb] bg-[#f8fcff] px-4 py-3">
            <p className="text-sm font-medium text-[#5f7d93]">Cot uu tien</p>
            <p className="mt-2 text-[28px] font-bold text-[#1d7a47]">
              {priorityColumns.length}
            </p>
          </article>
        </div>

        <div className="max-w-[420px]">
          <input
            className="h-10 w-full rounded-[6px] border border-[#c8d3dd] px-3 text-sm text-[#111827] outline-none focus:border-[#6aa8cf]"
            placeholder="Tim nhanh trong bạng..."
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
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
                {tableColumns.map((column) => (
                  <th key={column} className="px-2 py-2">
                    {toColumnLabel(column)}
                  </th>
                ))}
                {statusPatch ? <th className="px-2 py-2">Trạng thái</th> : null}
                <th className="px-2 py-2">Thao tac</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, index) => {
                const rowId = resolveRowId(row, idFieldCandidates);
                return (
                  <tr key={`row-${rowId || index}`} className="border-b border-[#e0ebf4] text-[#1f3344]">
                    {tableColumns.map((column) => (
                      <td key={`${index}-${column}`} className="max-w-[260px] px-2 py-2">
                        <span className="line-clamp-2">{toDisplayValue(row[column])}</span>
                      </td>
                    ))}

                    {statusPatch ? (
                      <td className="px-2 py-2">
                        {rowId ? (
                          <div className="flex min-w-[210px] items-center gap-2">
                            <select
                              className="h-9 w-[130px] rounded-[6px] border border-[#c8d3dd] px-2 text-sm text-[#111827] outline-none focus:border-[#6aa8cf]"
                              value={statusDraftByRowId[rowId] || ""}
                              onChange={(event) =>
                                setStatusDraftByRowId((prev) => ({
                                  ...prev,
                                  [rowId]: event.target.value,
                                }))
                              }
                            >
                              <option value="" disabled>
                                Chon
                              </option>
                              {statusPatch.options.map((status) => (
                                <option key={status} value={status}>
                                  {status}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => {
                                void handleSaveStatus(row, rowId);
                              }}
                              disabled={isLoading}
                              className="h-9 rounded-[6px] border border-[#9ec3dd] bg-white px-2.5 text-xs font-semibold text-[#245977] transition hover:bg-[#edf6fd] disabled:opacity-60"
                            >
                              Luu
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-[#577086]">Không có ID</span>
                        )}
                      </td>
                    ) : null}

                    <td className="px-2 py-2">
                      {rowId ? (
                        <div className="flex min-w-[160px] items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              void openEditEditor(rowId);
                            }}
                            disabled={isLoading}
                            className="h-9 rounded-[6px] border border-[#9ec3dd] bg-white px-3 text-xs font-semibold text-[#245977] transition hover:bg-[#edf6fd] disabled:opacity-60"
                          >
                            Sửa
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              void handleDeleteRow(rowId);
                            }}
                            disabled={isLoading}
                            className="h-9 rounded-[6px] bg-[#cc3a3a] px-3 text-xs font-semibold text-white transition hover:bg-[#aa2e2e] disabled:opacity-60"
                          >
                            Xóa
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-[#577086]">Không có ID</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={tableColumns.length + (statusPatch ? 2 : 1)}
                    className="px-2 py-4 text-center text-[#577086]"
                  >
                    Không có dữ liệu phu hop voi bo loc hiện tại.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {isEditorOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#08273f]/55 px-3 py-6 backdrop-blur-[1px]"
          onClick={closeEditor}
        >
          <div
            className="w-full max-w-[860px] rounded-[14px] border border-[#8db7d5] bg-white shadow-[0_18px_60px_rgba(7,35,62,0.36)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#d2e4f1] px-5 py-3">
              <h3 className="text-[20px] font-semibold text-[#154f75]">
                {formMode === "create"
                  ? `Tạo moi - ${title}`
                  : `Cập nhật #${editingRowId} - ${title}`}
              </h3>
              <button
                type="button"
                onClick={closeEditor}
                className="rounded-full border border-[#bdd5e7] px-2 py-0.5 text-xl leading-none text-[#346180] transition hover:bg-[#edf6fd]"
                disabled={isLoading}
                aria-label="Dong popup"
              >
                ×
              </button>
            </div>

            <form className="space-y-3 px-5 py-4" onSubmit={handleSubmitEditor}>
              <p className="text-sm text-[#355970]">
                Điền form trực quan theo schema cấu hình của danh mục.
              </p>
              <div className="max-h-[60vh] overflow-y-auto rounded-[8px] border border-[#d3e3ef] bg-[#fbfdff] p-3">
                <div className="grid gap-3 md:grid-cols-2">
                  {renderFormFields(formMode === "create" ? createTemplate : updateTemplate)}
                </div>
              </div>

              <div className="mt-1 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeEditor}
                  className="h-10 rounded-[6px] border border-[#9ec3dd] bg-white px-4 text-sm font-semibold text-[#245977] transition hover:bg-[#edf6fd] disabled:opacity-60"
                  disabled={isLoading}
                >
                  Huy
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="h-10 rounded-[6px] bg-[#0d6ea6] px-4 text-sm font-semibold text-white transition hover:bg-[#085d90] disabled:opacity-60"
                >
                  {isLoading
                    ? "Đang xử lý..."
                    : formMode === "create"
                      ? "Tạo moi"
                      : "Luu cap nhat"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
};
