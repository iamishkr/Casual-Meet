import React, { type HTMLAttributes, type ReactNode } from 'react';

export type BadgeTone = 'amber' | 'safe' | 'danger' | 'sky' | 'slate';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  dot?: boolean;
  children: ReactNode;
}

export function Badge({
  tone = 'slate',
  dot = false,
  className = '',
  children,
  ...rest
}: BadgeProps) {
  const toneStyles: Record<BadgeTone, { container: string; dot: string }> = {
    amber: {
      container: 'border-amber/40 bg-amber/15 text-amber',
      dot: 'bg-amber',
    },
    safe: {
      container: 'border-safe/40 bg-safe/15 text-safe',
      dot: 'bg-safe',
    },
    danger: {
      container: 'border-sos/40 bg-sos/15 text-sos',
      dot: 'bg-sos',
    },
    sky: {
      container: 'border-sky/40 bg-sky/15 text-sky',
      dot: 'bg-sky',
    },
    slate: {
      container: 'border-line bg-night-800 text-mute',
      dot: 'bg-mute',
    },
  };

  const style = toneStyles[tone] || toneStyles.slate;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider ${style.container} ${className}`}
      {...rest}
    >
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />}
      {children}
    </span>
  );
}

export default Badge;
