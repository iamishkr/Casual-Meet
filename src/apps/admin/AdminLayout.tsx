import React, { useState, useEffect, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Avatar, I } from '../../components/ui';
import {
  Shield,
  ShieldAlert,
  Users,
  Activity,
  Database,
  ExternalLink,
  Laptop,
  Smartphone,
  LogOut,
} from 'lucide-react';

const SERVICES = [
  { name: 'API Server', note: 'express · zod · jwt' },
  { name: 'MongoDB', note: '2dsphere index' },
  { name: 'Socket.io', note: 'realtime websocket' },
  { name: 'Timer Worker', note: 'server safety worker' },
];

export interface AdminLayoutProps {
  children: ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  const [wall, setWall] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setWall(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="scene-bg scene-grid min-h-screen text-ink flex flex-col">
      {/* Top Creator / Safety Command Bar */}
      <header className="sticky top-0 z-30 border-b border-line-soft bg-night-900/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-x-5 gap-y-3 px-6 py-3">
          {/* Brand & Service Status */}
          <div className="flex items-center gap-4">
            <Link to="/admin" className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber/40 bg-amber/10 text-amber shadow-[0_0_25px_-6px_rgba(255,178,36,0.6)]">
                <I.shield size={22} strokeWidth={2} />
              </span>
              <div>
                <h1 className="font-display text-lg font-extrabold leading-none tracking-tight">
                  Casual<span className="text-amber">Meet</span>
                  <span className="ml-2 rounded border border-amber/40 bg-amber/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-amber">
                    Creator Admin HQ
                  </span>
                </h1>
                <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-dim">
                  Trust & Safety Command Center · Live Operations
                </p>
              </div>
            </Link>

            <div className="hidden items-center gap-2 lg:flex pl-3 border-l border-line-soft">
              {SERVICES.map((s) => (
                <span key={s.name} className="chip text-[10px]" title={s.note}>
                  <span className="h-1.5 w-1.5 rounded-full bg-safe pulse-dot" /> {s.name}
                </span>
              ))}
            </div>
          </div>

          {/* Right Action Bar */}
          <div className="flex items-center gap-3">
            {/* Live Clock */}
            <div className="hidden sm:block text-right leading-tight pr-3 border-r border-line-soft">
              <p className="font-mono text-xs font-bold text-ink">
                {wall.toLocaleTimeString('en-IN', { hour12: false })} IST
              </p>
              <p className="font-mono text-[8px] uppercase tracking-widest text-dim">
                Authoritative Server Clock
              </p>
            </div>

            {/* Link to Consumer Web App */}
            <Link
              to="/app"
              className="btn-press flex items-center gap-1.5 rounded-xl border border-line-soft bg-night-850 px-3 py-1.5 text-xs font-semibold text-mute hover:border-amber/40 hover:text-amber transition-all"
              title="View Consumer Web Experience"
            >
              <Laptop size={14} />
              <span className="hidden sm:inline">Web App</span>
            </Link>

            {/* Link to Consumer Mobile App */}
            <Link
              to="/mobile"
              className="btn-press flex items-center gap-1.5 rounded-xl border border-line-soft bg-night-850 px-3 py-1.5 text-xs font-semibold text-mute hover:border-amber/40 hover:text-amber transition-all"
              title="View Consumer Mobile Experience"
            >
              <Smartphone size={14} />
              <span className="hidden sm:inline">Mobile App</span>
            </Link>

            {/* Active Admin Profile */}
            <div className="flex items-center gap-2 rounded-xl border border-amber/40 bg-amber/10 py-1 pl-1.5 pr-2.5">
              {currentUser && <Avatar user={currentUser} size={26} />}
              <div className="leading-tight text-left">
                <p className="text-xs font-bold text-amber">{currentUser?.name || 'Administrator'}</p>
                <p className="font-mono text-[8px] uppercase tracking-widest text-dim">
                  {currentUser?.role || 'super_admin'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  logout();
                  navigate('/login');
                }}
                className="ml-2 rounded p-1 text-dim hover:bg-night-750 hover:text-sos transition-colors"
                title="Sign out"
              >
                <LogOut size={14} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Admin Workspace */}
      <main className="mx-auto max-w-[1600px] w-full flex-1 px-4 py-6 sm:px-6">
        {children}
      </main>
    </div>
  );
}
