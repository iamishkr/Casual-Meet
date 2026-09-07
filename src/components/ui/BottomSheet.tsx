import React, { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

export interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  snapPoints?: 'auto' | 'half' | 'full';
}

export function BottomSheet({
  open,
  onClose,
  title,
  children,
  snapPoints = 'auto',
}: BottomSheetProps) {
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  if (!open) return null;

  const heightStyles = {
    auto: 'max-h-[85vh]',
    half: 'h-[50vh]',
    full: 'h-[92vh]',
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-night-950/80 backdrop-blur-sm transition-opacity animate-in fade-in"
        onClick={onClose}
      />

      {/* Sheet Content */}
      <div
        className={`relative z-10 w-full ${heightStyles[snapPoints]} overflow-y-auto rounded-t-[28px] border-t border-line-soft bg-night-900 px-5 pb-8 pt-3 text-ink shadow-2xl animate-in slide-in-from-bottom duration-200`}
      >
        {/* Drag Handle Indicator */}
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-dim/60" />

        {title && (
          <div className="mb-4 flex items-center justify-between gap-3 border-b border-line-soft/50 pb-3">
            <h3 className="font-display text-base font-bold text-ink">{title}</h3>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-mute hover:bg-night-800 hover:text-ink transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        )}

        {children}
      </div>
    </div>
  );
}

export default BottomSheet;
