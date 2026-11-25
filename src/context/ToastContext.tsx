import React, { createContext, useCallback, useContext, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

export type ToastVariant = 'success' | 'error' | 'info' | 'warning';

interface ToastItem {
  id: string;
  title: string;
  message?: string;
  variant: ToastVariant;
}

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
}

interface ToastContextValue {
  notify: (title: string, message?: string, variant?: ToastVariant) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmState, setConfirmState] = useState<{
    options: ConfirmOptions;
    resolve: (value: boolean) => void;
  } | null>(null);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback(
    (title: string, message?: string, variant: ToastVariant = 'info') => {
      const id = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev.slice(-3), { id, title, message, variant }]);
      setTimeout(() => dismiss(id), 4800);
    },
    [dismiss]
  );

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setConfirmState({ options, resolve });
    });
  }, []);

  const handleConfirmChoice = (accepted: boolean) => {
    if (confirmState) {
      confirmState.resolve(accepted);
      setConfirmState(null);
    }
  };

  return (
    <ToastContext.Provider value={{ notify, confirm }}>
      {children}

      {/* Toast stack */}
      <div
        aria-live="polite"
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0"
      >
        {toasts.map((t) => {
          const Icon =
            t.variant === 'success'
              ? CheckCircle2
              : t.variant === 'error' || t.variant === 'warning'
              ? AlertCircle
              : Info;
          const borderClass =
            t.variant === 'success'
              ? 'border-[#087A50]/40 dark:border-[#55D6C2]/40'
              : t.variant === 'error'
              ? 'border-rose-500/40'
              : t.variant === 'warning'
              ? 'border-amber-500/40'
              : 'border-slate-300 dark:border-[#1E4A3D]';
          const iconClass =
            t.variant === 'success'
              ? 'text-[#087A50] dark:text-[#55D6C2]'
              : t.variant === 'error'
              ? 'text-rose-600 dark:text-rose-400'
              : t.variant === 'warning'
              ? 'text-amber-600 dark:text-amber-400'
              : 'text-[#087A50] dark:text-[#55D6C2]';

          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-start gap-3 rounded-xl border ${borderClass} bg-white dark:bg-[#0B271F] p-3.5 shadow-lg text-sm`}
            >
              <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${iconClass}`} />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-[#063B2B] dark:text-white leading-snug">{t.title}</p>
                {t.message && (
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
                    {t.message}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss notification"
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Confirmation dialog */}
      {confirmState && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 dark:border-[#143A2F] bg-white dark:bg-[#0B271F] p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-[#063B2B] dark:text-white">
              {confirmState.options.title}
            </h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {confirmState.options.message}
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => handleConfirmChoice(false)}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 dark:border-[#143A2F] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#113329] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleConfirmChoice(true)}
                className={`px-4 py-2 text-sm font-medium rounded-lg text-white transition-colors ${
                  confirmState.options.destructive
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-[#087A50] hover:bg-[#063B2B]'
                }`}
              >
                {confirmState.options.confirmLabel || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
