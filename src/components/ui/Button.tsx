import React, { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'safe' | 'outline' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      className = '',
      children,
      disabled,
      ...rest
    },
    ref
  ) => {
    const variantStyles: Record<ButtonVariant, string> = {
      primary:
        'bg-amber text-night-950 font-bold hover:bg-[#ffc14d] shadow-[0_6px_20px_-8px_rgba(255,178,36,0.7)] active:scale-[0.98]',
      secondary:
        'bg-night-800 text-ink border border-line hover:bg-night-750 hover:border-line-soft active:scale-[0.98]',
      danger:
        'bg-sos text-night-950 font-bold hover:bg-[#ff7a80] shadow-[0_6px_20px_-8px_rgba(255,93,100,0.7)] active:scale-[0.98]',
      safe:
        'bg-safe text-night-950 font-bold hover:bg-[#5adca4] shadow-[0_6px_20px_-8px_rgba(46,213,115,0.5)] active:scale-[0.98]',
      outline:
        'border border-line text-ink hover:border-amber/50 hover:text-amber bg-night-850/40 active:scale-[0.98]',
      ghost:
        'text-mute hover:text-ink hover:bg-night-800/80 active:scale-[0.98]',
    };

    const sizeStyles: Record<ButtonSize, string> = {
      sm: 'h-8 px-3 text-xs gap-1.5 rounded-lg',
      md: 'h-10 px-4 text-xs font-semibold gap-2 rounded-xl',
      lg: 'h-12 px-6 text-sm font-bold gap-2.5 rounded-xl',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`inline-flex items-center justify-center transition-all select-none disabled:cursor-not-allowed disabled:opacity-45 ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        {...rest}
      >
        {isLoading ? (
          <span className="flex items-center gap-2">
            <svg
              className="h-4 w-4 animate-spin text-current"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v8H4z"
              />
            </svg>
            <span>Loading...</span>
          </span>
        ) : (
          <>
            {leftIcon && <span className="shrink-0">{leftIcon}</span>}
            {children}
            {rightIcon && <span className="shrink-0">{rightIcon}</span>}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
export default Button;
