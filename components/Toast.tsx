"use client";

// Minimal toast component, no external deps. Mounted once at the dashboard
// layout so toasts persist while the user navigates between tabs (uploads
// keep running in the background; the toast updates in place).
//
// Usage:
//   const { showToast, updateToast, dismissToast } = useToast();
//   const id = showToast({ kind: "info", message: "Uploading 0 of 10…" });
//   updateToast(id, { kind: "info", message: "Uploading 3 of 10…" });
//   updateToast(id, { kind: "success", message: "✅ 10 receipts submitted", autoDismissMs: 3000 });

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

type ToastKind = "info" | "success" | "error";

type Toast = {
  id: number;
  kind: ToastKind;
  message: string;
  autoDismissMs?: number;
};

type ToastContextValue = {
  showToast: (t: Omit<Toast, "id">) => number;
  updateToast: (id: number, patch: Omit<Toast, "id">) => void;
  dismissToast: (id: number) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const armTimer = useCallback(
    (id: number, ms?: number) => {
      const existing = timers.current.get(id);
      if (existing) clearTimeout(existing);
      if (ms && ms > 0) {
        const t = setTimeout(() => dismissToast(id), ms);
        timers.current.set(id, t);
      }
    },
    [dismissToast]
  );

  const showToast = useCallback(
    (t: Omit<Toast, "id">) => {
      const id = nextId.current++;
      setToasts((prev) => [...prev, { id, ...t }]);
      armTimer(id, t.autoDismissMs);
      return id;
    },
    [armTimer]
  );

  const updateToast = useCallback(
    (id: number, patch: Omit<Toast, "id">) => {
      setToasts((prev) => prev.map((t) => (t.id === id ? { id, ...patch } : t)));
      armTimer(id, patch.autoDismissMs);
    },
    [armTimer]
  );

  useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach((t) => clearTimeout(t));
      map.clear();
    };
  }, []);

  const value = useMemo(
    () => ({ showToast, updateToast, dismissToast }),
    [showToast, updateToast, dismissToast]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto min-w-[260px] max-w-sm rounded-lg shadow-lg px-4 py-3 text-sm font-medium flex items-start gap-2 animate-toast-in ${
              t.kind === "success"
                ? "bg-green-600 text-white"
                : t.kind === "error"
                ? "bg-red-600 text-white"
                : "bg-gray-900 dark:bg-gray-700 text-white"
            }`}
          >
            <span className="flex-1 whitespace-pre-line">{t.message}</span>
            <button
              onClick={() => dismissToast(t.id)}
              aria-label="Dismiss"
              className="opacity-70 hover:opacity-100 -mr-1 leading-none"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <style jsx>{`
        @keyframes toast-in {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        :global(.animate-toast-in) {
          animation: toast-in 160ms ease-out;
        }
      `}</style>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Allow components to render in non-toast contexts (e.g. tests, storybook)
    // by giving a safe noop fallback.
    return {
      showToast: () => 0,
      updateToast: () => {},
      dismissToast: () => {},
    };
  }
  return ctx;
}
