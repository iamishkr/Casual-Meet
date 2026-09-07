import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { I, Field, inputCls } from '../ui';

export default function PhoneAuthScreen() {
  const { login, register, quickLogin } = useAuth();
  const [tab, setTab] = useState<'login' | 'register'>('login');

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const [regName, setRegName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('user123');
  const [regPhone, setRegPhone] = useState('');
  const [regCity, setRegCity] = useState('Bengaluru');

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setError('Please enter your username or email');
      return;
    }
    setLoading(true);
    setError(null);
    const res = await login(username, password || 'user123');
    setLoading(false);
    if (!res.ok) {
      setError(res.error || 'Login failed');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim() || !regUsername.trim() || !regPhone.trim()) {
      setError('Please fill in all required fields');
      return;
    }
    setLoading(true);
    setError(null);
    const res = await register({
      name: regName,
      username: regUsername.toLowerCase().trim(),
      email: `${regUsername.toLowerCase().trim()}@casualmeet.app`,
      password: regPassword || 'user123',
      phone: regPhone,
      city: regCity,
      occupation: 'Member',
    });
    setLoading(false);
    if (!res.ok) {
      setError(res.error || 'Registration failed');
    }
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto px-5 py-6 text-ink">
      {/* App Branding */}
      <div className="text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-amber/40 bg-amber/10 text-amber shadow-[0_0_30px_-6px_rgba(255,178,36,0.7)]">
          <I.logo size={30} strokeWidth={2.2} />
        </div>
        <h2 className="mt-3 font-display text-xl font-extrabold tracking-tight">
          casual<span className="text-amber">meet</span>
        </h2>
        <p className="mt-0.5 font-mono text-[9px] uppercase tracking-widest text-dim">
          safety-first social discovery
        </p>
      </div>

      {/* Tabs */}
      <div className="mt-5 flex rounded-xl border border-line-soft bg-night-850 p-1">
        <button
          onClick={() => {
            setTab('login');
            setError(null);
          }}
          className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition-all ${
            tab === 'login' ? 'bg-night-700 text-amber shadow-sm' : 'text-mute hover:text-ink'
          }`}
        >
          Sign In
        </button>
        <button
          onClick={() => {
            setTab('register');
            setError(null);
          }}
          className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition-all ${
            tab === 'register' ? 'bg-night-700 text-amber shadow-sm' : 'text-mute hover:text-ink'
          }`}
        >
          Register
        </button>
      </div>

      {error && (
        <div className="anim-shake mt-3 rounded-xl border border-sos/50 bg-sos/10 p-2.5 text-[11px] text-sos">
          {error}
        </div>
      )}

      {/* Quick 1-Tap Login Chips */}
      <div className="mt-4 rounded-xl border border-line-soft bg-night-800/50 p-2.5">
        <p className="mb-2 font-mono text-[9px] uppercase tracking-wider text-dim text-center">
          1-Tap MongoDB Switcher
        </p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { username: 'aisha.k', name: 'Aisha', avatarHue: 35 },
            { username: 'rohan.m', name: 'Rohan', avatarHue: 200 },
          ].map((u) => (
            <button
              key={u.username}
              type="button"
              onClick={() => quickLogin(u.username)}
              className="btn-press flex items-center gap-2 rounded-lg border border-line-soft bg-night-850 p-1.5 hover:border-amber/40 text-left"
            >
              <div
                className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-night-950"
                style={{
                  background: `linear-gradient(135deg, hsl(${u.avatarHue} 85% 68%), hsl(${
                    (u.avatarHue + 42) % 360
                  } 80% 55%))`,
                }}
              >
                {u.name[0]}
              </div>
              <div className="min-w-0 flex-1 leading-tight">
                <p className="truncate text-[11px] font-bold text-ink">{u.name}</p>
                <p className="text-[9px] text-dim">@{u.username}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Form */}
      {tab === 'login' ? (
        <form onSubmit={handleLogin} className="mt-4 space-y-3">
          <Field label="Username or Email">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. aisha.k"
              className={inputCls}
              required
            />
          </Field>

          <Field label="Password">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className={inputCls}
            />
          </Field>

          <button
            type="submit"
            disabled={loading}
            className="btn-press mt-2 w-full rounded-xl bg-amber py-2.5 font-display text-xs font-bold text-night-950 shadow-[0_6px_20px_-6px_rgba(255,178,36,0.7)] hover:bg-[#ffc14d] disabled:opacity-50"
          >
            {loading ? 'Authenticating…' : 'Sign In to App'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleRegister} className="mt-4 space-y-2.5">
          <Field label="Full Name">
            <input
              type="text"
              value={regName}
              onChange={(e) => setRegName(e.target.value)}
              placeholder="Your name"
              className={inputCls}
              required
            />
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Username">
              <input
                type="text"
                value={regUsername}
                onChange={(e) => setRegUsername(e.target.value)}
                placeholder="handle"
                className={inputCls}
                required
              />
            </Field>
            <Field label="City">
              <input
                type="text"
                value={regCity}
                onChange={(e) => setRegCity(e.target.value)}
                placeholder="Bengaluru"
                className={inputCls}
              />
            </Field>
          </div>

          <Field label="Phone (+91...)">
            <input
              type="tel"
              value={regPhone}
              onChange={(e) => setRegPhone(e.target.value)}
              placeholder="+91 9876543210"
              className={inputCls}
              required
            />
          </Field>

          <Field label="Password (min 6 chars)">
            <input
              type="password"
              value={regPassword}
              onChange={(e) => setRegPassword(e.target.value)}
              placeholder="••••••••"
              className={inputCls}
              required
              minLength={6}
            />
          </Field>

          <button
            type="submit"
            disabled={loading}
            className="btn-press mt-2 w-full rounded-xl bg-amber py-2.5 font-display text-xs font-bold text-night-950 shadow-[0_6px_20px_-6px_rgba(255,178,36,0.7)] hover:bg-[#ffc14d] disabled:opacity-50"
          >
            {loading ? 'Creating Account…' : 'Join CasualMeet'}
          </button>
        </form>
      )}

      {/* Safety Notice footer */}
      <div className="mt-auto pt-6 text-center">
        <p className="flex items-center justify-center gap-1.5 font-mono text-[9px] text-dim">
          <I.shield size={11} className="text-safe" />
          End-to-end GPS privacy & emergency protection
        </p>
      </div>
    </div>
  );
}
