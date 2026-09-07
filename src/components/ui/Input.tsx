import React, { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode;
  error?: string;
  helperText?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, leftIcon, rightIcon, className = '', id, ...rest }, ref) => {
    const inputId = id || (typeof label === 'string' ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="mb-1.5 block font-mono text-[11px] font-semibold uppercase tracking-wider text-dim"
          >
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <span className="pointer-events-none absolute left-3 text-mute">
              {leftIcon}
            </span>
          )}
          <input
            id={inputId}
            ref={ref}
            className={`w-full rounded-xl border bg-night-900/90 text-xs text-ink placeholder:text-dim outline-none transition-all focus:border-amber/60 focus:ring-1 focus:ring-amber/40 ${
              leftIcon ? 'pl-9' : 'px-3.5'
            } ${rightIcon ? 'pr-9' : 'px-3.5'} py-2.5 ${
              error ? 'border-sos focus:border-sos focus:ring-sos/30' : 'border-line'
            } ${className}`}
            {...rest}
          />
          {rightIcon && (
            <span className="absolute right-3 text-mute flex items-center">
              {rightIcon}
            </span>
          )}
        </div>
        {error ? (
          <p className="mt-1 text-[11px] font-medium text-sos animate-in fade-in">{error}</p>
        ) : helperText ? (
          <p className="mt-1 text-[11px] text-mute">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';
export default Input;
