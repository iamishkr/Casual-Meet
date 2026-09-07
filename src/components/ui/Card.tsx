import React, { type HTMLAttributes, type ReactNode } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'glass' | 'interactive';
}

export function Card({
  variant = 'default',
  className = '',
  children,
  ...rest
}: CardProps) {
  const variantStyles = {
    default: 'border border-line-soft bg-night-850/80 shadow-md backdrop-blur-sm',
    glass: 'border border-line/70 bg-night-900/60 shadow-xl backdrop-blur-md',
    interactive:
      'border border-line-soft bg-night-850/80 shadow-md backdrop-blur-sm hover:border-amber/40 hover:bg-night-800 transition-all cursor-pointer',
  };

  return (
    <div
      className={`rounded-2xl p-5 ${variantStyles[variant]} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  className = '',
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`mb-3.5 flex items-center justify-between gap-3 ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function CardTitle({
  className = '',
  children,
  ...rest
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={`font-display text-base font-bold tracking-tight text-ink ${className}`}
      {...rest}
    >
      {children}
    </h3>
  );
}

export function CardDescription({
  className = '',
  children,
  ...rest
}: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={`text-xs text-mute ${className}`} {...rest}>
      {children}
    </p>
  );
}

export function CardContent({
  className = '',
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={className} {...rest}>
      {children}
    </div>
  );
}

export function CardFooter({
  className = '',
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`mt-4 flex items-center justify-between gap-3 border-t border-line-soft/60 pt-3.5 ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

export default Card;
