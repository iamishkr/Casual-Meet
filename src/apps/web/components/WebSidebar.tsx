import React from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { useData } from '../../../context/DataContext';
import {
  Home,
  Compass,
  MessageCircle,
  Bell,
  Shield,
  User,
  ShieldAlert,
  LogOut,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { I } from '../../../components/ui';

export default function WebSidebar() {
  const { currentUser, logout, isAdmin, quickLogin } = useAuth();
  const { unreadCount, activeSos, activeTimer } = useData();
  const navigate = useNavigate();

  const navItems = [
    { to: '/app', label: 'Home Feed', icon: Home, end: true },
    { to: '/app/discover', label: 'Discover Nearby', icon: Compass },
    {
      to: '/app/messages',
      label: 'Messages',
      icon: MessageCircle,
      badge: unreadCount > 0 ? unreadCount : undefined,
    },
    { to: '/app/notifications', label: 'Notifications', icon: Bell },
    {
      to: '/app/safety',
      label: 'Safety Center',
      icon: Shield,
      alert: activeSos ? 'sos' : activeTimer ? 'timer' : undefined,
    },
    { to: '/app/profile', label: 'My Profile', icon: User },
  ];

  return (
    <aside className="sticky top-0 flex h-screen w-64 flex-col justify-between border-r border-line-soft bg-night-900/90 p-4 backdrop-blur-xl shrink-0">
      <div className="space-y-6">
        {/* Brand Logo */}
        <Link to="/app" className="flex items-center gap-3 px-2 pt-1">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber/40 bg-amber/10 text-amber shadow-[0_0_20px_-4px_rgba(255,178,36,0.6)]">
            <I.logo size={22} strokeWidth={2} />
          </span>
          <div>
            <div className="font-display text-lg font-extrabold tracking-tight">
              Casual<span className="text-amber">Meet</span>
            </div>
            <p className="font-mono text-[9px] uppercase tracking-wider text-dim">
              Consumer Web
            </p>
          </div>
        </Link>

        {/* Navigation Links */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-all ${
                    isActive
                      ? 'border border-amber/40 bg-amber/15 text-amber font-bold shadow-sm'
                      : 'border border-transparent text-mute hover:bg-night-800/80 hover:text-ink'
                  }`
                }
              >
                <div className="flex items-center gap-3">
                  <Icon size={18} />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span className="rounded-full bg-amber px-2 py-0.5 font-mono text-[10px] font-bold text-night-950">
                    {item.badge}
                  </span>
                )}
                {item.alert === 'sos' && (
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sos opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-sos" />
                  </span>
                )}
                {item.alert === 'timer' && (
                  <span className="h-2 w-2 rounded-full bg-amber shadow-[0_0_8px_rgba(255,178,36,0.8)]" />
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Admin Console Shortcut if authorized */}
        {isAdmin && (
          <div className="pt-2">
            <div className="mb-2 px-2">
              <span className="font-mono text-[9px] uppercase tracking-widest text-dim">
                Operations
              </span>
            </div>
            <Link
              to="/admin"
              className="flex items-center justify-between rounded-xl border border-amber/30 bg-amber/5 px-3.5 py-2.5 text-xs font-bold text-amber hover:bg-amber/15 transition-all"
            >
              <div className="flex items-center gap-3">
                <ShieldAlert size={17} />
                <span>Admin Console</span>
              </div>
              <ExternalLink size={14} className="opacity-70" />
            </Link>
          </div>
        )}

        {/* Development Persona Switcher */}
        <div className="rounded-xl border border-line-soft/60 bg-night-850/50 p-2.5">
          <p className="mb-2 font-mono text-[9px] uppercase tracking-wider text-dim">
            Dev Quick Persona:
          </p>
          <div className="flex gap-1.5">
            {[
              { username: 'aisha.k', name: 'Aisha' },
              { username: 'rohan.m', name: 'Rohan' },
            ].map((p) => {
              const active = currentUser?.username.toLowerCase() === p.username;
              return (
                <button
                  key={p.username}
                  type="button"
                  onClick={() => quickLogin(p.username)}
                  className={`flex-1 rounded-lg py-1 text-center font-mono text-[10px] font-semibold transition-colors ${
                    active
                      ? 'border border-amber/50 bg-amber/20 text-amber font-bold'
                      : 'border border-line bg-night-800 text-mute hover:text-ink'
                  }`}
                >
                  {p.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* User Footer & Sign out */}
      <div className="border-t border-line-soft pt-3">
        <div className="flex items-center justify-between gap-2 rounded-xl bg-night-850/70 p-2 border border-line-soft/40">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-display text-xs font-bold text-night-950"
              style={{
                background: `linear-gradient(135deg, hsl(${currentUser?.avatarHue ?? 200} 85% 68%), hsl(${((currentUser?.avatarHue ?? 200) + 42) % 360} 80% 55%))`,
              }}
            >
              {currentUser?.name?.slice(0, 2).toUpperCase()}
            </div>
            <div className="truncate text-left">
              <p className="truncate text-xs font-bold text-ink">{currentUser?.name}</p>
              <p className="truncate font-mono text-[9px] text-dim">@{currentUser?.username}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              logout();
              navigate('/login');
            }}
            className="rounded-lg p-1.5 text-mute hover:bg-night-750 hover:text-sos transition-colors"
            title="Sign out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
