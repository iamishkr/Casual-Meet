import React, { type ReactNode } from 'react';

export interface TabItem<T extends string = string> {
  id: T;
  label: string;
  icon?: ReactNode;
  badge?: number | string;
}

export interface TabsProps<T extends string = string> {
  tabs: TabItem<T>[];
  activeTab: T;
  onChange: (tabId: T) => void;
  variant?: 'pills' | 'underline' | 'segmented';
  className?: string;
}

export function Tabs<T extends string = string>({
  tabs,
  activeTab,
  onChange,
  variant = 'pills',
  className = '',
}: TabsProps<T>) {
  if (variant === 'segmented') {
    return (
      <div
        className={`inline-flex rounded-xl border border-line-soft bg-night-900/90 p-1 backdrop-blur-md ${className}`}
      >
        {tabs.map((t) => {
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onChange(t.id)}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
                isActive
                  ? 'border border-amber/40 bg-amber/15 text-amber shadow-sm font-bold'
                  : 'text-mute hover:text-ink'
              }`}
            >
              {t.icon && <span className="shrink-0">{t.icon}</span>}
              <span>{t.label}</span>
              {t.badge !== undefined && (
                <span
                  className={`rounded-full px-1.5 py-0.2 font-mono text-[10px] ${
                    isActive ? 'bg-amber text-night-950' : 'bg-night-750 text-mute'
                  }`}
                >
                  {t.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  if (variant === 'underline') {
    return (
      <div className={`flex border-b border-line-soft ${className}`}>
        {tabs.map((t) => {
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onChange(t.id)}
              className={`relative flex items-center gap-2 px-4 py-2.5 text-xs font-semibold transition-colors ${
                isActive ? 'text-amber font-bold' : 'text-mute hover:text-ink'
              }`}
            >
              {t.icon && <span className="shrink-0">{t.icon}</span>}
              <span>{t.label}</span>
              {t.badge !== undefined && (
                <span
                  className={`rounded-full px-1.5 py-0.2 font-mono text-[10px] ${
                    isActive ? 'bg-amber text-night-950' : 'bg-night-750 text-mute'
                  }`}
                >
                  {t.badge}
                </span>
              )}
              {isActive && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber shadow-[0_0_8px_rgba(255,178,36,0.6)]" />
              )}
            </button>
          );
        })}
      </div>
    );
  }

  // Default: pills
  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {tabs.map((t) => {
        const isActive = activeTab === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
              isActive
                ? 'border border-amber/40 bg-amber/15 text-amber shadow-sm font-bold'
                : 'border border-transparent bg-night-800/60 text-mute hover:bg-night-800 hover:text-ink'
            }`}
          >
            {t.icon && <span className="shrink-0">{t.icon}</span>}
            <span>{t.label}</span>
            {t.badge !== undefined && (
              <span
                className={`rounded-full px-1.5 py-0.2 font-mono text-[10px] ${
                  isActive ? 'bg-amber text-night-950' : 'bg-night-750 text-mute'
                }`}
              >
                {t.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default Tabs;
