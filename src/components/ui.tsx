import { useEffect, useRef, useState, type ReactNode, type CSSProperties } from 'react';
import type { MsgStatus, User } from '../lib/types';
import { initials } from '../lib/utils';

/* ================= custom inline icon set ================= */

type IcProps = { size?: number; className?: string; strokeWidth?: number };
const Svg = ({ size = 16, className, strokeWidth = 1.7, children }: IcProps & { children: ReactNode }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    {children}
  </svg>
);

export const I = {
  logo: (p: IcProps) => (
    <Svg {...p}><path d="M12 2.5 4.5 5.5v6c0 4.6 3 8.2 7.5 9.9 4.5-1.7 7.5-5.3 7.5-9.9v-6L12 2.5Z" /><path d="M8.5 12.2l2.3 2.3 4.7-5" /></Svg>
  ),
  radar: (p: IcProps) => (
    <Svg {...p}><path d="M12 12 18.5 6.8" /><circle cx="12" cy="12" r="2" /><path d="M12 5a7 7 0 1 1-7 7" /><path d="M12 8.2A3.8 3.8 0 1 1 8.2 12" /><path d="M12 2.2A9.8 9.8 0 1 1 2.2 12" /></Svg>
  ),
  link: (p: IcProps) => (
    <Svg {...p}><path d="M9.5 14.5 14.5 9.5" /><path d="M11 6.8 13 4.9a3.6 3.6 0 0 1 5.1 5.1L16.2 12" /><path d="M13 17.2 11 19.1A3.6 3.6 0 0 1 5.9 14L7.8 12" /></Svg>
  ),
  chat: (p: IcProps) => (
    <Svg {...p}><path d="M21 12a8.5 8.5 0 0 1-12.4 7.5L3 21l1.5-5.6A8.5 8.5 0 1 1 21 12Z" /><path d="M8.5 10.5h7M8.5 13.5h4.5" /></Svg>
  ),
  shield: (p: IcProps) => (
    <Svg {...p}><path d="M12 2.8 5 5.6v5.8c0 4.3 2.8 7.7 7 9.3 4.2-1.6 7-5 7-9.3V5.6L12 2.8Z" /><path d="M12 8v4.2M12 15.4v.2" /></Svg>
  ),
  timer: (p: IcProps) => (
    <Svg {...p}><circle cx="12" cy="13" r="8" /><path d="M12 9.5V13l2.5 2.5M9.5 2.5h5M12 2.5V5" /></Svg>
  ),
  sos: (p: IcProps) => (
    <Svg {...p}><path d="M12 3.5 2.8 19.5h18.4L12 3.5Z" /><path d="M12 10v4M12 16.8v.2" /></Svg>
  ),
  pin: (p: IcProps) => (
    <Svg {...p}><path d="M12 21.5s-7-6.1-7-11.3A7 7 0 0 1 19 10.2c0 5.2-7 11.3-7 11.3Z" /><circle cx="12" cy="10" r="2.6" /></Svg>
  ),
  check: (p: IcProps) => <Svg {...p}><path d="M4.5 12.5l5 5L19.5 7" /></Svg>,
  checks: (p: IcProps) => <Svg {...p}><path d="M2.5 12.8l4.2 4.2L15 8.5" /><path d="M11.5 15.2l1.8 1.8L21.5 8.5" /></Svg>,
  send: (p: IcProps) => <Svg {...p}><path d="M21 3.5 3 10.8l6.5 2.7L12.2 20 21 3.5Z" /><path d="M9.5 13.5 21 3.5" /></Svg>,
  x: (p: IcProps) => <Svg {...p}><path d="M6 6l12 12M18 6 6 18" /></Svg>,
  plus: (p: IcProps) => <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>,
  camera: (p: IcProps) => (
    <Svg {...p}><path d="M4 8h2.5l1.8-2.5h7.4L17.5 8H20a1.5 1.5 0 0 1 1.5 1.5V18A1.5 1.5 0 0 1 20 19.5H4A1.5 1.5 0 0 1 2.5 18V9.5A1.5 1.5 0 0 1 4 8Z" /><circle cx="12" cy="13.3" r="3.4" /></Svg>
  ),
  id: (p: IcProps) => (
    <Svg {...p}><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="8.6" cy="11" r="1.8" /><path d="M6 15.6c.6-1.2 1.5-1.8 2.6-1.8s2 .6 2.6 1.8M14 9.8h4M14 13h4" /></Svg>
  ),
  chart: (p: IcProps) => <Svg {...p}><path d="M4 20V4" /><path d="M4 20h16" /><path d="M8.5 16v-5M13 16V7.5M17.5 16v-3" /></Svg>,
  gavel: (p: IcProps) => (
    <Svg {...p}><path d="m13.2 6.2 4.6 4.6M9.4 10 14 14.6M11.3 4.3l6.4 6.4M4 20.5h7M12.6 11.4 6.5 17.5a1.6 1.6 0 0 0 2.3 2.3l6.1-6.1" /></Svg>
  ),
  ban: (p: IcProps) => <Svg {...p}><circle cx="12" cy="12" r="8.5" /><path d="M6 6l12 12" /></Svg>,
  search: (p: IcProps) => <Svg {...p}><circle cx="10.5" cy="10.5" r="6" /><path d="m15.2 15.2 4.8 4.8" /></Svg>,
  chevL: (p: IcProps) => <Svg {...p}><path d="M14.5 5.5 8 12l6.5 6.5" /></Svg>,
  chevD: (p: IcProps) => <Svg {...p}><path d="M5.5 9.5 12 16l6.5-6.5" /></Svg>,
  globe: (p: IcProps) => (
    <Svg {...p}><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c2.4 2.3 3.6 5.1 3.6 8.5s-1.2 6.2-3.6 8.5c-2.4-2.3-3.6-5.1-3.6-8.5s1.2-6.2 3.6-8.5Z" /></Svg>
  ),
  signal: (p: IcProps) => <Svg {...p}><path d="M4.5 19.5v-3M9.5 19.5v-6.5M14.5 19.5V9M19.5 19.5V4.5" /></Svg>,
  eye: (p: IcProps) => (
    <Svg {...p}><path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="2.8" /></Svg>
  ),
  eyeOff: (p: IcProps) => (
    <Svg {...p}><path d="M4 4l16 16" /><path d="M9.9 5.2A9.6 9.6 0 0 1 12 5c6 0 9.5 7 9.5 7a17 17 0 0 1-3.2 4M6.1 8.3A16 16 0 0 0 2.5 12S6 19 12 19a9 9 0 0 0 3.5-.7" /></Svg>
  ),
  lock: (p: IcProps) => <Svg {...p}><rect x="5" y="10.5" width="14" height="9.5" rx="2" /><path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7" /></Svg>,
  phone: (p: IcProps) => (
    <Svg {...p}><path d="M7.6 3.8 9.7 8l-2 1.6a12.4 12.4 0 0 0 6.7 6.7l1.6-2 4.2 2.1-1 3.4c-.3 1-1.3 1.7-2.3 1.5C10.5 19.9 4.1 13.5 2.7 7.1c-.2-1 .5-2 1.5-2.3l3.4-1Z" /></Svg>
  ),
  alert: (p: IcProps) => <Svg {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5v5.2M12 16v.2" /></Svg>,
  refresh: (p: IcProps) => <Svg {...p}><path d="M20 12a8 8 0 1 1-2.3-5.6M20 3.5V8h-4.5" /></Svg>,
  bolt: (p: IcProps) => <Svg {...p}><path d="M13 2.5 4.5 13.5H11l-1 8 8.5-11H12l1-8Z" /></Svg>,
  filter: (p: IcProps) => <Svg {...p}><path d="M4 6h16M7 12h10M10 18h4" /></Svg>,
  users: (p: IcProps) => (
    <Svg {...p}><circle cx="9" cy="8.5" r="3.2" /><path d="M3.5 19.5c.6-3.2 2.7-5 5.5-5s4.9 1.8 5.5 5" /><path d="M15.5 5.8a3.2 3.2 0 0 1 0 5.4M17.8 14.9c1.6.8 2.5 2.4 2.8 4.6" /></Svg>
  ),
  inbox: (p: IcProps) => (
    <Svg {...p}><path d="M3.5 13.5 6 5.8A1.6 1.6 0 0 1 7.5 4.7h9A1.6 1.6 0 0 1 18 5.8l2.5 7.7" /><path d="M3.5 13.5h4.7l1.2 2.3h5.2l1.2-2.3h4.7v4.3a1.6 1.6 0 0 1-1.6 1.6H5.1a1.6 1.6 0 0 1-1.6-1.6v-4.3Z" /></Svg>
  ),
  wifi: (p: IcProps) => (
    <Svg {...p}><path d="M2.5 9a14.5 14.5 0 0 1 19 0" /><path d="M5.5 12.5a10 10 0 0 1 13 0" /><path d="M8.7 15.8a5.4 5.4 0 0 1 6.6 0" /><path d="M12 19.2v.1" /></Svg>
  ),
  battery: (p: IcProps) => (
    <Svg {...p}><rect x="2.5" y="8" width="16" height="8.5" rx="2" /><path d="M21.5 11v2.5" /><rect x="4.5" y="10" width="9" height="4.5" rx="1" fill="currentColor" stroke="none" /></Svg>
  ),
  database: (p: IcProps) => (
    <Svg {...p}><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" /><path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3" /></Svg>
  ),
  alertTriangle: (p: IcProps) => (
    <Svg {...p}><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></Svg>
  ),
};

/* ================= primitives ================= */

const tones: Record<string, string> = {
  ok: 'text-safe border-safe/30 bg-safe/10',
  warn: 'text-amber border-amber/30 bg-amber/10',
  err: 'text-sos border-sos/30 bg-sos/10',
  info: 'text-sky border-sky/30 bg-sky/10',
  dim: 'text-mute border-line bg-night-800/60',
};

export const Badge = ({ tone = 'dim', children, className = '' }: { tone?: string; children: ReactNode; className?: string }) => (
  <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-[10px] tracking-wide uppercase ${tones[tone] ?? tones.dim} ${className}`}>
    {children}
  </span>
);

export const Avatar = ({ user, size = 40, className = '' }: { user: Pick<User, 'name' | 'avatarHue'>; size?: number; className?: string }) => (
  <div
    className={`relative flex shrink-0 items-center justify-center rounded-full font-display font-bold text-night-950 ${className}`}
    style={{
      width: size, height: size, fontSize: size * 0.34,
      background: `linear-gradient(135deg, hsl(${user.avatarHue} 85% 68%), hsl(${(user.avatarHue + 42) % 360} 80% 55%))`,
      boxShadow: `0 0 0 2px rgba(10,16,29,0.9), 0 4px 14px -6px hsl(${user.avatarHue} 80% 45% / 0.7)`,
    }}
  >
    {initials(user.name)}
  </div>
);

export const Btn = ({
  tone = 'ghost', size = 'md', className = '', children, ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'amber' | 'ghost' | 'danger' | 'safe' | 'outline'; size?: 'sm' | 'md' | 'lg' }) => {
  const t = {
    amber: 'bg-amber text-night-950 hover:bg-[#ffc14d] shadow-[0_6px_20px_-8px_rgba(255,178,36,0.7)]',
    danger: 'bg-sos text-night-950 hover:bg-[#ff7a80] shadow-[0_6px_20px_-8px_rgba(255,93,100,0.7)]',
    safe: 'bg-safe text-night-950 hover:bg-[#5adca4]',
    outline: 'border border-line text-ink hover:border-amber/50 hover:text-amber bg-night-800/40',
    ghost: 'text-mute hover:text-ink hover:bg-night-750/70',
  }[tone];
  const s = { sm: 'h-7 px-2.5 text-xs gap-1.5', md: 'h-9 px-3.5 text-[13px] gap-2', lg: 'h-11 px-5 text-sm gap-2' }[size];
  return (
    <button {...rest} className={`btn-press inline-flex items-center justify-center rounded-lg font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${t} ${s} ${className}`}>
      {children}
    </button>
  );
};

export const Modal = ({ open, onClose, title, description, children, wide }: { open: boolean; onClose: () => void; title?: ReactNode; description?: ReactNode; children: ReactNode; wide?: boolean }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div className="anim-fade absolute inset-0 bg-night-950/80 backdrop-blur-sm" onClick={onClose} />
      <div className={`anim-rise panel relative w-full ${wide ? 'max-w-2xl' : 'max-w-md'} rounded-2xl p-5`} style={{ boxShadow: 'var(--shadow-pop)' }}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            {title && <h3 className="font-display text-lg font-bold">{title}</h3>}
            {description && <p className="mt-1 text-xs text-mute">{description}</p>}
          </div>
          <button onClick={onClose} className="btn-press rounded-md p-1.5 text-mute hover:bg-night-750 hover:text-ink"><I.x size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  );
};

export const Toggle = ({ on, onChange, disabled }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) => (
  <button
    onClick={() => !disabled && onChange(!on)}
    className={`btn-press relative h-6 w-11 shrink-0 rounded-full border transition-colors ${on ? 'border-safe/50 bg-safe/25' : 'border-line bg-night-800'} ${disabled ? 'opacity-40' : ''}`}
    aria-pressed={on}
  >
    <span className={`absolute top-0.5 h-[18px] w-[18px] rounded-full transition-all duration-200 ${on ? 'left-[22px] bg-safe' : 'left-0.5 bg-dim'}`} />
  </button>
);

export const Seg = <T extends string>({ options, value, onChange, size = 'md' }: {
  options: { value: T; label: ReactNode }[]; value: T; onChange: (v: T) => void; size?: 'sm' | 'md';
}) => (
  <div className={`inline-flex rounded-lg border border-line-soft bg-night-900/80 p-0.5 ${size === 'sm' ? 'h-7' : 'h-9'}`}>
    {options.map((o) => (
      <button key={o.value} onClick={() => onChange(o.value)}
        className={`btn-press rounded-md px-2.5 text-xs font-semibold transition-colors ${size === 'sm' ? 'text-[11px]' : 'text-xs'} ${value === o.value ? 'bg-night-700 text-ink shadow-sm' : 'text-mute hover:text-ink'}`}>
        {o.label}
      </button>
    ))}
  </div>
);

export const Reveal = ({ children, delay = 0, className = '' }: { children: ReactNode; delay?: number; className?: string }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setInView(true); obs.disconnect(); } }, { threshold: 0.08 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={ref} className={`reveal ${inView ? 'is-in' : ''} ${className}`} style={{ transitionDelay: `${delay}ms` } as CSSProperties}>
      {children}
    </div>
  );
};

export const Ring = ({ progress, size = 168, stroke = 9, color, children }: { progress: number; size?: number; stroke?: number; color: string; children?: ReactNode }) => {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(140,165,210,0.12)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(1, progress)))}
          style={{ transition: 'stroke-dashoffset 0.3s linear, stroke 0.4s ease', filter: `drop-shadow(0 0 8px ${color}66)` }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
};

export const Ticks = ({ status }: { status: MsgStatus }) =>
  status === 'sent' ? <I.check size={13} className="text-dim" /> :
  status === 'delivered' ? <I.checks size={13} className="text-dim" /> :
  <I.checks size={13} className="text-sky" />;

export const SectionHead = ({ icon, title, sub, right }: { icon?: ReactNode; title: string; sub?: string; right?: ReactNode }) => (
  <div className="mb-3 flex items-end justify-between gap-3">
    <div>
      <div className="flex items-center gap-2">
        {icon && <span className="text-amber">{icon}</span>}
        <h2 className="font-display text-[15px] font-bold tracking-tight">{title}</h2>
      </div>
      {sub && <p className="mt-0.5 text-xs text-mute">{sub}</p>}
    </div>
    {right}
  </div>
);

export const Empty = ({ icon, title, sub }: { icon: ReactNode; title: string; sub: string }) => (
  <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line px-4 py-8 text-center">
    <span className="text-dim">{icon}</span>
    <p className="text-[13px] font-semibold text-mute">{title}</p>
    <p className="max-w-[240px] text-xs text-dim">{sub}</p>
  </div>
);

export const Field = ({ label, error, children }: { label: ReactNode; error?: string; children: ReactNode }) => (
  <label className="block">
    <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.12em] text-dim">{label}</span>
    {children}
    {error && <span className="mt-1 block text-[11px] font-medium text-sos">{error}</span>}
  </label>
);

export const inputCls = 'w-full rounded-lg border border-line bg-night-900/80 px-3 py-2 text-[13px] text-ink placeholder:text-dim outline-none transition-colors focus:border-amber/60';

export const MiniBars = ({ data, color, height = 64 }: { data: number[]; color: string; height?: number }) => {
  const max = Math.max(...data, 1);
  const [hover, setHover] = useState<number | null>(null);
  return (
    <div className="relative">
      <div className="flex items-end gap-[3px]" style={{ height }}>
        {data.map((v, i) => (
          <div key={i} className="group relative flex-1 cursor-pointer" style={{ height: '100%' }}
            onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <div
              className={`anim-grow absolute bottom-0 w-full rounded-[3px] transition-opacity ${i === data.length - 1 ? 'opacity-100' : 'opacity-70 group-hover:opacity-100'}`}
              style={{ height: `${Math.max((v / max) * 100, 4)}%`, background: color, animationDelay: `${i * 28}ms`, opacity: hover !== null && hover !== i ? 0.35 : undefined }}
            />
          </div>
        ))}
      </div>
      {hover !== null && (
        <div className="pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 rounded-md border border-line bg-night-800 px-2 py-0.5 font-mono text-[10px] text-ink shadow-lg">
          {data[hover]}
        </div>
      )}
    </div>
  );
};

// Re-export modern design system primitives
export { Button } from './ui/Button';
export { Input } from './ui/Input';
export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './ui/Card';
export { BottomSheet } from './ui/BottomSheet';
export { Tabs } from './ui/Tabs';
export { Skeleton, SkeletonCard } from './ui/Skeleton';
export { EmptyState } from './ui/EmptyState';
export { ErrorState } from './ui/ErrorState';
export { Dropdown } from './ui/Dropdown';
export { Dialog } from './ui/Dialog';
