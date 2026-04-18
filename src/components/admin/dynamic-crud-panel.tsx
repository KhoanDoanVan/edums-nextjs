"use client";

import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { useToastFeedback } from "@/hooks/use-toast-feedback";
import {
  createDynamicByPath,
  deleteDynamicByPath,
  getDynamicByPath,
  getDynamicListByPath,
  patchDynamicByPath,
  updateDynamicByPath,
} from "@/lib/admin/service";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { toErrorMessage } from "@/components/admin/format-utils";
import { TablePaginationControls } from "@/components/admin/table-pagination-controls";
import { buildColumns, toColumnLabel, toDisplayValue } from "@/components/admin/table-utils";
import { useTablePagination } from "@/hooks/use-table-pagination";
import type { DynamicRow, PagedRows } from "@/lib/admin/types";

interface StatusPatchConfig {
  fieldName: string;
  pathSuffix: string;
  options: string[];
}

interface FieldLookupConfig {
  path: string;
  query?: Record<string, string | number | undefined>;
  filterBy?: Record<
    string,
    string | number | boolean | Array<string | number | boolean>
  >;
  valueKey?: string;
  labelKeys?: string[];
  dependsOn?: string;
  pathTemplate?: string;
  disableUntilDependsOn?: boolean;
}

interface FieldOptionConfig {
  value: string;
  label?: string;
}

interface FieldRuleContext {
  formMode: FormMode;
  formPayload: Record<string, unknown>;
  currentRow: DynamicRow | null;
}

interface DynamicFieldConfig {
  hidden?: boolean | ((context: FieldRuleContext) => boolean);
  disabled?: boolean | ((context: FieldRuleContext) => boolean);
  helperText?: string | ((context: FieldRuleContext) => string);
  options?:
    | FieldOptionConfig[]
    | ((context: FieldRuleContext) => FieldOptionConfig[]);
}

interface DynamicCrudPanelProps {
  authorization?: string;
  title: string;
  basePath: string;
  listPath?: string;
  listQuery?: Record<string, string | number | undefined>;
  priorityColumns?: string[];
  hiddenColumns?: string[];
  createTemplate: Record<string, unknown>;
  updateTemplate: Record<string, unknown>;
  idFieldCandidates?: string[];
  statusPatch?: StatusPatchConfig;
  fieldLookups?: Record<string, FieldLookupConfig>;
  fieldConfigs?: Record<string, DynamicFieldConfig>;
  beforeDelete?: (row: DynamicRow) => string | null;
  transformCreatePayload?: (payload: Record<string, unknown>) => Record<string, unknown>;
  transformUpdatePayload?: (
    payload: Record<string, unknown>,
    currentRow: DynamicRow | null,
  ) => Record<string, unknown>;
  enableDetailView?: boolean;
  detailFieldOrder?: string[];
  renderDetailExtra?: (row: DynamicRow) => ReactNode;
  rowTransform?: (row: DynamicRow) => DynamicRow;
  columnValueRenderers?: Record<
    string,
    (value: unknown, row: DynamicRow) => unknown
  >;
}

type FormMode = "create" | "edit";

const emptyRows: PagedRows<DynamicRow> = { rows: [] };
const defaultIdFieldCandidates = ["id"];

const isObject = (value: unknown): value is Record<string, unknown> => {
  return value !== null && typeof value === "object" && !Array.isArray(value);
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

type TemporalInputKind = "text" | "date" | "datetime-local";

const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}/;
const dateTimePattern =
  /^(\d{4}-\d{2}-\d{2})[T\s](\d{2}:\d{2})(?::(\d{2}))?/;

const resolveTemporalInputKind = (fieldPath: string, value: unknown): TemporalInputKind => {
  const fieldName = fieldPath.split(".").at(-1)?.toLowerCase() || "";

  if (fieldName.endsWith("date")) {
    return "date";
  }

  if (fieldName.endsWith("time")) {
    return "datetime-local";
  }

  if (typeof value !== "string") {
    return "text";
  }

  const text = value.trim();
  if (!text) {
    return "text";
  }

  if (dateTimePattern.test(text)) {
    return "datetime-local";
  }

  if (dateOnlyPattern.test(text)) {
    return "date";
  }

  return "text";
};

const formatTemporalInputValue = (kind: TemporalInputKind, value: unknown): string => {
  if (kind === "text") {
    return toInputText(value);
  }

  if (typeof value !== "string") {
    return "";
  }

  const text = value.trim();
  if (!text) {
    return "";
  }

  if (kind === "date") {
    const match = text.match(dateOnlyPattern);
    return match ? match[0] : text;
  }

  const match = text.match(dateTimePattern);
  if (!match) {
    return text;
  }

  const [, datePart, minutePart, secondPart] = match;
  return `${datePart}T${minutePart}:${secondPart || "00"}`;
};

