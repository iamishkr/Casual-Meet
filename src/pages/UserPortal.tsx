import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { api } from '../lib/api';
import PhoneApp from '../components/phone/PhoneApp';
import DiscoverScreen from '../components/phone/DiscoverScreen';
import ChatScreen from '../components/phone/ChatScreen';
import SafetyScreen from '../components/phone/SafetyScreen';
import ProfileScreen from '../components/phone/ProfileScreen';
import { Avatar, Badge, I } from '../components/ui';
import { fmtCountdown } from '../lib/utils';
import { Zap } from 'lucide-react';
import type { EmergencyContactDTO, SafeZoneDTO } from '../lib/types';

type NavTab = 'discover' | 'chats' | 'safety' | 'profile';
type ViewMode = 'web' | 'split' | 'mobile';

export default function UserPortal() {
  const { currentUser, logout, isAdmin, quickLogin } = useAuth();
  const { activeSos, activeTimer, unreadCount, markTimerSafe, extendTimer } = useData();
  const navigate = useNavigate();

  const [viewMode, setViewMode] = useState<ViewMode>(() =>
    typeof window !== 'undefined' && window.innerWidth < 1024 ? 'web' : 'split'
  );
  const [tab, setTab] = useState<NavTab>('discover');
  const [threadId, setThreadId] = useState<string | null>(null);
  const [safetyMode, setSafetyMode] = useState<'timer' | 'sos'>('timer');
  const [contacts, setContacts] = useState<EmergencyContactDTO[]>([]);
  const [safeZones, setSafeZones] = useState<SafeZoneDTO[]>([]);
  const [visualClock, setVisualClock] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setVisualClock(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (currentUser) {
      api.contacts.list().then(setContacts).catch(() => {});
      api.safeZones.list().then(setSafeZones).catch(() => {});
    }
  }, [currentUser]);

  const goChat = (userId: string) => {
    setTab('chats');
  };

  const navItems: {
    id: NavTab;
    label: string;
    icon: (p: { size?: number }) => React.ReactNode;
    badge?: number;
  }[] = [
    { id: 'discover', label: 'Discover Nearby', icon: (p) => <I.radar {...p} /> },
    {
      id: 'chats',
      label: 'Conversations',
      icon: (p) => <I.chat {...p} />,
      badge: unreadCount > 0 ? unreadCount : undefined,
    },
    {
      id: 'safety',
      label: 'Safety & Meet Timers',
      icon: (p) => <I.shield {...p} />,
      badge: activeSos ? 1 : undefined,
    },
    { id: 'profile', label: 'My Safety Profile', icon: (p) => <I.id {...p} /> },
  ];

  if (!currentUser) return null;

  const timerRemain = activeTimer
    ? Math.max(0, new Date(activeTimer.expiresAt).getTime() - visualClock)
    : 0;

  return (
    <div className="scene-bg scene-grid min-h-screen text-ink">
      {/* Top Application Bar */}
      <header className="sticky top-0 z-30 border-b border-line-soft bg-night-900/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1560px] flex-wrap items-center justify-between gap-3 px-5 py-3">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber/40 bg-amber/10 text-amber shadow-[0_0_20px_-4px_rgba(255,178,36,0.6)]">
                <I.logo size={20} strokeWidth={2} />
              </span>
              <div>
                <span className="font-display text-base font-extrabold tracking-tight">
                  Casual<span className="text-amber">Meet</span>
                </span>
                <span className="ml-2 hidden font-mono text-[9px] uppercase tracking-wider text-dim sm:inline">
                  User Portal
                </span>
              </div>
            </Link>

            {/* View Mode Switcher */}
            <div className="ml-3 flex rounded-lg border border-line-soft bg-night-850 p-0.5">
              <button
                type="button"
                id="btn-view-web"
                onClick={() => setViewMode('web')}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-all ${
                  viewMode === 'web' ? 'bg-night-700 text-ink shadow-sm' : 'text-mute hover:text-ink'
                }`}
                title="Full-page Web App Layout"
              >
                <I.globe size={13} /> <span className="hidden sm:inline">Web App</span>
              </button>
              <button
                type="button"
                id="btn-view-split"
                onClick={() => setViewMode('split')}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-all ${
                  viewMode === 'split'
                    ? 'border border-amber/50 bg-amber/15 text-amber font-bold shadow-sm'
                    : 'text-mute hover:text-ink'
                }`}
                title="Live Dual Sync: Web & Mobile Side-by-Side"
              >
                <Zap size={13} className={viewMode === 'split' ? 'text-amber' : ''} />
                <span className="hidden sm:inline">Dual Sync</span>
              </button>
              <button
                type="button"
                id="btn-view-mobile"
                onClick={() => setViewMode('mobile')}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-all ${
                  viewMode === 'mobile' ? 'bg-night-700 text-amber shadow-sm' : 'text-mute hover:text-ink'
                }`}
                title="Mobile Phone Simulator Layout"
              >
                <I.phone size={13} /> <span className="hidden sm:inline">Mobile Frame</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Real Backend Persona Switcher for Development Testing */}
            <div className="hidden items-center gap-1.5 md:flex">
              <span className="font-mono text-[9px] uppercase tracking-widest text-dim">
                User:
              </span>
              {[
                { username: 'aisha.k', name: 'Aisha' },
                { username: 'rohan.m', name: 'Rohan' },
              ].map((p) => {
                const isCurrent = currentUser.username.toLowerCase() === p.username;
                return (
                  <button
                    key={p.username}
                    type="button"
                    id={`persona-btn-${p.username}`}
                    onClick={() => quickLogin(p.username)}
                    className={`btn-press flex items-center gap-1.5 rounded-lg border py-0.5 px-2 text-xs transition-colors ${
                      isCurrent
                        ? 'border-amber/50 bg-amber/10 text-amber font-bold'
                        : 'border-line-soft bg-night-850 text-mute hover:border-line'
                    }`}
                  >
                    <span>{p.name}</span>
                  </button>
                );
              })}
            </div>

            {/* Admin link if administrator */}
            {isAdmin && (
              <Link
                to="/admin"
                className="btn-press flex items-center gap-1.5 rounded-lg border border-amber/40 bg-amber/10 px-2.5 py-1 text-xs font-bold text-amber hover:bg-amber/20"
              >
                <I.shield size={13} /> Admin Console
              </Link>
            )}

            {/* User profile dropdown pill */}
            <div className="flex items-center gap-2 rounded-xl border border-line-soft bg-night-850 py-1 pl-1.5 pr-2.5">
              <Avatar user={currentUser} size={26} />
              <div className="leading-tight text-left">
                <p className="flex items-center gap-1 text-xs font-bold">
                  {currentUser.name}
                  {currentUser.isVerified && (
                    <span className="text-sky">
                      <I.logo size={11} strokeWidth={2.4} />
                    </span>
                  )}
                </p>
                <p className="font-mono text-[9px] text-dim">@{currentUser.username}</p>
              </div>
              <button
                onClick={() => {
                  logout();
                  navigate('/login');
                }}
                className="ml-2 rounded p-1 text-dim hover:bg-night-750 hover:text-sos transition-colors"
                title="Sign out"
              >
                <I.ban size={14} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">
        {viewMode === 'mobile' ? (
          /* Focused Mobile Device Frame Simulation */
          <div className="flex flex-col items-center justify-center py-4 animate-in fade-in duration-200">
            <PhoneApp />
          </div>
        ) : viewMode === 'split' ? (
          /* Live Dual Synchronized Workspace: Web App & Mobile Phone Simulator Side-by-Side */
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_400px] animate-in fade-in duration-200">
            {/* Left: Web Portal Experience */}
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-[200px_1fr]">
                {/* Left Sidebar Navigation */}
                <aside className="panel flex flex-row justify-around rounded-2xl p-2.5 lg:flex-col lg:justify-start lg:gap-1.5 lg:p-3.5">
                  <div className="mb-2 hidden px-2 lg:block">
                    <p className="font-mono text-[9px] uppercase tracking-widest text-dim">
                      Web Navigation
                    </p>
                  </div>

                  {navItems.map((item) => {
                    const active = tab === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        id={`web-nav-${item.id}`}
                        onClick={() => {
                          setTab(item.id);
                          if (item.id !== 'chats') setThreadId(null);
                          if (item.id === 'safety') setSafetyMode(activeSos ? 'sos' : 'timer');
                        }}
                        className={`btn-press flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-semibold transition-all ${
                          active
                            ? 'border border-amber/40 bg-amber/15 text-amber font-bold shadow-sm'
                            : 'border border-transparent text-mute hover:bg-night-800 hover:text-ink'
                        }`}
                      >
                        <span className="relative">
                          {item.icon({ size: 17 })}
                          {item.id === 'safety' && activeSos && (
                            <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-sos pulse-dot" />
                          )}
                        </span>
                        <span className="hidden sm:inline">{item.label}</span>
                        {item.badge ? (
                          <span className="ml-auto rounded-full bg-amber px-1.5 py-0.2 font-mono text-[10px] font-bold text-night-950">
                            {item.badge}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}

                  <div className="my-2.5 hidden border-t border-line-soft lg:block" />

                  {/* Panic SOS Trigger */}
                  <div className="hidden lg:block">
                    <button
                      type="button"
                      id="btn-web-sos"
                      onClick={() => {
                        setTab('safety');
                        setSafetyMode('sos');
                      }}
                      className={`btn-press flex w-full items-center justify-center gap-2 rounded-xl border border-sos/50 py-2.5 font-display text-xs font-extrabold tracking-wider ${
                        activeSos
                          ? 'bg-sos text-night-950 shadow-[0_0_24px_rgba(255,93,100,0.6)] animate-pulse'
                          : 'bg-sos/15 text-sos hover:bg-sos hover:text-night-950'
                      }`}
                    >
                      <I.sos size={15} /> EMERGENCY SOS
                    </button>
                  </div>
                </aside>

                {/* Center Content Panel */}
                <section className="panel min-h-[660px] rounded-3xl p-4 sm:p-6 shadow-xl">
                  {tab === 'discover' && <DiscoverScreen goChat={goChat} />}
                  {tab === 'chats' && <ChatScreen threadId={threadId} openThread={setThreadId} />}
                  {tab === 'safety' && <SafetyScreen mode={safetyMode} setMode={setSafetyMode} />}
                  {tab === 'profile' && <ProfileScreen />}
                </section>
              </div>

              {/* Bottom Quick Safety Status Bar in Split Mode */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Active Meeting Timer */}
                <div className="panel rounded-2xl p-3.5">
                  <div className="flex items-center justify-between border-b border-line-soft pb-2">
                    <span className="flex items-center gap-1.5 text-xs font-bold">
                      <I.timer size={13} className="text-amber" /> Authoritative Safety
                    </span>
                    <Badge tone={activeSos ? 'err' : activeTimer ? 'warn' : 'ok'}>
                      {activeSos ? 'SOS ALERT' : activeTimer ? 'TIMER ON' : 'IDLE / SAFE'}
                    </Badge>
                  </div>
                  {activeTimer ? (
                    <div className="pt-2 text-center">
                      <p className="font-display text-xs font-bold text-ink">
                        {activeTimer.locationName}
                      </p>
                      <p className="font-mono text-base font-extrabold text-amber">
                        {fmtCountdown(timerRemain)}
                      </p>
                      <div className="mt-2 flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => markTimerSafe(activeTimer._id)}
                          className="btn-press flex-1 rounded-lg bg-safe py-1 text-xs font-bold text-night-950"
                        >
                          I'm Safe
                        </button>
                        <button
                          type="button"
                          onClick={() => extendTimer(activeTimer._id, 15)}
                          className="btn-press flex-1 rounded-lg border border-line-soft bg-night-800 py-1 text-xs font-semibold text-mute hover:text-ink"
                        >
                          +15 min
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="pt-2 text-center">
                      <p className="text-[11px] text-mute">No timers active.</p>
                      <button
                        type="button"
                        onClick={() => {
                          setTab('safety');
                          setSafetyMode('timer');
                        }}
                        className="btn-press mt-1 w-full rounded-lg border border-amber/40 bg-amber/10 py-1 text-xs font-bold text-amber hover:bg-amber/20"
                      >
                        Arm Meeting Timer
                      </button>
                    </div>
                  )}
                </div>

                {/* Emergency Circle */}
                <div className="panel rounded-2xl p-3.5">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs font-bold">
                      <I.phone size={13} className="text-sky" /> Emergency Contacts
                    </span>
                    <span className="font-mono text-[10px] text-dim">{contacts.length}/5</span>
                  </div>
                  <div className="space-y-1">
                    {contacts.slice(0, 2).map((c) => (
                      <div
                        key={c._id}
                        className="flex items-center justify-between rounded-lg border border-line-soft bg-night-900/60 px-2 py-1 text-xs"
                      >
                        <span className="truncate font-semibold text-ink">{c.name}</span>
                        <span className="font-mono text-[9px] text-safe">SMS ready</span>
                      </div>
                    ))}
                    {contacts.length === 0 && (
                      <p className="text-[11px] text-mute">No contacts configured on backend.</p>
                    )}
                  </div>
                </div>

                {/* Verified Safe Zones */}
                <div className="panel rounded-2xl p-3.5">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs font-bold">
                      <I.shield size={13} className="text-safe" /> Safe Meeting Zones
                    </span>
                    <span className="font-mono text-[10px] text-dim">{safeZones.length} verified</span>
                  </div>
                  <div className="space-y-1">
                    {safeZones.slice(0, 2).map((z) => (
                      <div
                        key={z.id}
                        className="flex items-center justify-between rounded-lg border border-line-soft bg-night-900/60 px-2 py-1 text-xs"
                      >
                        <span className="truncate font-semibold text-ink">{z.name}</span>
                        <span className="font-mono text-[9px] text-amber uppercase">
                          {z.category.replace('_', ' ')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Live Synced Mobile Phone Simulator */}
            <div className="hidden xl:flex flex-col items-center">
              <div className="sticky top-20 flex flex-col items-center">
                <PhoneApp />
              </div>
            </div>
          </div>
        ) : (
          /* Full Responsive Web Application Layout */
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_1fr_320px] animate-in fade-in duration-200">
            {/* Left Sidebar Navigation */}
            <aside className="panel flex flex-row justify-around rounded-2xl p-2.5 lg:flex-col lg:justify-start lg:gap-1.5 lg:p-4">
              <div className="mb-2 hidden px-2 lg:block">
                <p className="font-mono text-[9px] uppercase tracking-widest text-dim">
                  Navigation
                </p>
              </div>

              {navItems.map((item) => {
                const active = tab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setTab(item.id);
                      if (item.id !== 'chats') setThreadId(null);
                      if (item.id === 'safety') setSafetyMode(activeSos ? 'sos' : 'timer');
                    }}
                    className={`btn-press flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-all ${
                      active
                        ? 'bg-amber/10 border border-amber/40 text-amber'
                        : 'border border-transparent text-mute hover:bg-night-800 hover:text-ink'
                    }`}
                  >
                    <span className="relative">
                      {item.icon({ size: 18 })}
                      {item.id === 'safety' && activeSos && (
                        <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-sos pulse-dot" />
                      )}
                    </span>
                    <span className="hidden sm:inline">{item.label}</span>
                    {item.badge ? (
                      <span className="ml-auto rounded-full bg-amber px-1.5 py-0.2 font-mono text-[10px] font-bold text-night-950">
                        {item.badge}
                      </span>
                    ) : null}
                  </button>
                );
              })}

              <div className="my-3 hidden border-t border-line-soft lg:block" />

              {/* Quick Panic Button in sidebar */}
              <div className="hidden lg:block">
                <button
                  type="button"
                  onClick={() => {
                    setTab('safety');
                    setSafetyMode('sos');
                  }}
                  className={`btn-press flex w-full items-center justify-center gap-2 rounded-xl border border-sos/50 py-3 font-display text-xs font-extrabold tracking-wider ${
                    activeSos
                      ? 'bg-sos text-night-950 shadow-[0_0_30px_rgba(255,93,100,0.6)] animate-pulse'
                      : 'bg-sos/15 text-sos hover:bg-sos hover:text-night-950'
                  }`}
                >
                  <I.sos size={16} /> EMERGENCY SOS
                </button>
              </div>
            </aside>

            {/* Center Content Panel */}
            <section className="panel min-h-[640px] rounded-3xl p-4 sm:p-6">
              {tab === 'discover' && <DiscoverScreen goChat={goChat} />}
              {tab === 'chats' && <ChatScreen threadId={threadId} openThread={setThreadId} />}
              {tab === 'safety' && <SafetyScreen mode={safetyMode} setMode={setSafetyMode} />}
              {tab === 'profile' && <ProfileScreen />}
            </section>

            {/* Right Quick Safety Status Panel */}
            <aside className="space-y-4">
              {/* Meeting Timer Status Widget */}
              <div className="panel rounded-2xl p-4">
                <div className="flex items-center justify-between border-b border-line-soft pb-2.5">
                  <span className="flex items-center gap-2 text-xs font-bold">
                    <I.timer size={14} className="text-amber" /> Active Safety State
                  </span>
                  <Badge tone={activeSos ? 'err' : activeTimer ? 'warn' : 'ok'}>
                    {activeSos ? 'SOS ALERT' : activeTimer ? 'TIMER ON' : 'IDLE / SAFE'}
                  </Badge>
                </div>

                {activeTimer ? (
                  <div className="pt-3 text-center">
                    <p className="text-xs text-mute">Meeting in progress</p>
                    <p className="font-display text-sm font-bold text-ink">
                      {activeTimer.locationName}
                    </p>
                    <p className="mt-1 font-mono text-xl font-extrabold text-amber">
                      {fmtCountdown(timerRemain)}
                    </p>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => markTimerSafe(activeTimer._id)}
                        className="btn-press flex-1 rounded-lg bg-safe py-1.5 text-xs font-bold text-night-950"
                      >
                        I'm Safe
                      </button>
                      <button
                        type="button"
                        onClick={() => extendTimer(activeTimer._id, 15)}
                        className="btn-press flex-1 rounded-lg border border-line-soft bg-night-800 py-1.5 text-xs font-semibold text-mute hover:text-ink"
                      >
                        +15 min
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="pt-3 text-center">
                    <p className="text-xs text-mute">No meeting timers currently running.</p>
                    <button
                      type="button"
                      onClick={() => {
                        setTab('safety');
                        setSafetyMode('timer');
                      }}
                      className="btn-press mt-2 w-full rounded-lg border border-amber/40 bg-amber/10 py-1.5 text-xs font-bold text-amber hover:bg-amber/20"
                    >
                      Arm Meeting Timer
                    </button>
                  </div>
                )}
              </div>

              {/* Emergency Circle summary */}
              <div className="panel rounded-2xl p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-2 text-xs font-bold">
                    <I.phone size={14} className="text-sky" /> Emergency Circle
                  </span>
                  <span className="font-mono text-[10px] text-dim">
                    {contacts.length}/5 contacts
                  </span>
                </div>
                <div className="space-y-1.5">
                  {contacts.slice(0, 3).map((c) => (
                    <div
                      key={c._id}
                      className="flex items-center justify-between rounded-lg border border-line-soft bg-night-900/60 px-2.5 py-1.5 text-xs"
                    >
                      <span className="truncate font-semibold text-ink">{c.name}</span>
                      <span className="font-mono text-[10px] text-safe">SMS ready</span>
                    </div>
                  ))}
                  {contacts.length === 0 && (
                    <p className="text-xs text-mute">No emergency contacts configured yet.</p>
                  )}
                </div>
              </div>

              {/* Nearby Safe Zones */}
              <div className="panel rounded-2xl p-4">
                <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-dim">
                  Nearby Verified Safe Zones
                </p>
                <div className="space-y-2">
                  {safeZones.slice(0, 3).map((z) => (
                    <div
                      key={z.id}
                      className="flex items-center justify-between rounded-lg border border-line-soft bg-night-900/60 p-2 text-xs"
                    >
                      <div>
                        <p className="font-bold text-ink">{z.name}</p>
                        <p className="text-[10px] text-mute">{z.area}</p>
                      </div>
                      <span className="rounded bg-night-800 px-1.5 py-0.5 font-mono text-[9px] uppercase text-amber">
                        {z.category.replace('_', ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}
