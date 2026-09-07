import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from './Button';

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = 'Unable to Load Data',
  message = 'A network or server error occurred. Please try again.',
  onRetry,
  className = '',
}: ErrorStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-2xl border border-sos/20 bg-sos/5 px-6 py-10 text-center ${className}`}
    >
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-sos/30 bg-sos/15 text-sos shadow-sm">
        <AlertTriangle size={22} />
      </div>
      <h3 className="font-display text-sm font-bold text-ink">{title}</h3>
      <p className="mt-1 max-w-sm text-xs text-mute">{message}</p>
      {onRetry && (
        <div className="mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            leftIcon={<RotateCcw size={13} />}
          >
            Try Again
          </Button>
        </div>
      )}
    </div>
  );
}

export default ErrorState;