const coerceTemporalInputValue = (kind: TemporalInputKind, rawValue: string): string => {
  if (kind === "date") {
    const match = rawValue.match(dateOnlyPattern);
    return match ? match[0] : rawValue;
  }

  if (kind === "datetime-local") {
    const match = rawValue.match(
      /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})(?::(\d{2}))?$/,
    );
    if (match) {
      const [, base, secondPart] = match;
      return `${base}:${secondPart || "00"}`;
    }
  }

  return rawValue;
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

const matchesLookupValue = (
  actualValue: unknown,
  expectedValue: string | number | boolean,
): boolean => {
  if (typeof expectedValue === "string") {
    return String(actualValue || "").trim().toUpperCase() === expectedValue.trim().toUpperCase();
  }

  if (typeof expectedValue === "number") {
    return Number(actualValue) === expectedValue;
  }

  return Boolean(actualValue) === expectedValue;
};

const matchesLookupFilter = (
  row: DynamicRow,
  filterBy?: Record<
    string,
    string | number | boolean | Array<string | number | boolean>
  >,
): boolean => {
  if (!filterBy) {
    return true;
  }

  return Object.entries(filterBy).every(([key, expectedValue]) => {
    const actualValue = row[key];

    if (Array.isArray(expectedValue)) {
      return expectedValue.some((value) => matchesLookupValue(actualValue, value));
    }

    return matchesLookupValue(actualValue, expectedValue);
  });
};

