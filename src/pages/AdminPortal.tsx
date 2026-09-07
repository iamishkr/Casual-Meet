import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { engine, useEngine } from '../lib/engine';
import AdminConsole from '../components/admin/AdminConsole';
import { Avatar, I, Seg } from '../components/ui';

const SERVICES = [
  { name: 'API Server', note: 'express · zod · jwt' },
  { name: 'MongoDB', note: '2dsphere index' },
  { name: 'Socket.io', note: 'realtime websocket' },
  { name: 'BullMQ', note: 'redis timer jobs' },
];

const ENDPOINTS = [
  'POST /api/auth/register', 'POST /api/auth/login', 'GET /api/discover', 'POST /api/connections/request',
  'PUT /api/connections/:id/accept', 'GET /api/chats/:id/messages', 'POST /api/timers/start', 'PUT /api/timers/:id/safe',
  'POST /api/sos/trigger', 'POST /api/sos/dispatch', 'POST /api/verification/submit', 'GET /api/admin/sos',
  'POST /api/admin/reports/:id/resolve', 'POST /api/admin/users/:id/suspend', 'GET /api/admin/analytics/daily',
];

export default function AdminPortal() {
  const { currentUser, logout } = useAuth();
  const state = useEngine();
  const navigate = useNavigate();

  const [wall, setWall] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setWall(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="scene-bg scene-grid min-h-screen text-ink">
      {/* Top Creator HQ Header */}
      <header className="sticky top-0 z-30 border-b border-line-soft bg-night-900/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1560px] flex-wrap items-center justify-between gap-x-5 gap-y-3 px-5 py-3">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber/40 bg-amber/10 text-amber shadow-[0_0_25px_-6px_rgba(255,178,36,0.6)]">
                <I.shield size={22} strokeWidth={2} />
              </span>
              <div>
                <h1 className="font-display text-[18px] font-extrabold leading-none tracking-tight">
                  Casual<span className="text-amber">Meet</span>
                  <span className="ml-2 rounded border border-amber/40 bg-amber/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-amber">
                    Creator HQ
                  </span>
                </h1>
                <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.2em] text-dim">
                  Trust & Safety Command Center · Live Activity Monitor
                </p>
              </div>
            </Link>

            <div className="hidden items-center gap-2 xl:flex">
              {SERVICES.map((s) => (
                <span key={s.name} className="chip" title={s.note}>
                  <span className="h-1.5 w-1.5 rounded-full bg-safe pulse-dot" /> {s.name}
                </span>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {/* Simulation Clock Controls */}
            <div className="flex items-center gap-2">
              <div className="text-right leading-tight">
                <p className="tick-num font-mono text-[12px] font-bold text-ink">
                  {wall.toLocaleTimeString('en-IN', { hour12: false })}
                </p>
                <p className="font-mono text-[8px] uppercase tracking-widest text-dim">
                  Clock ×{state.timeScale}
                </p>
              </div>
              <Seg
                size="sm"
                value={String(state.timeScale) as '1' | '60' | '600'}
                onChange={(v) => engine.setScale(Number(v) as 1 | 60 | 600)}
                options={[
                  { value: '1', label: '×1 Real' },
                  { value: '60', label: '×60' },
                  { value: '600', label: '×600 Fast' },
                ]}
              />
            </div>

            {/* Switch to User Portal */}
            <Link
              to="/app"
              className="btn-press flex items-center gap-1.5 rounded-xl border border-line-soft bg-night-850 px-3 py-1.5 text-xs font-semibold text-mute hover:border-amber/40 hover:text-amber"
            >
              <I.radar size={13} /> View User App
            </Link>

            {/* Active Admin Profile */}
            <div className="flex items-center gap-2 rounded-xl border border-amber/40 bg-amber/10 py-1 pl-1.5 pr-2.5">
              <Avatar user={currentUser || engine.user('u_kavita')} size={24} />
              <div className="leading-tight">
                <p className="text-[11px] font-bold text-amber">Kavita Rao</p>
                <p className="font-mono text-[8px] uppercase tracking-widest text-dim">super_admin</p>
              </div>
              <button
                onClick={() => { logout(); navigate('/login'); }}
                className="ml-2 rounded p-1 text-dim hover:bg-night-800 hover:text-sos transition-colors"
                title="Sign out"
              >
                <I.ban size={13} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Admin Console Body */}
      <main className="mx-auto max-w-[1560px] px-5 py-6">
        <AdminConsole />

        {/* API Surface Info */}
        <section className="mt-8">
          <div className="panel rounded-xl px-4 py-3.5">
            <div className="mb-2.5 flex items-center gap-2">
              <span className="text-amber"><I.bolt size={14} /></span>
              <p className="font-display text-[13px] font-bold">Backend API Endpoints Under Monitoring</p>
              <span className="chip">Zod validation · JWT verified · MongoDB $geoNear</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {ENDPOINTS.map((e) => (
                <code key={e} className="rounded-md border border-line-soft bg-night-900/70 px-2 py-1 font-mono text-[10px] text-mute hover:border-amber/40 hover:text-amber transition-colors">
                  {e}
                </code>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Telemetry Ticker Footer */}
      <footer className="sticky bottom-0 z-20 border-t border-line-soft bg-night-900/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1560px] items-center gap-3 px-5 py-2">
          <span className="flex shrink-0 items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-widest text-safe">
            <span className="h-1.5 w-1.5 rounded-full bg-safe pulse-dot" /> Live Telemetry
          </span>
          <AdminTicker />
        </div>
      </footer>
    </div>
  );
}

function AdminTicker() {
  const state = useEngine();
  const items = state.feed.slice(0, 12);
  const line = (suffix: string) => (
    <div className="flex shrink-0 items-center" aria-hidden={suffix === 'b'}>
      {items.map((e) => (
        <span key={e.id + suffix} className="flex items-center font-mono text-[10px] text-dim">
          <span className={`mx-3 ${e.tone === 'err' ? 'text-sos' : e.tone === 'warn' ? 'text-amber' : e.tone === 'ok' ? 'text-safe' : 'text-sky'}`}>◆</span>
          <span className={`mr-1.5 font-bold uppercase ${e.tone === 'err' ? 'text-sos/80' : e.tone === 'warn' ? 'text-amber/80' : e.tone === 'ok' ? 'text-safe/80' : 'text-sky/80'}`}>{e.kind}</span>
          {e.text.length > 92 ? e.text.slice(0, 92) + '…' : e.text}
        </span>
      ))}
    </div>
  );
  return (
    <div className="relative min-w-0 flex-1 overflow-hidden">
      <div className="flex w-max" style={{ animation: 'ticker-x 46s linear infinite' }}>
        {line('a')}{line('b')}
      </div>
    </div>
  );
}
