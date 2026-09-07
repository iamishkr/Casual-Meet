import React, { createContext, useContext, useState, useCallback } from 'react';
import type { Toast } from '../lib/types';
import { I } from '../components/ui';

interface ToastContextType {
  toasts: Toast[];
  toast: (tone: 'ok' | 'warn' | 'err' | 'info', title: string, sub?: string) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (tone: 'ok' | 'warn' | 'err' | 'info', title: string, sub?: string) => {
      const id = `t_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const newToast: Toast = { id, tone, title, sub };
      setToasts((prev) => [...prev.slice(-4), newToast]); // keep at most 5

      setTimeout(() => {
        removeToast(id);
      }, 4000);
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ toasts, toast, removeToast }}>
      {children}

      {/* Global Toast Overlay */}
      <div className="pointer-events-none fixed right-4 top-4 z-[99] flex w-[320px] flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`anim-slide-r pointer-events-auto rounded-xl border p-3 backdrop-blur-md transition-all ${
              t.tone === 'err'
                ? 'border-sos/50 bg-[#2a1116]/95'
                : t.tone === 'warn'
                ? 'border-amber/50 bg-[#2a2010]/95'
                : t.tone === 'ok'
                ? 'border-safe/50 bg-[#0e241c]/95'
                : 'border-sky/50 bg-[#0e1d2a]/95'
            }`}
            style={{ boxShadow: 'var(--shadow-pop)' }}
            onClick={() => removeToast(t.id)}
          >
            <p
              className={`flex items-center gap-1.5 text-[12px] font-bold ${
                t.tone === 'err'
                  ? 'text-sos'
                  : t.tone === 'warn'
                  ? 'text-amber'
                  : t.tone === 'ok'
                  ? 'text-safe'
                  : 'text-sky'
              }`}
            >
              {t.tone === 'err' ? (
                <I.sos size={13} />
              ) : t.tone === 'warn' ? (
                <I.alert size={13} />
              ) : t.tone === 'ok' ? (
                <I.check size={13} />
              ) : (
                <I.bolt size={13} />
              )}
              {t.title}
            </p>
            {t.sub && <p className="mt-0.5 pl-5 text-[11px] leading-snug text-mute">{t.sub}</p>}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}

export const useToasts = useToast;
