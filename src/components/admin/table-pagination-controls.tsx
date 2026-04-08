import { defaultTablePageSizeOptions } from "@/hooks/use-table-pagination";

type TablePaginationControlsProps = {
  pageIndex: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  startItem: number;
  endItem: number;
  onPageChange: (pageIndex: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  pageSizeOptions?: readonly number[];
};

export const TablePaginationControls = ({
  pageIndex,
  pageSize,
  totalItems,
  totalPages,
  startItem,
  endItem,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = defaultTablePageSizeOptions,
}: TablePaginationControlsProps) => {
  const hasData = totalItems > 0;
  const isFirstPage = !hasData || pageIndex <= 0;
  const isLastPage = !hasData || pageIndex >= totalPages - 1;

  return (
    <div className="flex flex-col gap-2 border-t border-[#dbe7f1] bg-[#f8fbfe] px-3 py-2 text-xs text-[#496377] sm:flex-row sm:items-center sm:justify-between">
      <p>
        {hasData
          ? `Hiển thị ${startItem}-${endItem} trên ${totalItems} dòng`
          : "Không có dữ liệu"}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1">
          <span>Kích thước trang</span>
          <select
            className="h-8 rounded-[6px] border border-[#c8d3dd] bg-white px-2 text-xs text-[#1f3344] outline-none focus:border-[#6aa8cf]"
            value={String(pageSize)}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
          >
            {pageSizeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-center gap-1">
          <button
            type="button"
            className="h-8 rounded-[6px] border border-[#c8d3dd] bg-white px-2 text-xs font-semibold text-[#245977] transition hover:bg-[#edf6fd] disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => onPageChange(0)}
            disabled={isFirstPage}
          >
            |&lt;
          </button>
          <button
            type="button"
            className="h-8 rounded-[6px] border border-[#c8d3dd] bg-white px-2 text-xs font-semibold text-[#245977] transition hover:bg-[#edf6fd] disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => onPageChange(pageIndex - 1)}
            disabled={isFirstPage}
          >
            &lt;
          </button>
          <span className="rounded-[6px] border border-[#d9e7f1] bg-white px-2 py-1 font-medium text-[#355970]">
            Trang {hasData ? pageIndex + 1 : 0}/{hasData ? totalPages : 0}
          </span>
          <button
            type="button"
            className="h-8 rounded-[6px] border border-[#c8d3dd] bg-white px-2 text-xs font-semibold text-[#245977] transition hover:bg-[#edf6fd] disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => onPageChange(pageIndex + 1)}
            disabled={isLastPage}
          >
            &gt;
          </button>
          <button
            type="button"
            className="h-8 rounded-[6px] border border-[#c8d3dd] bg-white px-2 text-xs font-semibold text-[#245977] transition hover:bg-[#edf6fd] disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => onPageChange(totalPages - 1)}
            disabled={isLastPage}
          >
            &gt;|
          </button>
        </div>
      </div>
    </div>
  );
};
