"use client";

interface ConfirmDialogProps {
  open: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isProcessing?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title = "Xác nhận thao tác",
  message,
  confirmText = "Xác nhận",
  cancelText = "Hủy",
  isProcessing = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-[#08273f]/55 px-3 py-6 backdrop-blur-[1px]"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-[520px] rounded-[14px] border border-[#8db7d5] bg-white shadow-[0_18px_60px_rgba(7,35,62,0.36)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#d2e4f1] px-5 py-3">
          <h3 className="text-[20px] font-semibold text-[#154f75]">{title}</h3>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-[#bdd5e7] px-2 py-0.5 text-xl leading-none text-[#346180] transition hover:bg-[#edf6fd]"
            disabled={isProcessing}
            aria-label="Đóng popup xác nhận"
          >
            ×
          </button>
        </div>

        <div className="px-5 py-4 text-sm text-[#284a60]">{message}</div>

        <div className="flex justify-end gap-2 border-t border-[#d2e4f1] px-5 py-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isProcessing}
            className="h-10 rounded-[6px] border border-[#9ec3dd] bg-white px-4 text-sm font-semibold text-[#245977] transition hover:bg-[#edf6fd] disabled:opacity-60"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isProcessing}
            className="h-10 rounded-[6px] bg-[#cc3a3a] px-4 text-sm font-semibold text-white transition hover:bg-[#aa2e2e] disabled:opacity-60"
          >
            {isProcessing ? "Đang xử lý..." : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
