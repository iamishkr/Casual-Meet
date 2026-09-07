import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { engine, useEngine } from '../../lib/engine';
import ChatScreen from './ChatScreen';
import DiscoverScreen from './DiscoverScreen';
import ProfileScreen from './ProfileScreen';
import SafetyScreen from './SafetyScreen';
import PhoneAuthScreen from './PhoneAuthScreen';
import { I } from '../ui';
import { Smartphone, RotateCcw, Shield, CheckCircle2, Wifi, Battery, Signal, Zap } from 'lucide-react';
import { fmtCountdown } from '../../lib/utils';

type Tab = 'discover' | 'chats' | 'safety' | 'profile';
type DeviceModel = 'iphone' | 'pixel';

export default function PhoneApp() {
  const state = useEngine();
  const [tab, setTab] = useState<Tab>('discover');
  const [safetyMode, setSafetyMode] = useState<'timer' | 'sos'>('timer');
  const [threadId, setThreadId] = useState<string | null>(null);
  const [deviceModel, setDeviceModel] = useState<DeviceModel>('iphone');
  const [clock, setClock] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const { isAuthenticated, currentUser } = useAuth();
  const me = currentUser || (state.personaId ? engine.user(state.personaId) : engine.persona());

  // switching persona closes open thread so inbox always matches the session
  useEffect(() => {
    setThreadId(null);
  }, [me?.id]);

  const activeSos = me ? engine.activeSosFor(me.id) : null;
  const currentTimer = me ? state.timers.find((t) => t.userId === me.id && ['active', 'extended', 'expired'].includes(t.status)) : null;
  const activeTimer = Boolean(currentTimer && ['active', 'extended'].includes(currentTimer.status));
  const timerRemain = currentTimer ? Math.max(0, currentTimer.expiresAtV - state.vnow) : 0;

  const goChat = (userId: string) => {
    const id = engine.openChatWith(userId);
    if (id) {
      setThreadId(id);
      setTab('chats');
    }
  };

  const handleResetDevice = () => {
    setTab('discover');
    setThreadId(null);
    setSafetyMode('timer');
  };

  const tabs: { id: Tab; label: string; icon: (p: { size?: number }) => React.ReactNode; dot?: 'sos' | 'timer' }[] = [
    { id: 'discover', label: 'Discover', icon: (p) => <I.radar {...p} /> },
    { id: 'chats', label: 'Chats', icon: (p) => <I.chat {...p} /> },
    { id: 'safety', label: 'Safety', icon: (p) => <I.shield {...p} />, dot: activeSos ? 'sos' : activeTimer ? 'timer' : undefined },
    { id: 'profile', label: 'Profile', icon: (p) => <I.id {...p} /> },
  ];

  return (
    <div className="relative mx-auto flex flex-col items-center">
      {/* SIMULATOR DEVICE CONTROL TOOLBAR */}
      <div className="mb-3 flex w-[352px] sm:w-[380px] flex-wrap items-center justify-between gap-2 rounded-2xl border border-line-soft bg-night-900/90 p-2 text-xs shadow-lg backdrop-blur-md">
        {/* Device Switcher */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            id="btn-sim-iphone"
            onClick={() => setDeviceModel('iphone')}
            className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all ${
              deviceModel === 'iphone'
                ? 'border border-amber/40 bg-amber/15 text-amber shadow-sm'
                : 'text-mute hover:text-ink'
            }`}
          >
            🍎 iPhone 16
          </button>
          <button
            type="button"
            id="btn-sim-pixel"
            onClick={() => setDeviceModel('pixel')}
            className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all ${
              deviceModel === 'pixel'
                ? 'border border-amber/40 bg-amber/15 text-amber shadow-sm'
                : 'text-mute hover:text-ink'
            }`}
          >
            🤖 Pixel 9
          </button>
        </div>

        {/* Sync Status & Persona Switcher */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            id="btn-sim-reset"
            onClick={handleResetDevice}
            title="Reset Simulator View"
            className="rounded-lg border border-line-soft p-1 text-dim hover:text-ink hover:bg-night-800 transition-colors"
          >
            <RotateCcw size={13} />
          </button>

          {/* Quick Persona Switching for Device */}
          <div className="flex items-center gap-1">
            {['u_aisha', 'u_rohan'].map((id) => {
              const u = engine.user(id);
              if (!u) return null;
              const isCurrent = me?.id === u.id;
              return (
                <button
                  key={u.id}
                  type="button"
                  id={`btn-sim-persona-${u.username}`}
                  onClick={() => engine.setPersona(u.id)}
                  title={`Switch simulator to ${u.name}`}
                  className={`rounded-md px-2 py-0.5 text-[10px] font-extrabold transition-all ${
                    isCurrent
                      ? 'bg-amber text-night-950 shadow-sm'
                      : 'bg-night-800 text-mute hover:text-ink hover:bg-night-750'
                  }`}
                >
                  {u.name.split(' ')[0]}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* DEVICE HARDWARE SHELL */}
      <div
        className={`relative w-[352px] sm:w-[380px] p-[10px] shadow-[0_40px_90px_-30px_rgba(0,0,0,0.9),0_0_0_1px_rgba(255,255,255,0.06)_inset] transition-all ${
          deviceModel === 'iphone'
            ? 'rounded-[50px] border-2 border-[#2b3348] bg-gradient-to-b from-[#182030] via-[#0e1422] to-[#0a0f1b]'
            : 'rounded-[42px] border-2 border-[#333d54] bg-gradient-to-b from-[#1a2233] to-[#0c121e]'
        }`}
      >
        {/* Screen Bezel & Container */}
        <div
          className={`relative flex h-[720px] flex-col overflow-hidden border border-line-soft bg-night-900 shadow-inner ${
            deviceModel === 'iphone' ? 'rounded-[42px]' : 'rounded-[34px]'
          }`}
        >
          {/* STATUS BAR WITH DYNAMIC ISLAND OR PUNCH-HOLE */}
          <div className="relative z-20 flex items-center justify-between px-6 pt-3 pb-1 text-[11px] font-semibold">
            {/* Left: Clock */}
            <span className="tick-num font-mono font-bold text-ink">
              {clock.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })}
            </span>

            {/* Center: Dynamic Island or Pixel Camera */}
            {deviceModel === 'iphone' ? (
              <div
                className={`absolute left-1/2 top-2 -translate-x-1/2 flex items-center justify-between rounded-full bg-night-950 px-2.5 py-1 transition-all duration-300 shadow-md ${
                  activeSos
                    ? 'h-[28px] w-[130px] border border-sos/60 shadow-[0_0_14px_rgba(255,93,100,0.6)] animate-pulse'
                    : activeTimer
                    ? 'h-[26px] w-[124px] border border-amber/40 shadow-[0_0_12px_rgba(255,178,36,0.3)]'
                    : 'h-[24px] w-[96px] border border-white/5'
                }`}
              >
                {activeSos ? (
                  <>
                    <span className="h-2 w-2 rounded-full bg-sos animate-ping" />
                    <span className="font-display text-[10px] font-extrabold text-sos tracking-wider">EMERGENCY</span>
                    <span className="h-1.5 w-1.5 rounded-full bg-night-800" />
                  </>
                ) : activeTimer ? (
                  <>
                    <span className="h-2 w-2 rounded-full bg-amber pulse-dot" />
                    <span className="font-mono text-[10px] font-bold text-amber">{fmtCountdown(timerRemain)}</span>
                    <span className="h-1.5 w-1.5 rounded-full bg-night-800" />
                  </>
                ) : (
                  <>
                    <span className="h-2.5 w-2.5 rounded-full bg-night-900 border border-white/10" />
                    <span className="h-2 w-2 rounded-full bg-night-850" />
                  </>
                )}
              </div>
            ) : (
              /* Pixel 9 Punch Hole */
              <div className="absolute left-1/2 top-3 -translate-x-1/2 h-3.5 w-3.5 rounded-full bg-night-950 border border-white/10 shadow-inner" />
            )}

            {/* Right: Network & Battery Icons */}
            <div className="flex items-center gap-1.5 text-mute">
              <Signal size={12} className="text-ink" />
              <Wifi size={12} className="text-ink" />
              <div className="flex items-center gap-0.5">
                <Battery size={15} className="text-safe" />
                <span className="font-mono text-[9px] text-dim">98%</span>
              </div>
            </div>
          </div>

          {!isAuthenticated || !me ? (
            /* Unauthenticated Screen inside Mobile Frame */
            <div className="relative z-10 flex-1 overflow-hidden">
              <PhoneAuthScreen />
            </div>
          ) : (
            /* Authenticated Native Application Body */
            <>
              {/* App Navigation Bar */}
              <div className="z-10 flex items-center justify-between border-b border-line-soft bg-night-900/90 px-4 py-2.5 backdrop-blur-sm">
                <div className="flex items-center gap-1.5">
                  <span className="text-amber">
                    <I.logo size={19} strokeWidth={2} />
                  </span>
                  <span className="font-display text-[15px] font-extrabold tracking-tight">
                    casual<span className="text-amber">meet</span>
                  </span>
                </div>

                {/* Top User Status Badge */}
                <div
                  key={me.id}
                  className="anim-fade flex items-center gap-1.5 rounded-full border border-line-soft bg-night-800/80 py-1 pl-1 pr-2.5"
                >
                  <span className="relative">
                    <span
                      className="block h-6 w-6 overflow-hidden rounded-full"
                      style={{
                        background: `linear-gradient(135deg, hsl(${me.avatarHue} 85% 68%), hsl(${(me.avatarHue + 42) % 360} 80% 55%))`,
                      }}
                    >
                      <span className="flex h-full w-full items-center justify-center text-[10px] font-bold text-night-950">
                        {me.name
                          .split(' ')
                          .map((w) => w[0])
                          .join('')}
                      </span>
                    </span>
                    {activeSos && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-sos pulse-dot" />}
                  </span>
                  <span className="text-[11px] font-bold text-ink">{me.name.split(' ')[0]}</span>
                  {me.isVerified && (
                    <span className="text-sky" title="Verified Identity">
                      <I.logo size={11} strokeWidth={2.5} />
                    </span>
                  )}
                </div>
              </div>

              {/* Active Screen Body */}
              <div className="relative z-0 flex-1 overflow-hidden">
                <div key={`${tab}-${threadId ?? 'list'}-${me.id}`} className="anim-fade h-full">
                  {tab === 'discover' && <DiscoverScreen goChat={goChat} />}
                  {tab === 'chats' && <ChatScreen threadId={threadId} openThread={setThreadId} />}
                  {tab === 'safety' && <SafetyScreen mode={safetyMode} setMode={setSafetyMode} />}
                  {tab === 'profile' && <ProfileScreen />}
                </div>
              </div>

              {/* Mobile Bottom Tab Bar */}
              <div className="relative z-20 border-t border-line-soft bg-night-900/95 px-3 pt-2 pb-2">
                <div className="flex items-center justify-between">
                  {tabs.slice(0, 2).map((t) => (
                    <TabBtn
                      key={t.id}
                      t={t}
                      active={tab === t.id}
                      onGo={() => {
                        setTab(t.id);
                        if (t.id !== 'chats') setThreadId(null);
                      }}
                    />
                  ))}

                  {/* Central SOS Emergency Trigger Button */}
                  <button
                    type="button"
                    id="btn-phone-sos-trigger"
                    onClick={() => {
                      setTab('safety');
                      setSafetyMode('sos');
                    }}
                    aria-label="Open SOS Emergency Dispatch"
                    className={`btn-press -mt-7 flex h-14 w-14 items-center justify-center rounded-full border-4 border-night-900 font-display text-[13px] font-extrabold tracking-wide shadow-[0_10px_30px_-6px_rgba(255,93,100,0.7)] ${
                      activeSos
                        ? 'bg-sos text-night-950 animate-pulse'
                        : 'bg-gradient-to-b from-sos to-[#c93642] text-night-950 hover:brightness-110'
                    }`}
                    style={activeSos ? { animation: 'breathe 1.6s ease-in-out infinite' } : undefined}
                  >
                    SOS
                  </button>

                  {tabs.slice(2).map((t) => (
                    <TabBtn
                      key={t.id}
                      t={t}
                      active={tab === t.id}
                      onGo={() => {
                        setTab(t.id);
                        if (t.id === 'safety') setSafetyMode(activeSos ? 'sos' : 'timer');
                      }}
                    />
                  ))}
                </div>

                {/* Bottom Hardware Home Indicator Bar */}
                <div className="mt-2 flex justify-center">
                  <span
                    className={`h-1 rounded-full bg-white/25 transition-all ${
                      deviceModel === 'iphone' ? 'w-32' : 'w-24'
                    }`}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Live Synced Caption */}
      <div className="mt-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-dim">
        <span className="flex h-2 w-2 rounded-full bg-safe pulse-dot" />
        <span>Mobile Simulator · Expo SDK 57 · Running as</span>
        <span className="font-bold text-amber">@{me?.username || 'Guest'}</span>
      </div>
    </div>
  );
}

function TabBtn({
  t,
  active,
  onGo,
}: {
  t: { id: string; label: string; icon: (p: { size?: number }) => React.ReactNode; dot?: 'sos' | 'timer' };
  active: boolean;
  onGo: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onGo}
      className={`btn-press relative flex w-16 flex-col items-center gap-0.5 rounded-xl py-1 text-[10px] font-semibold transition-colors ${
        active ? 'text-amber' : 'text-dim hover:text-mute'
      }`}
    >
      <span className="relative">
        {t.icon({ size: 19 })}
        {t.dot && (
          <span
            className={`absolute -right-1.5 -top-1 h-2 w-2 rounded-full ${
              t.dot === 'sos' ? 'bg-sos pulse-dot' : 'bg-amber'
            }`}
          />
        )}
      </span>
      {t.label}
      {active && <span className="absolute -bottom-[6px] h-0.5 w-6 rounded-full bg-amber" />}
    </button>
  );
}