const resolveFieldRule = <T,>(
  rule: T | ((context: FieldRuleContext) => T),
  context: FieldRuleContext,
): T => {
  if (typeof rule === "function") {
    return (rule as (context: FieldRuleContext) => T)(context);
  }

  return rule;
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
  hiddenColumns = [],
  createTemplate,
  updateTemplate,
  idFieldCandidates = defaultIdFieldCandidates,
  statusPatch,
  fieldLookups,
  fieldConfigs,
  beforeDelete,
  transformCreatePayload,
  transformUpdatePayload,
  enableDetailView = false,
  detailFieldOrder,
  renderDetailExtra,
  rowTransform,
  columnValueRenderers,
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
  const [confirmDeleteTarget, setConfirmDeleteTarget] = useState<{
    row: DynamicRow;
    rowId: string;
  } | null>(null);
  const [formMode, setFormMode] = useState<FormMode>("create");
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [formPayload, setFormPayload] = useState<Record<string, unknown>>({});
  const [currentEditRow, setCurrentEditRow] = useState<DynamicRow | null>(null);
  const [detailRow, setDetailRow] = useState<DynamicRow | null>(null);
  const [detailRowId, setDetailRowId] = useState<string | null>(null);
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
      const nextRows = rowTransform
        ? {
            ...rows,
            rows: rows.rows.map((row) => rowTransform(row)),
          }
        : rows;
      setDataRows(nextRows);

      if (statusPatch) {
        const draft: Record<string, string> = {};
        for (const row of nextRows.rows) {
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

      setSuccessMessage(`Đã tải ${nextRows.rows.length} bản ghi.`);
    });
  }, [
    authorization,
    effectiveListPath,
    idFieldCandidates,
    listQuery,
    rowTransform,
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
              .filter((row) => matchesLookupFilter(row, config.filterBy))
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
    const columns = buildColumns(dataRows.rows, priorityColumns, 80);
    if (hiddenColumns.length === 0) {
      return columns;
    }

    const hidden = new Set(hiddenColumns);
    return columns.filter((column) => !hidden.has(column));
  }, [dataRows.rows, hiddenColumns, priorityColumns]);

  const filteredRows = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    if (!normalizedKeyword) {
      return dataRows.rows;
    }

    return dataRows.rows.filter((row) =>
      tableColumns.some((column) => {
        const rawValue = row[column];
        const renderValue = columnValueRenderers?.[column]
          ? columnValueRenderers[column](rawValue, row)
          : rawValue;
        const rawText =
          typeof renderValue === "string" ||
          typeof renderValue === "number" ||
          typeof renderValue === "boolean"
            ? String(renderValue).toLowerCase()
            : "";

        const displayText = toDisplayValue(renderValue).toLowerCase();
        return (
          displayText.includes(normalizedKeyword) ||
          rawText.includes(normalizedKeyword)
        );
      }),
    );
  }, [columnValueRenderers, dataRows.rows, keyword, tableColumns]);

  const tablePagination = useTablePagination(filteredRows);

  const fieldRuleContext = useMemo<FieldRuleContext>(
    () => ({
      formMode,
      formPayload,
      currentRow: currentEditRow,
    }),
    [currentEditRow, formMode, formPayload],
  );

  const openCreateEditor = () => {
    setFormMode("create");
    setEditingRowId(null);
    setFormPayload(cloneRecord(createTemplate));
    setCurrentEditRow(null);
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
      setCurrentEditRow(detail);
      setIsEditorOpen(true);
    });
  };

  const closeEditor = () => {
    if (isLoading) {
      return;
    }
    setIsEditorOpen(false);
    setCurrentEditRow(null);
  };

  const closeDetailView = () => {
    if (isLoading) {
      return;
    }
    setDetailRow(null);
    setDetailRowId(null);
  };

  const openDetailView = async (row: DynamicRow, rowId: string) => {
    if (!authorization) {
      setErrorMessage("Không tìm thấy phiên đăng nhập. Vui lòng đăng nhập lại.");
      return;
    }

    await runAction(async () => {
      const detail = await getDynamicByPath(`${basePath}/${rowId}`, authorization);
      setDetailRow({
        ...row,
        ...detail,
      });
      setDetailRowId(rowId);
      setSuccessMessage("");
    });
  };

  const orderedDetailEntries = useMemo(() => {
    if (!detailRow) {
      return [] as Array<[string, unknown]>;
    }

    if (!detailFieldOrder || detailFieldOrder.length === 0) {
      return (Object.entries(detailRow) as Array<[string, unknown]>).filter(
        ([key]) => key !== "id",
      );
    }

    return detailFieldOrder.map((field): [string, unknown] => [field, detailRow[field]]);
  }, [detailFieldOrder, detailRow]);

  const handleSubmitEditor = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");

    if (!authorization) {
      setErrorMessage("Không tìm thấy phiên đăng nhập. Vui lòng đăng nhập lại.");
      return;
    }

    let payload = coercePayloadByTemplate(
      formMode === "create" ? createTemplate : updateTemplate,
      formPayload,
    );

    if (formMode === "create" && transformCreatePayload) {
      payload = transformCreatePayload(payload);
    }

    if (formMode === "edit" && transformUpdatePayload) {
      payload = transformUpdatePayload(payload, currentEditRow);
    }

    await runAction(async () => {
      if (formMode === "create") {
        await createDynamicByPath(basePath, payload, authorization);
        setSuccessMessage("Tạo mới thành công.");
      } else {
        if (!editingRowId) {
          throw new Error("Không tìm thấy ID bản ghi để cập nhật.");
        }
        await updateDynamicByPath(`${basePath}/${editingRowId}`, payload, authorization);
        setSuccessMessage("Cập nhật thành công.");
      }

      setIsEditorOpen(false);
      setCurrentEditRow(null);
      const rows = await getDynamicListByPath(effectiveListPath, authorization, listQuery);
      setDataRows(rows);
    });
  };

  const handleDeleteRow = async (row: DynamicRow, rowId: string) => {
    if (!authorization) {
      setErrorMessage("Không tìm thấy phiên đăng nhập. Vui lòng đăng nhập lại.");
      return;
    }

    const deleteGuardMessage = beforeDelete?.(row);
    if (deleteGuardMessage) {
      setErrorMessage(deleteGuardMessage);
      return;
    }

    setConfirmDeleteTarget({ row, rowId });
  };

  const confirmDeleteRow = async () => {
    if (!authorization || !confirmDeleteTarget) {
      return;
    }

    const { rowId } = confirmDeleteTarget;
    setConfirmDeleteTarget(null);

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
      const fieldConfig = fieldConfigs?.[path];
      const lookupConfig = fieldLookups?.[path];
      const lookupOptions: Array<{ value: string; label: string }> =
        lookupOptionsByField[path] || [];
      const selectOptions = fieldConfig?.options
        ? resolveFieldRule(fieldConfig.options, fieldRuleContext)
        : [];
      const isFieldHidden = fieldConfig?.hidden
        ? resolveFieldRule(fieldConfig.hidden, fieldRuleContext)
        : false;
      const isFieldDisabled = fieldConfig?.disabled
        ? resolveFieldRule(fieldConfig.disabled, fieldRuleContext)
        : false;
      const fieldHelperText = fieldConfig?.helperText
        ? resolveFieldRule(fieldConfig.helperText, fieldRuleContext)
        : "";
      const hasLookup = Boolean(lookupConfig);
      const dependencyValue = lookupConfig?.dependsOn
        ? getValueByPath(formPayload, lookupConfig.dependsOn)
        : undefined;
      const isLookupDisabled =
        Boolean(lookupConfig?.dependsOn) &&
        lookupConfig?.disableUntilDependsOn !== false &&
        !hasLookupDependencyValue(dependencyValue);

      if (isFieldHidden) {
        return null;
      }

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
              {toColumnLabel(key)} (Mảng JSON)
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
        const booleanOptions =
          selectOptions.length > 0
            ? selectOptions
            : [
                { value: "true", label: "Có" },
                { value: "false", label: "Không" },
              ];

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
              disabled={isFieldDisabled}
              className="h-10 w-full rounded-[6px] border border-[#c8d3dd] px-3 text-sm text-[#111827] outline-none focus:border-[#6aa8cf]"
            >
              {booleanOptions.map((option) => (
                <option key={`${path}-${option.value}`} value={option.value}>
                  {toDisplayValue(option.label || option.value)}
                </option>
              ))}
            </select>
            {fieldHelperText ? (
              <span className="text-xs text-[#6b8497]">{fieldHelperText}</span>
            ) : null}
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
                disabled={isLookupDisabled || isFieldDisabled}
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
              ) : fieldHelperText ? (
                <span className="text-xs text-[#6b8497]">{fieldHelperText}</span>
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
              disabled={isFieldDisabled}
              className="h-10 w-full rounded-[6px] border border-[#c8d3dd] px-3 text-sm text-[#111827] outline-none focus:border-[#6aa8cf]"
            />
            {fieldHelperText ? (
              <span className="text-xs text-[#6b8497]">{fieldHelperText}</span>
            ) : null}
          </label>
        );
      }

      if (selectOptions.length > 0) {
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
              disabled={isFieldDisabled}
              className="h-10 w-full rounded-[6px] border border-[#c8d3dd] px-3 text-sm text-[#111827] outline-none focus:border-[#6aa8cf]"
            >
              <option value="">Chọn {toColumnLabel(key)}</option>
              {selectOptions.map((option) => (
                <option key={`${path}-${option.value}`} value={option.value}>
                  {toDisplayValue(option.label || option.value)}
                </option>
              ))}
            </select>
            {fieldHelperText ? (
              <span className="text-xs text-[#6b8497]">{fieldHelperText}</span>
            ) : null}
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
              disabled={isLookupDisabled || isFieldDisabled}
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
            ) : fieldHelperText ? (
              <span className="text-xs text-[#6b8497]">{fieldHelperText}</span>
            ) : null}
          </label>
        );
      }

      const temporalInputKind = resolveTemporalInputKind(
        path,
        currentValue ?? templateValue,
      );
      const inputValue = formatTemporalInputValue(
        temporalInputKind,
        currentValue ?? templateValue,
      );

      return (
        <label key={path} className="space-y-1">
          <span className="text-sm font-semibold text-[#2c5877]">
            {toColumnLabel(key)}
          </span>
          <input
            type={temporalInputKind}
            step={temporalInputKind === "datetime-local" ? "1" : undefined}
            value={inputValue}
            onChange={(event) =>
              setFormPayload((prev) =>
                setValueByPath(
                  prev,
                  path,
                  coerceTemporalInputValue(temporalInputKind, event.target.value),
                ),
              )
            }
            disabled={isFieldDisabled}
            className="h-10 w-full rounded-[6px] border border-[#c8d3dd] px-3 text-sm text-[#111827] outline-none focus:border-[#6aa8cf]"
          />
          {fieldHelperText ? (
            <span className="text-xs text-[#6b8497]">{fieldHelperText}</span>
          ) : null}
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
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openCreateEditor}
            disabled={isLoading}
            className="rounded-[6px] bg-[#0d6ea6] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#085d90] disabled:opacity-60"
          >
            Tạo mới
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
        <div className="max-w-[420px]">
          <input
            className="h-10 w-full rounded-[6px] border border-[#c8d3dd] px-3 text-sm text-[#111827] outline-none focus:border-[#6aa8cf]"
            placeholder="Tim nhanh trong bạng..."
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#cfdfec] text-[#305970]">
                <th className="w-16 px-2 py-2">STT</th>
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
              {tablePagination.paginatedRows.map((row, index) => {
                const rowNumber = tablePagination.startItem + index;
                const rowId = resolveRowId(row, idFieldCandidates);
                return (
                  <tr key={`row-${rowId || rowNumber}`} className="border-b border-[#e0ebf4] text-[#1f3344]">
                    <td className="px-2 py-2 font-medium text-[#355970]">{rowNumber}</td>
                    {tableColumns.map((column) => (
                      <td key={`${rowNumber}-${column}`} className="max-w-[260px] px-2 py-2">
                        <span className="line-clamp-2">
                          {toDisplayValue(
                            columnValueRenderers?.[column]
                              ? columnValueRenderers[column](row[column], row)
                              : row[column],
                          )}
                        </span>
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
                                Chọn
                              </option>
                              {statusPatch.options.map((status) => (
                                <option key={status} value={status}>
                                  {toDisplayValue(status)}
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
                              Lưu
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-[#577086]">Không có ID</span>
                        )}
                      </td>
                    ) : null}

                    <td className="px-2 py-2">
                      {rowId ? (
                        <div className="flex min-w-[230px] items-center gap-2">
                          {enableDetailView ? (
                            <button
                              type="button"
                              onClick={() => {
                                void openDetailView(row, rowId);
                              }}
                              disabled={isLoading}
                              className="h-9 rounded-[6px] border border-[#9ec3dd] bg-white px-3 text-xs font-semibold text-[#245977] transition hover:bg-[#edf6fd] disabled:opacity-60"
                            >
                              Chi tiết
                            </button>
                          ) : null}
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
                              void handleDeleteRow(row, rowId);
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
                    colSpan={tableColumns.length + (statusPatch ? 3 : 2)}
                    className="px-2 py-4 text-center text-[#577086]"
                  >
                    Không có dữ liệu phu hop voi bo loc hiện tại.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <TablePaginationControls
          pageIndex={tablePagination.pageIndex}
          pageSize={tablePagination.pageSize}
          totalItems={tablePagination.totalItems}
          totalPages={tablePagination.totalPages}
          startItem={tablePagination.startItem}
          endItem={tablePagination.endItem}
          onPageChange={tablePagination.setPageIndex}
          onPageSizeChange={tablePagination.setPageSize}
        />
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
                  ? `Tạo mới`
                  : `Cập nhật `}
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
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="h-10 rounded-[6px] bg-[#0d6ea6] px-4 text-sm font-semibold text-white transition hover:bg-[#085d90] disabled:opacity-60"
                >
                  {isLoading
                    ? "Đang xử lý..."
                    : formMode === "create"
                      ? "Tạo mới"
                      : "Lưu cập nhật"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {detailRow ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#08273f]/55 px-3 py-6 backdrop-blur-[1px]"
          onClick={closeDetailView}
        >
          <div
            className="w-full max-w-[860px] rounded-[14px] border border-[#8db7d5] bg-white shadow-[0_18px_60px_rgba(7,35,62,0.36)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#d2e4f1] px-5 py-3">
              <h3 className="text-[20px] font-semibold text-[#154f75]">
                Chi tiết bản ghi {detailRowId ? `#${detailRowId}` : ""}
              </h3>
              <button
                type="button"
                onClick={closeDetailView}
                className="rounded-full border border-[#bdd5e7] px-2 py-0.5 text-xl leading-none text-[#346180] transition hover:bg-[#edf6fd]"
                disabled={isLoading}
                aria-label="Dong popup chi tiet"
              >
                ×
              </button>
            </div>

            <div className="max-h-[65vh] overflow-y-auto px-5 py-4">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[#cfdfec] text-[#305970]">
                    <th className="px-2 py-2">Trường</th>
                    <th className="px-2 py-2">Giá trị</th>
                  </tr>
                </thead>
                <tbody>
                  {orderedDetailEntries.map(([key, value]) => (
                    <tr key={`detail-${key}`} className="border-b border-[#e0ebf4] text-[#1f3344]">
                      <td className="px-2 py-2 font-semibold text-[#285a7b]">{toColumnLabel(key)}</td>
                      <td className="px-2 py-2">{toDisplayValue(value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {renderDetailExtra ? (
                <div className="mt-4">
                  {renderDetailExtra(detailRow)}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(confirmDeleteTarget)}
        title="Xác nhận xóa"
        message={
          confirmDeleteTarget
            ? `Bạn có chắc muốn xóa bản ghi #${confirmDeleteTarget.rowId}?`
            : ""
        }
        confirmText="Xóa"
        isProcessing={isLoading}
        onCancel={() => setConfirmDeleteTarget(null)}
        onConfirm={() => {
          void confirmDeleteRow();
        }}
      />
    </section>
  );
};
