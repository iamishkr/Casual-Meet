import React, { type ReactNode } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary' | 'safe';
  onConfirm: () => void;
  isLoading?: boolean;
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'primary',
  onConfirm,
  isLoading = false,
}: DialogProps) {
  return (
    <Modal open={open} onClose={onClose} size="sm">
      <div className="space-y-3">
        <h3 className="font-display text-base font-bold text-ink">{title}</h3>
        <p className="text-xs text-mute leading-relaxed">{description}</p>
        <div className="mt-5 flex items-center justify-end gap-2.5 pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={isLoading}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={variant}
            size="sm"
            onClick={onConfirm}
            isLoading={isLoading}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default Dialog;
