import React, { type HTMLAttributes } from 'react';

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'rectangular' | 'circular' | 'text';
}

export function Skeleton({
  variant = 'rectangular',
  className = '',
  ...rest
}: SkeletonProps) {
  const variantStyles = {
    rectangular: 'rounded-xl',
    circular: 'rounded-full',
    text: 'h-3.5 w-full rounded-md',
  };

  return (
    <div
      className={`animate-pulse bg-night-800/80 ${variantStyles[variant]} ${className}`}
      {...rest}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-line-soft bg-night-850/60 p-5 space-y-3 animate-pulse">
      <div className="flex items-center gap-3">
        <Skeleton variant="circular" className="h-10 w-10 shrink-0" />
        <div className="space-y-1.5 flex-1">
          <Skeleton variant="text" className="w-1/3" />
          <Skeleton variant="text" className="w-1/4" />
        </div>
      </div>
      <Skeleton variant="text" className="w-full" />
      <Skeleton variant="text" className="w-2/3" />
      <div className="flex gap-2 pt-2">
        <Skeleton variant="rectangular" className="h-8 w-20" />
        <Skeleton variant="rectangular" className="h-8 w-20" />
      </div>
    </div>
  );
}

export default Skeleton;
