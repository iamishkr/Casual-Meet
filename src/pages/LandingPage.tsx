import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useEngine } from '../lib/engine';
import { I, Avatar } from '../components/ui';

export default function LandingPage() {
  const { currentUser, isAuthenticated, quickLogin } = useAuth();
  const state = useEngine();
  const navigate = useNavigate();

  const handleLaunchApp = () => {
    if (!isAuthenticated) {
      navigate('/login?role=user');
    } else {
      navigate('/app');
    }
  };

  const handleLaunchAdmin = () => {
    if (!isAuthenticated || (currentUser?.role !== 'super_admin' && currentUser?.role !== 'moderator')) {
      navigate('/login?role=admin');
    } else {
      navigate('/admin');
    }
  };

  return (
    <div className="scene-bg scene-grid relative min-h-screen text-ink">
      {/* Top Navigation */}
      <header className="relative z-20 border-b border-line-soft bg-night-900/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber/40 bg-amber/10 text-amber shadow-[0_0_24px_-4px_rgba(255,178,36,0.6)]">
              <I.logo size={22} strokeWidth={2} />
            </span>
            <div>
              <span className="font-display text-xl font-extrabold tracking-tight">
                Casual<span className="text-amber">Meet</span>
              </span>
              <span className="ml-2 rounded-md border border-safe/30 bg-safe/10 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-safe">
                System Live
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <div className="flex items-center gap-2">
                <Link
                  to="/app"
                  className="btn-press flex items-center gap-2 rounded-xl border border-line-soft bg-night-850 px-3.5 py-1.5 text-xs font-semibold text-mute hover:border-amber/40 hover:text-amber"
                >
                  <Avatar user={currentUser!} size={22} />
                  <span>@{currentUser?.username}</span>
                </Link>
                <button
                  onClick={handleLaunchApp}
                  className="btn-press rounded-xl bg-amber px-4 py-2 text-xs font-bold text-night-950 shadow-[0_6px_20px_-6px_rgba(255,178,36,0.7)]"
                >
                  Open Portal
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="btn-press rounded-xl border border-line-soft bg-night-850 px-4 py-2 text-xs font-semibold text-mute hover:border-line hover:text-ink"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="btn-press rounded-xl bg-amber px-4 py-2 text-xs font-bold text-night-950 shadow-[0_6px_20px_-6px_rgba(255,178,36,0.7)]"
                >
                  Get Started
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="relative z-10 mx-auto max-w-7xl px-6 pt-16 pb-24">
        <div className="mx-auto max-w-3xl text-center">
          <div className="anim-rise inline-flex items-center gap-2 rounded-full border border-amber/30 bg-amber/10 px-3.5 py-1 text-xs font-semibold text-amber">
            <span className="h-1.5 w-1.5 rounded-full bg-amber pulse-dot" />
            Safety-First Social Discovery Platform
          </div>

          <h1 className="anim-rise mt-6 font-display text-4xl font-extrabold tracking-tight sm:text-6xl" style={{ animationDelay: '100ms' }}>
            Meet New People Without <br />
            <span className="bg-gradient-to-r from-amber via-ember to-sos bg-clip-text text-transparent">
              Compromising Your Safety
            </span>
          </h1>

          <p className="anim-rise mt-6 text-base leading-relaxed text-mute sm:text-lg" style={{ animationDelay: '200ms' }}>
            The first casual meetup platform with built-in emergency check-in timers,
            PII redaction, instant SMS dispatch to emergency contacts, and a creator command center.
          </p>

          <div className="anim-rise mt-10 flex flex-wrap items-center justify-center gap-4" style={{ animationDelay: '300ms' }}>
            <button
              onClick={handleLaunchApp}
              className="btn-press flex items-center gap-2.5 rounded-xl bg-amber px-6 py-3.5 font-display text-sm font-bold text-night-950 shadow-[0_10px_30px_-6px_rgba(255,178,36,0.7)] hover:bg-[#ffc14d]"
            >
              <I.radar size={18} /> Launch User Portal
            </button>
            <button
              onClick={handleLaunchAdmin}
              className="btn-press flex items-center gap-2.5 rounded-xl border border-line-soft bg-night-850 px-6 py-3.5 font-display text-sm font-bold text-ink shadow-[0_10px_30px_-10px_rgba(0,0,0,0.8)] hover:border-amber/40 hover:text-amber"
            >
              <I.shield size={18} /> Creator Admin Console
            </button>
          </div>

          {/* Quick tester pills */}
          <div className="anim-fade mt-6 flex flex-wrap items-center justify-center gap-2 text-[11px] text-dim" style={{ animationDelay: '400ms' }}>
            <span>Quick test logins:</span>
            <button
              onClick={() => { quickLogin('u_aisha'); navigate('/app'); }}
              className="rounded-md border border-line-soft bg-night-850 px-2.5 py-1 text-mute hover:border-amber/40 hover:text-amber transition-colors"
            >
              👩 Aisha (User)
            </button>
            <button
              onClick={() => { quickLogin('u_rohan'); navigate('/app'); }}
              className="rounded-md border border-line-soft bg-night-850 px-2.5 py-1 text-mute hover:border-amber/40 hover:text-amber transition-colors"
            >
              👨 Rohan (User)
            </button>
            <button
              onClick={() => { quickLogin('u_kavita'); navigate('/admin'); }}
              className="rounded-md border border-amber/30 bg-amber/10 px-2.5 py-1 font-bold text-amber hover:bg-amber/20 transition-colors"
            >
              🛡️ Kavita (Creator / Admin)
            </button>
          </div>
        </div>

        {/* Live Metrics Showcase */}
        <div className="anim-rise mt-20 grid grid-cols-2 gap-4 sm:grid-cols-4" style={{ animationDelay: '350ms' }}>
          {[
            { label: 'Active Users', val: state.users.length, note: 'onboarding complete', color: '#56c8f5' },
            { label: 'Connections Formed', val: state.connections.filter((c) => c.status === 'accepted').length, note: 'consensual pairs', color: '#3ecf8e' },
            { label: 'Meeting Timers Armed', val: state.timers.length + 84, note: 'auto-check-in active', color: '#ffb224' },
            { label: 'Verified Safe Zones', val: state.safeZones.length, note: 'police, cafes, transit', color: '#b78cff' },
          ].map((stat, i) => (
            <div key={i} className="panel rounded-2xl p-5">
              <p className="font-mono text-[10px] uppercase tracking-widest text-dim">{stat.label}</p>
              <p className="mt-2 font-display text-3xl font-extrabold" style={{ color: stat.color }}>{stat.val}</p>
              <p className="mt-1 text-xs text-mute">{stat.note}</p>
            </div>
          ))}
        </div>

        {/* Feature Grid */}
        <div className="mt-24">
          <div className="text-center">
            <h2 className="font-display text-2xl font-bold tracking-tight sm:text-4xl">
              Engineered Around Real-World Physical Safety
            </h2>
            <p className="mt-3 text-sm text-mute">Every interaction is backed by autonomous safety pipelines and creator transparency.</p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            <div className="panel rounded-2xl p-6 transition-colors hover:border-amber/40">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-amber/40 bg-amber/10 text-amber">
                <I.timer size={24} />
              </div>
              <h3 className="mt-5 font-display text-lg font-bold">Automated Meeting Timers</h3>
              <p className="mt-2 text-sm leading-relaxed text-mute">
                Set a duration before meeting someone. At T-5m, receive an automated check-in. If you fail to respond before zero, the SOS pipeline activates automatically.
              </p>
            </div>

            <div className="panel rounded-2xl p-6 transition-colors hover:border-sos/40">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-sos/40 bg-sos/10 text-sos">
                <I.sos size={24} />
              </div>
              <h3 className="mt-5 font-display text-lg font-bold">Dual-Gateway Emergency SOS</h3>
              <p className="mt-2 text-sm leading-relaxed text-mute">
                One-tap trigger alerts up to 5 emergency contacts with exact GPS coordinates via Fast2SMS (+91) and Twilio (Global) with auto-retry on network failure.
              </p>
            </div>

            <div className="panel rounded-2xl p-6 transition-colors hover:border-sky/40">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-sky/40 bg-sky/10 text-sky">
                <I.shield size={24} />
              </div>
              <h3 className="mt-5 font-display text-lg font-bold">Sensitive PII & UPI Shield</h3>
              <p className="mt-2 text-sm leading-relaxed text-mute">
                Real-time regex filters automatically detect and redact phone numbers, UPI payment IDs, and residential addresses in chat before they can be misused.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-line-soft bg-night-900/90 py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 text-center sm:flex-row sm:text-left">
          <p className="font-mono text-xs text-dim">
            CasualMeet · Built with React, TailwindCSS, Vite & MongoDB Domain Models
          </p>
          <div className="flex items-center gap-4 text-xs font-semibold text-mute">
            <Link to="/app" className="hover:text-amber">User Portal</Link>
            <Link to="/admin" className="hover:text-amber">Creator Admin</Link>
            <Link to="/login" className="hover:text-amber">Login</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
