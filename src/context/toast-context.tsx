"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type ToastType = "success" | "error" | "info";

interface ToastItem {
  id: number;
  type: ToastType;
  title: string;
  message: string;
}

interface ToastPayload {
  title?: string;
  message: string;
  durationMs?: number;
}

interface ToastContextValue {
  showToast: (type: ToastType, payload: ToastPayload) => void;
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const defaultTitleByType: Record<ToastType, string> = {
  success: "Thành công",
  error: "Có lỗi xảy ra",
  info: "Thông báo",
};

const toastStyleByType: Record<ToastType, string> = {
  success:
    "border-[#a6d8b8] bg-[#eefaf2] text-[#1f6e41] shadow-[0_10px_30px_rgba(31,110,65,0.14)]",
  error:
    "border-[#e0b0b0] bg-[#fff4f4] text-[#a03434] shadow-[0_10px_30px_rgba(160,52,52,0.16)]",
  info:
    "border-[#b9d3e7] bg-[#f4faff] text-[#1f5f8d] shadow-[0_10px_30px_rgba(31,95,141,0.14)]",
};

export const ToastProvider = ({ children }: { children: React.ReactNode }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextToastIdRef = useRef(1);
  const timeoutMapRef = useRef<Map<number, number>>(new Map());

  const dismiss = useCallback((id: number) => {
    const timeoutId = timeoutMapRef.current.get(id);
    if (timeoutId) {
      window.clearTimeout(timeoutId);
      timeoutMapRef.current.delete(id);
    }

    setToasts((currentItems) => currentItems.filter((item) => item.id !== id));
  }, []);

  const showToast = useCallback(
    (type: ToastType, payload: ToastPayload) => {
      const id = nextToastIdRef.current++;
      const nextToast: ToastItem = {
        id,
        type,
        title: payload.title || defaultTitleByType[type],
        message: payload.message,
      };

      setToasts((currentItems) => [...currentItems, nextToast]);

      const timeoutId = window.setTimeout(() => {
        dismiss(id);
      }, payload.durationMs ?? 3800);

      timeoutMapRef.current.set(id, timeoutId);
    },
    [dismiss],
  );

  const success = useCallback(
    (message: string, title?: string) => {
      showToast("success", { message, title });
    },
    [showToast],
  );

  const error = useCallback(
    (message: string, title?: string) => {
      showToast("error", { message, title });
    },
    [showToast],
  );

  const info = useCallback(
    (message: string, title?: string) => {
      showToast("info", { message, title });
    },
    [showToast],
  );

  useEffect(() => {
    const timeoutMap = timeoutMapRef.current;

    return () => {
      for (const timeoutId of timeoutMap.values()) {
        window.clearTimeout(timeoutId);
      }
      timeoutMap.clear();
    };
  }, []);

  const contextValue = useMemo<ToastContextValue>(
    () => ({
      showToast,
      success,
      error,
      info,
      dismiss,
    }),
    [dismiss, error, info, showToast, success],
  );

  return (
    <ToastContext.Provider value={contextValue}>
      {children}

      <div className="pointer-events-none fixed right-4 top-4 z-[9999] flex w-full max-w-[360px] flex-col gap-3">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto rounded-[14px] border px-4 py-3 ${toastStyleByType[toast.type]}`}
            role="alert"
            aria-live="polite"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold">{toast.title}</p>
                <p className="mt-1 text-sm leading-5 opacity-95">{toast.message}</p>
              </div>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                className="rounded-full px-2 py-1 text-xs font-semibold transition hover:bg-black/5"
                aria-label="Đóng thông báo"
              >
                Đóng
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextValue => {
  const contextValue = useContext(ToastContext);
  if (!contextValue) {
    throw new Error("useToast phải được dùng trong ToastProvider.");
  }

  return contextValue;
};
