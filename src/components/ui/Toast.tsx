import React from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastTone = 'ok' | 'warn' | 'err' | 'info';

export interface ToastProps {
  tone?: ToastTone;
  title: string;
  description?: string;
  onClose?: () => void;
}

export function Toast({
  tone = 'info',
  title,
  description,
  onClose,
}: ToastProps) {
  const toneStyles = {
    ok: {
      border: 'border-safe/40 bg-night-900/95 text-safe',
      icon: <CheckCircle2 size={16} className="text-safe" />,
    },
    warn: {
      border: 'border-amber/40 bg-night-900/95 text-amber',
      icon: <AlertTriangle size={16} className="text-amber" />,
    },
    err: {
      border: 'border-sos/40 bg-night-900/95 text-sos',
      icon: <AlertCircle size={16} className="text-sos" />,
    },
    info: {
      border: 'border-sky/40 bg-night-900/95 text-sky',
      icon: <Info size={16} className="text-sky" />,
    },
  }[tone];

  return (
    <div
      className={`flex w-full items-start gap-3 rounded-xl border p-3 shadow-lg backdrop-blur-md ${toneStyles.border}`}
    >
      <span className="shrink-0 mt-0.5">{toneStyles.icon}</span>
      <div className="flex-1 text-left">
        <p className="text-xs font-bold text-ink">{title}</p>
        {description && <p className="mt-0.5 text-[11px] text-mute">{description}</p>}
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded p-1 text-mute hover:text-ink transition-colors"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

export default Toast;
