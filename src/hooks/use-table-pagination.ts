import { useMemo, useState } from "react";

export const defaultTablePageSize = 10;
export const defaultTablePageSizeOptions = [10, 20, 50, 100] as const;

type UseTablePaginationOptions = {
  initialPageSize?: number;
};

type UseTablePaginationResult<T> = {
  pageIndex: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  startItem: number;
  endItem: number;
  paginatedRows: T[];
  setPageIndex: (nextPageIndex: number) => void;
  setPageSize: (nextPageSize: number) => void;
};

export const useTablePagination = <T,>(
  rows: T[],
  options?: UseTablePaginationOptions,
): UseTablePaginationResult<T> => {
  const [pageIndex, setPageIndexState] = useState(0);
  const [pageSize, setPageSizeState] = useState(
    options?.initialPageSize || defaultTablePageSize,
  );

  const safePageSize = Number.isInteger(pageSize) && pageSize > 0
    ? pageSize
    : defaultTablePageSize;

  const totalItems = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / safePageSize));

  const resolvedPageIndex = Math.min(Math.max(pageIndex, 0), totalPages - 1);
  const startOffset = resolvedPageIndex * safePageSize;

  const paginatedRows = useMemo(() => {
    return rows.slice(startOffset, startOffset + safePageSize);
  }, [rows, startOffset, safePageSize]);

  const startItem = totalItems === 0 ? 0 : startOffset + 1;
  const endItem = Math.min(startOffset + safePageSize, totalItems);

  const setPageIndex = (nextPageIndex: number) => {
    const safeNextPageIndex = Number.isInteger(nextPageIndex) ? nextPageIndex : 0;
    if (safeNextPageIndex < 0) {
      setPageIndexState(0);
      return;
    }
    if (safeNextPageIndex > totalPages - 1) {
      setPageIndexState(totalPages - 1);
      return;
    }
    setPageIndexState(safeNextPageIndex);
  };

  const setPageSize = (nextPageSize: number) => {
    const safeNextPageSize =
      Number.isInteger(nextPageSize) && nextPageSize > 0
        ? nextPageSize
        : defaultTablePageSize;

    setPageSizeState(safeNextPageSize);
    setPageIndexState(0);
  };

  return {
    pageIndex: resolvedPageIndex,
    pageSize: safePageSize,
    totalItems,
    totalPages,
    startItem,
    endItem,
    paginatedRows,
    setPageIndex,
    setPageSize,
  };
};
