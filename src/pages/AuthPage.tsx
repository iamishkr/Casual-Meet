import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { I, Field, inputCls } from '../components/ui';
import { getApiBase } from '../lib/api';
import {
  Eye,
  EyeOff,
  Lock,
  User as UserIcon,
  Mail,
  Phone,
  Key,
  ShieldCheck,
  AlertTriangle,
  Check,
  X,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  Clock,
  HelpCircle,
  Settings,
  Wifi,
  RefreshCw,
} from 'lucide-react';

export default function AuthPage({ mode: initialMode = 'login' }: { mode?: 'login' | 'register' }) {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [searchParams] = useSearchParams();
  const targetRole = searchParams.get('role'); // 'admin' or 'user'
  const [activeTab, setActiveTab] = useState<'user' | 'admin'>(targetRole === 'admin' ? 'admin' : 'user');

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    if (targetRole === 'admin') {
      setActiveTab('admin');
    } else if (targetRole === 'user') {
      setActiveTab('user');
    }
  }, [targetRole]);

  const { login, register, forgotPassword, resetPassword, quickLogin } = useAuth();
  const navigate = useNavigate();

  // Server Connection Configuration State
  const [serverUrlInput, setServerUrlInput] = useState(() => {
    return localStorage.getItem('casualmeet_server_url') || getApiBase().replace(/\/api\/?$/, '');
  });
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [testResult, setTestResult] = useState<{ status: 'idle' | 'testing' | 'success' | 'failed'; msg?: string }>({ status: 'idle' });

  const handleTestServer = async (testUrl: string) => {
    setTestResult({ status: 'testing' });
    try {
      const cleanUrl = testUrl.trim().replace(/\/api\/?$/, '');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(`${cleanUrl}/api/health`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('text/html')) {
          setTestResult({
            status: 'failed',
            msg: 'URL returned HTML instead of API JSON (pointing to a web frontend rather than the backend).',
          });
          return;
        }
        const data = await res.json().catch(() => null);
        if (data?.status === 'ok') {
          setTestResult({ status: 'success', msg: `Connected successfully! (${data.service || 'API Live'})` });
        } else {
          setTestResult({ status: 'success', msg: 'Connected successfully to backend!' });
        }
      } else {
        setTestResult({ status: 'failed', msg: `Server responded with HTTP ${res.status}` });
      }
    } catch (err: any) {
      setTestResult({
        status: 'failed',
        msg: err.name === 'AbortError' ? 'Timed out (Firewall blocking port 5000 or wrong IP)' : (err.message || 'Cannot reach server'),
      });
    }
  };

  const handleSaveServer = (newUrl: string) => {
    const cleanUrl = newUrl.trim().replace(/\/api\/?$/, '');
    localStorage.setItem('casualmeet_server_url', cleanUrl);
    setServerUrlInput(cleanUrl);
    setSuccessNotice(`Server URL saved: ${cleanUrl}`);
    setShowServerConfig(false);
    setTimeout(() => {
      window.location.reload();
    }, 400);
  };

  // Login form state
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Rate-limit countdown state
  const [cooldownSeconds, setCooldownSeconds] = useState<number | null>(null);

  // Register form state
  const [regForm, setRegForm] = useState({
    name: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    city: 'Bengaluru',
    occupation: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
  });
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirm, setShowRegConfirm] = useState(false);

  // General loading & message states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Forgot / Reset Password Modal state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotStep, setForgotStep] = useState<1 | 2>(1);
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotSuccess, setForgotSuccess] = useState<string | null>(null);

  // Countdown timer for rate limiting
  useEffect(() => {
    if (cooldownSeconds === null || cooldownSeconds <= 0) return;
    const timer = setInterval(() => {
      setCooldownSeconds((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownSeconds]);

  // Compute password strength for registration
  const computePasswordStrength = (pwd: string) => {
    if (!pwd) return { score: 0, label: 'None', color: 'bg-dim' };
    let score = 0;
    if (pwd.length >= 6) score += 1;
    if (pwd.length >= 8) score += 1;
    if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score += 1;
    if (/[0-9]/.test(pwd) || /[^A-Za-z0-9]/.test(pwd)) score += 1;

    if (score <= 1) return { score, label: 'Weak (min 6 chars)', color: 'bg-sos text-sos' };
    if (score === 2) return { score, label: 'Fair', color: 'bg-amber text-amber' };
    if (score === 3) return { score, label: 'Good', color: 'bg-safe text-safe' };
    return { score, label: 'Strong', color: 'bg-emerald-400 text-emerald-400' };
  };

  const pwdStrength = computePasswordStrength(regForm.password);
  const passwordsMatch = regForm.password && regForm.confirmPassword && regForm.password === regForm.confirmPassword;

  // Handle Sign In Submit
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) {
      setError('Please enter a username or email address');
      return;
    }
    if (!password) {
      setError('Password is required');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessNotice(null);

    const res = await login(identifier, password, activeTab === 'admin' ? 'super_admin' : 'user');
    setLoading(false);

    if (res.ok) {
      navigate(activeTab === 'admin' ? '/admin' : '/app');
    } else {
      let err = res.error || 'Login failed';
      if (/failed to fetch/i.test(err)) {
        err = 'Cannot reach backend server. Tap "Change IP" in the Server Connection bar below to verify your connection.';
        setShowServerConfig(true);
      }
      setError(err);

      // Check if error contains rate-limit wait time
      const matchWait = err.match(/wait (\d+) seconds/i);
      if (matchWait && matchWait[1]) {
        setCooldownSeconds(parseInt(matchWait[1], 10));
      }
    }
  };

  // Handle Registration Submit
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!regForm.name.trim() || !regForm.username.trim() || !regForm.email.trim() || !regForm.phone.trim()) {
      setError('Please fill in Name, Username, Email, and Phone Number');
      return;
    }

    if (!regForm.password || regForm.password.length < 6) {
      setError('Password is required and must be at least 6 characters long');
      return;
    }

    if (regForm.password !== regForm.confirmPassword) {
      setError('Password and Confirm Password do not match');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessNotice(null);

    const res = await register({
      name: regForm.name.trim(),
      username: regForm.username.trim().toLowerCase(),
      email: regForm.email.trim().toLowerCase(),
      password: regForm.password,
      phone: regForm.phone.trim(),
      city: regForm.city.trim() || 'Bengaluru',
      occupation: regForm.occupation.trim() || 'Member',
      emergencyContactName: regForm.emergencyContactName.trim() || undefined,
      emergencyContactPhone: regForm.emergencyContactPhone.trim() || undefined,
      role: 'user', // Security: always registered as member
    });

    setLoading(false);

    if (res.ok) {
      navigate('/app');
    } else {
      let err = res.error || 'Registration failed';
      if (/failed to fetch/i.test(err)) {
        err = 'Cannot reach backend server. Tap "Change IP" in the Server Connection bar below to verify your connection.';
        setShowServerConfig(true);
      }
      setError(err);
    }
  };

  // 1-Click Quick Demo Login
  const handleQuick = (userId: string, path: string) => {
    setError(null);
    quickLogin(userId);
    navigate(path);
  };

  // Handle Forgot Password Initiation (Step 1)
  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) {
      setForgotError('Please enter your registered email address.');
      return;
    }

    setForgotLoading(true);
    setForgotError(null);
    setForgotSuccess(null);

    const res = await forgotPassword(forgotEmail.trim().toLowerCase());
    setForgotLoading(false);

    if (res.ok) {
      setForgotSuccess(res.message);
      if (res.resetToken) {
        setResetToken(res.resetToken);
      }
      setForgotStep(2);
    } else {
      setForgotError(res.message);
    }
  };

  // Handle Reset Password Execution (Step 2)
  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetToken.trim()) {
      setForgotError('Reset token is required.');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setForgotError('New password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setForgotError('Passwords do not match.');
      return;
    }

    setForgotLoading(true);
    setForgotError(null);
    setForgotSuccess(null);

    const res = await resetPassword(resetToken.trim(), newPassword);
    setForgotLoading(false);

    if (res.ok) {
      setForgotSuccess('Password reset successfully! You can now sign in with your new password.');
      setTimeout(() => {
        setShowForgotModal(false);
        setMode('login');
        setPassword(newPassword);
        setSuccessNotice('Password successfully reset! Please sign in with your updated credentials.');
      }, 1500);
    } else {
      setForgotError(res.message);
    }
  };

  return (
    <div className="scene-bg scene-grid flex min-h-screen flex-col justify-center px-4 py-10 text-ink sm:px-6 lg:px-8">
      {/* Brand Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-lg text-center">
        <Link to="/" className="inline-flex items-center gap-3 group">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-amber/40 bg-amber/10 text-amber shadow-[0_0_28px_-6px_rgba(255,178,36,0.6)] group-hover:scale-105 transition-transform">
            <I.logo size={26} strokeWidth={2} />
          </span>
          <span className="font-display text-2xl font-extrabold tracking-tight">
            Casual<span className="text-amber">Meet</span>
          </span>
        </Link>
        <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-dim">
          Safety-first social discovery & meetup security
        </p>
      </div>

      {/* Main Authentication Box */}
      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-lg">
        <div className="panel rounded-3xl p-6 sm:p-8" style={{ boxShadow: 'var(--shadow-pop)' }}>
          {/* PRIMARY TABS: SIGN IN vs CREATE ACCOUNT */}
          <div className="mb-6 flex rounded-2xl border border-line bg-night-900/90 p-1.5 shadow-inner">
            <button
              type="button"
              id="tab-sign-in"
              onClick={() => { setMode('login'); setError(null); setSuccessNotice(null); }}
              className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 font-display text-xs sm:text-sm font-extrabold transition-all ${
                mode === 'login'
                  ? 'bg-amber text-night-950 shadow-[0_4px_16px_-4px_rgba(255,178,36,0.7)]'
                  : 'text-mute hover:text-ink'
              }`}
            >
              <Lock size={15} /> Sign In
            </button>
            <button
              type="button"
              id="tab-create-account"
              onClick={() => { setMode('register'); setError(null); setSuccessNotice(null); }}
              className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 font-display text-xs sm:text-sm font-extrabold transition-all ${
                mode === 'register'
                  ? 'bg-amber text-night-950 shadow-[0_4px_16px_-4px_rgba(255,178,36,0.7)]'
                  : 'text-mute hover:text-ink'
              }`}
            >
              <Sparkles size={15} /> Create Account
            </button>
          </div>

          {/* Portal Destination Switcher (User Portal vs Creator Admin) */}
          <div className="mb-5 flex items-center justify-between rounded-xl border border-line-soft bg-night-900/60 px-3.5 py-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-dim flex items-center gap-1">
              <ShieldCheck size={13} className="text-amber" /> Target Portal:
            </span>
            <div className="flex gap-1.5">
              <button
                type="button"
                id="btn-target-user"
                onClick={() => { setActiveTab('user'); setError(null); }}
                className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                  activeTab === 'user'
                    ? 'border border-amber/50 bg-amber/15 text-amber'
                    : 'border border-transparent text-mute hover:text-ink'
                }`}
              >
                👤 Member Portal
              </button>
              <button
                type="button"
                id="btn-target-admin"
                onClick={() => { setActiveTab('admin'); setError(null); }}
                className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                  activeTab === 'admin'
                    ? 'border border-amber/50 bg-amber/15 text-amber'
                    : 'border border-transparent text-mute hover:text-ink'
                }`}
              >
                🛡️ Creator Admin
              </button>
            </div>
          </div>

          {/* Server Connection Bar */}
          <div className="mb-5 rounded-xl border border-line-soft bg-night-900/60 p-2.5 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-dim font-mono text-[11px] truncate">
                <Wifi size={13} className="text-amber shrink-0" />
                <span className="truncate">Server: <strong className="text-ink">{serverUrlInput}</strong></span>
              </div>
              <button
                type="button"
                id="btn-toggle-server-config"
                onClick={() => {
                  setShowServerConfig(!showServerConfig);
                  setTestResult({ status: 'idle' });
                }}
                className="ml-2 shrink-0 flex items-center gap-1 text-[11px] font-bold text-amber hover:underline"
              >
                <Settings size={12} /> {showServerConfig ? 'Close' : 'Change IP'}
              </button>
            </div>

            {showServerConfig && (
              <div className="mt-3 border-t border-line-soft pt-3 space-y-2.5">
                <p className="text-[11px] text-mute">
                  If running on a mobile phone, verify or update your computer's Wi-Fi IP address:
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={serverUrlInput}
                    onChange={(e) => setServerUrlInput(e.target.value)}
                    placeholder="e.g. http://10.151.192.137:5000"
                    className="flex-1 rounded-lg border border-line bg-night-950 px-2.5 py-1.5 font-mono text-xs text-ink focus:border-amber focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleTestServer(serverUrlInput)}
                    disabled={testResult.status === 'testing'}
                    className="btn-press flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-[11px] font-bold text-ink hover:bg-night-800 disabled:opacity-50"
                  >
                    <RefreshCw size={11} className={testResult.status === 'testing' ? 'animate-spin' : ''} /> Test
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveServer(serverUrlInput)}
                    className="btn-press rounded-lg bg-amber px-3 py-1.5 font-display text-[11px] font-extrabold text-night-950 hover:bg-[#ffc14d]"
                  >
                    Save
                  </button>
                </div>

                {testResult.status === 'testing' && (
                  <div className="text-[11px] text-amber flex items-center gap-1.5 animate-pulse">
                    <RefreshCw size={11} className="animate-spin" /> Pinging {serverUrlInput}/api/health...
                  </div>
                )}
                {testResult.status === 'success' && (
                  <div className="rounded-lg bg-safe/15 border border-safe/40 p-2 text-[11px] text-safe font-medium">
                    ✅ {testResult.msg}
                  </div>
                )}
                {testResult.status === 'failed' && (
                  <div className="rounded-lg bg-sos/15 border border-sos/40 p-2 text-[11px] text-sos">
                    <p className="font-bold">❌ {testResult.msg}</p>
                    <p className="mt-1 text-[10px] text-mute">
                      Tips: Make sure phone and PC are on the same Wi-Fi network, and port 5000 is permitted in Windows Firewall.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Rate-Limit Cooldown Banner */}
          {cooldownSeconds !== null && cooldownSeconds > 0 && (
            <div className="mb-4 flex items-center gap-3 rounded-xl border border-sos/40 bg-sos/15 p-3 text-xs text-sos font-medium animate-pulse">
              <Clock size={16} className="shrink-0 text-sos" />
              <div>
                <span className="font-bold">Security Lockout Active:</span> Too many failed login attempts. Please wait{' '}
                <span className="font-mono font-extrabold underline">{cooldownSeconds}s</span> before trying again.
              </div>
            </div>
          )}

          {/* Error Notice */}
          {error && (
            <div className="anim-shake mb-4 flex items-start gap-2.5 rounded-xl border border-sos/50 bg-sos/10 p-3 text-xs text-sos font-medium">
              <AlertTriangle size={15} className="mt-0.5 shrink-0 text-sos" />
              <div className="flex-1">{error}</div>
            </div>
          )}

          {/* Success Notice */}
          {successNotice && (
            <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-safe/50 bg-safe/10 p-3 text-xs text-safe font-medium">
              <Check size={15} className="mt-0.5 shrink-0 text-safe" />
              <div className="flex-1">{successNotice}</div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* MODE 1: SIGN IN */}
          {/* ========================================================================= */}
          {mode === 'login' ? (
            <div>
              <form onSubmit={handleLogin} className="space-y-4">
                <Field label={activeTab === 'admin' ? 'Admin Username or Email' : 'Username or Email Address'}>
                  <div className="relative">
                    <input
                      type="text"
                      id="input-login-identifier"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder={activeTab === 'admin' ? 'e.g. kavita.ops' : 'e.g. aisha.k or rohan.m'}
                      className={`${inputCls} pr-10`}
                      autoFocus
                      required
                    />
                    <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-mute">
                      <UserIcon size={16} />
                    </div>
                  </div>
                </Field>

                <Field
                  label={
                    <div className="flex w-full items-center justify-between">
                      <span>Password</span>
                      <button
                        type="button"
                        id="btn-forgot-password"
                        onClick={() => {
                          setForgotEmail(identifier.includes('@') ? identifier : '');
                          setForgotStep(1);
                          setForgotError(null);
                          setForgotSuccess(null);
                          setShowForgotModal(true);
                        }}
                        className="text-[11px] font-semibold text-amber hover:underline transition-colors"
                      >
                        Forgot password?
                      </button>
                    </div>
                  }
                >
                  <div className="relative">
                    <input
                      type={showLoginPassword ? 'text' : 'password'}
                      id="input-login-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className={`${inputCls} pr-10`}
                      required
                    />
                    <button
                      type="button"
                      id="btn-toggle-login-password"
                      onClick={() => setShowLoginPassword(!showLoginPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-mute hover:text-ink transition-colors"
                      title={showLoginPassword ? 'Hide password' : 'Show password'}
                    >
                      {showLoginPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </Field>

                <button
                  type="submit"
                  id="btn-submit-login"
                  disabled={loading || Boolean(cooldownSeconds && cooldownSeconds > 0)}
                  className="btn-press w-full rounded-xl bg-amber py-3 font-display text-sm font-extrabold text-night-950 shadow-[0_6px_22px_-6px_rgba(255,178,36,0.7)] hover:bg-[#ffc14d] disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                  {loading ? (
                    'Verifying Credentials…'
                  ) : activeTab === 'admin' ? (
                    <>
                      <Lock size={15} /> Sign In to Creator HQ
                    </>
                  ) : (
                    <>
                      <ArrowRight size={16} /> Sign In to User Portal
                    </>
                  )}
                </button>
              </form>

              {/* Toggle to Create Account */}
              <div className="mt-4 text-center">
                <p className="text-xs text-mute">
                  Don't have an account yet?{' '}
                  <button
                    type="button"
                    onClick={() => { setMode('register'); setError(null); setSuccessNotice(null); }}
                    className="font-bold text-amber hover:underline"
                  >
                    Create a new account now →
                  </button>
                </p>
              </div>

              {/* Quick 1-Click Instant Demo Login */}
              <div className="mt-6 border-t border-line-soft pt-5">
                <p className="mb-2.5 text-center font-mono text-[10px] uppercase tracking-widest text-dim">
                  ⚡ 1-Click Instant Verified Logins
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    id="quick-login-aisha"
                    onClick={() => handleQuick('u_aisha', '/app')}
                    className="btn-press flex flex-col items-center gap-1 rounded-xl border border-line-soft bg-night-900/60 p-2.5 text-center hover:border-amber/40 transition-colors"
                  >
                    <span className="text-lg">👩</span>
                    <span className="text-xs font-bold text-ink">Aisha</span>
                    <span className="font-mono text-[9px] text-dim">user123</span>
                  </button>

                  <button
                    type="button"
                    id="quick-login-rohan"
                    onClick={() => handleQuick('u_rohan', '/app')}
                    className="btn-press flex flex-col items-center gap-1 rounded-xl border border-line-soft bg-night-900/60 p-2.5 text-center hover:border-amber/40 transition-colors"
                  >
                    <span className="text-lg">👨</span>
                    <span className="text-xs font-bold text-ink">Rohan</span>
                    <span className="font-mono text-[9px] text-dim">user123</span>
                  </button>

                  <button
                    type="button"
                    id="quick-login-kavita"
                    onClick={() => handleQuick('u_kavita', '/admin')}
                    className="btn-press flex flex-col items-center gap-1 rounded-xl border border-amber/40 bg-amber/10 p-2.5 text-center hover:bg-amber/20 transition-colors"
                  >
                    <span className="text-lg">🛡️</span>
                    <span className="text-xs font-bold text-amber">Kavita</span>
                    <span className="font-mono text-[9px] text-amber/80">admin123</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* ========================================================================= */
            /* MODE 2: CREATE NEW ACCOUNT (REGISTRATION) */
            /* ========================================================================= */
            <div>
              <div className="mb-4 rounded-xl border border-safe/30 bg-safe/10 p-3 text-xs text-safe flex items-start gap-2">
                <ShieldCheck size={16} className="shrink-0 text-safe mt-0.5" />
                <div>
                  <span className="font-bold">Safety-Protected Membership:</span> Automated meeting timers, GPS jitter redaction, and instant SOS circle escalation.
                </div>
              </div>

              <form onSubmit={handleRegister} className="space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Full Name *">
                    <input
                      type="text"
                      id="reg-name"
                      value={regForm.name}
                      onChange={(e) => setRegForm({ ...regForm, name: e.target.value })}
                      placeholder="e.g. Priya Sharma"
                      className={inputCls}
                      required
                    />
                  </Field>

                  <Field label="Choose Username *">
                    <input
                      type="text"
                      id="reg-username"
                      value={regForm.username}
                      onChange={(e) => setRegForm({ ...regForm, username: e.target.value.toLowerCase().trim() })}
                      placeholder="e.g. priya.s"
                      className={inputCls}
                      required
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Email Address *">
                    <input
                      type="email"
                      id="reg-email"
                      value={regForm.email}
                      onChange={(e) => setRegForm({ ...regForm, email: e.target.value.trim() })}
                      placeholder="priya@example.com"
                      className={inputCls}
                      required
                    />
                  </Field>

                  <Field label="Phone (+91...) *">
                    <input
                      type="tel"
                      id="reg-phone"
                      value={regForm.phone}
                      onChange={(e) => setRegForm({ ...regForm, phone: e.target.value.trim() })}
                      placeholder="+91 9876543210"
                      className={inputCls}
                      required
                    />
                  </Field>
                </div>

                {/* Password Fields with Real-Time Strength Meter */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field
                    label={
                      <div className="flex items-center justify-between">
                        <span>Password (min 6 chars) *</span>
                        {regForm.password && (
                          <span className={`text-[10px] font-bold ${pwdStrength.color.split(' ')[1]}`}>
                            {pwdStrength.label}
                          </span>
                        )}
                      </div>
                    }
                  >
                    <div className="relative">
                      <input
                        type={showRegPassword ? 'text' : 'password'}
                        id="reg-password"
                        value={regForm.password}
                        onChange={(e) => setRegForm({ ...regForm, password: e.target.value })}
                        placeholder="Create strong password"
                        className={`${inputCls} pr-10`}
                        required
                        minLength={6}
                      />
                      <button
                        type="button"
                        id="btn-toggle-reg-password"
                        onClick={() => setShowRegPassword(!showRegPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-mute hover:text-ink transition-colors"
                        title={showRegPassword ? 'Hide password' : 'Show password'}
                      >
                        {showRegPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </Field>

                  <Field
                    label={
                      <div className="flex items-center justify-between">
                        <span>Confirm Password *</span>
                        {regForm.confirmPassword && (
                          <span className={`text-[10px] font-bold ${passwordsMatch ? 'text-safe' : 'text-sos'}`}>
                            {passwordsMatch ? '✓ Matches' : '✗ Mismatch'}
                          </span>
                        )}
                      </div>
                    }
                  >
                    <div className="relative">
                      <input
                        type={showRegConfirm ? 'text' : 'password'}
                        id="reg-confirm-password"
                        value={regForm.confirmPassword}
                        onChange={(e) => setRegForm({ ...regForm, confirmPassword: e.target.value })}
                        placeholder="Re-type password"
                        className={`${inputCls} pr-10`}
                        required
                        minLength={6}
                      />
                      <button
                        type="button"
                        id="btn-toggle-reg-confirm"
                        onClick={() => setShowRegConfirm(!showRegConfirm)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-mute hover:text-ink transition-colors"
                        title={showRegConfirm ? 'Hide password' : 'Show password'}
                      >
                        {showRegConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </Field>
                </div>

                {/* Password Strength Progress Bar */}
                {regForm.password && (
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-night-950">
                    <div
                      className={`h-full transition-all duration-300 ${
                        pwdStrength.score === 1
                          ? 'w-1/4 bg-sos'
                          : pwdStrength.score === 2
                          ? 'w-2/4 bg-amber'
                          : pwdStrength.score === 3
                          ? 'w-3/4 bg-safe'
                          : 'w-full bg-emerald-400'
                      }`}
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="City">
                    <select
                      id="reg-city"
                      value={regForm.city}
                      onChange={(e) => setRegForm({ ...regForm, city: e.target.value })}
                      className={inputCls}
                    >
                      <option value="Bengaluru">Bengaluru</option>
                      <option value="Mumbai">Mumbai</option>
                      <option value="Delhi NCR">Delhi NCR</option>
                      <option value="Hyderabad">Hyderabad</option>
                      <option value="Pune">Pune</option>
                      <option value="Chennai">Chennai</option>
                    </select>
                  </Field>

                  <Field label="Occupation / Field">
                    <input
                      type="text"
                      id="reg-occupation"
                      value={regForm.occupation}
                      onChange={(e) => setRegForm({ ...regForm, occupation: e.target.value })}
                      placeholder="e.g. UI Designer or Student"
                      className={inputCls}
                    />
                  </Field>
                </div>

                {/* Optional Emergency Contact Section */}
                <div className="rounded-xl border border-line-soft bg-night-900/60 p-3 pt-2.5">
                  <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-dim flex items-center gap-1.5">
                    <Phone size={12} className="text-safe" /> Primary Emergency Contact (Optional)
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      id="reg-emergency-name"
                      value={regForm.emergencyContactName}
                      onChange={(e) => setRegForm({ ...regForm, emergencyContactName: e.target.value })}
                      placeholder="Contact Name (e.g. Sister, Mom)"
                      className={inputCls}
                    />
                    <input
                      type="tel"
                      id="reg-emergency-phone"
                      value={regForm.emergencyContactPhone}
                      onChange={(e) => setRegForm({ ...regForm, emergencyContactPhone: e.target.value })}
                      placeholder="+91 Emergency Phone"
                      className={inputCls}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  id="btn-submit-register"
                  disabled={loading}
                  className="btn-press mt-2 w-full rounded-xl bg-amber py-3 font-display text-sm font-extrabold text-night-950 shadow-[0_6px_22px_-6px_rgba(255,178,36,0.7)] hover:bg-[#ffc14d] disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                  {loading ? 'Securing & Registering Profile…' : '✨ Complete Registration & Enter'}
                </button>
              </form>

              {/* Toggle back to Sign In */}
              <div className="mt-4 text-center">
                <p className="text-xs text-mute">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => { setMode('login'); setError(null); setSuccessNotice(null); }}
                    className="font-bold text-amber hover:underline"
                  >
                    Sign in to existing account →
                  </button>
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Legal & Compliance Footer */}
        <div className="mt-6 text-center text-xs text-mute flex items-center justify-center gap-3">
          <Link to="/privacy" className="hover:text-amber transition-colors">Privacy Policy</Link>
          <span>·</span>
          <Link to="/terms" className="hover:text-amber transition-colors">Terms of Service</Link>
          <span>·</span>
          <Link to="/" className="hover:text-amber transition-colors">Home</Link>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* FORGOT & RESET PASSWORD MODAL */}
      {/* ========================================================================= */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-night-950/80 backdrop-blur-sm p-4">
          <div className="panel max-w-md w-full rounded-3xl p-6 shadow-2xl border border-amber/30 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-line-soft">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber/15 text-amber">
                  <Key size={18} />
                </div>
                <div>
                  <h3 className="font-display text-base font-extrabold text-ink">
                    {forgotStep === 1 ? 'Reset Password' : 'Enter New Password'}
                  </h3>
                  <p className="font-mono text-[10px] text-dim uppercase">Security Recovery Protocol</p>
                </div>
              </div>
              <button
                type="button"
                id="btn-close-forgot-modal"
                onClick={() => setShowForgotModal(false)}
                className="rounded-lg p-1 text-mute hover:text-ink hover:bg-night-800 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {forgotError && (
              <div className="mt-4 rounded-xl border border-sos/50 bg-sos/10 p-3 text-xs text-sos font-medium">
                {forgotError}
              </div>
            )}

            {forgotSuccess && (
              <div className="mt-4 rounded-xl border border-safe/50 bg-safe/10 p-3 text-xs text-safe font-medium">
                {forgotSuccess}
              </div>
            )}

            {/* STEP 1: Request Token */}
            {forgotStep === 1 ? (
              <form onSubmit={handleForgotSubmit} className="mt-4 space-y-4">
                <p className="text-xs text-mute leading-relaxed">
                  Enter your registered email address below. We'll generate a secure cryptographic token to reset your password.
                </p>

                <Field label="Registered Email Address">
                  <div className="relative">
                    <input
                      type="email"
                      id="forgot-email-input"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="e.g. aisha.k@casualmeet.app"
                      className={`${inputCls} pr-10`}
                      required
                      autoFocus
                    />
                    <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-mute">
                      <Mail size={16} />
                    </div>
                  </div>
                </Field>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="flex-1 rounded-xl border border-line py-2.5 text-xs font-bold text-mute hover:text-ink transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    id="btn-send-reset-token"
                    disabled={forgotLoading}
                    className="flex-1 rounded-xl bg-amber py-2.5 text-xs font-extrabold text-night-950 shadow-md hover:bg-[#ffc14d] transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {forgotLoading ? 'Generating…' : 'Generate Token →'}
                  </button>
                </div>
              </form>
            ) : (
              /* STEP 2: Submit Token and New Password */
              <form onSubmit={handleResetSubmit} className="mt-4 space-y-3.5">
                <Field label="Reset Token">
                  <input
                    type="text"
                    id="reset-token-input"
                    value={resetToken}
                    onChange={(e) => setResetToken(e.target.value)}
                    placeholder="Paste 64-char crypto reset token"
                    className={`${inputCls} font-mono text-xs`}
                    required
                  />
                </Field>

                <Field label="New Password (min 6 chars)">
                  <div className="relative">
                    <input
                      type={showResetPassword ? 'text' : 'password'}
                      id="reset-new-password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className={`${inputCls} pr-10`}
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowResetPassword(!showResetPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-mute hover:text-ink transition-colors"
                    >
                      {showResetPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </Field>

                <Field label="Confirm New Password">
                  <input
                    type={showResetPassword ? 'text' : 'password'}
                    id="reset-confirm-password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className={inputCls}
                    required
                    minLength={6}
                  />
                </Field>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setForgotStep(1)}
                    className="rounded-xl border border-line px-3 py-2.5 text-xs font-bold text-mute hover:text-ink transition-colors"
                  >
                    ← Back
                  </button>
                  <button
                    type="submit"
                    id="btn-confirm-reset-password"
                    disabled={forgotLoading}
                    className="flex-1 rounded-xl bg-amber py-2.5 text-xs font-extrabold text-night-950 shadow-md hover:bg-[#ffc14d] transition-colors disabled:opacity-50"
                  >
                    {forgotLoading ? 'Updating Password…' : 'Confirm New Password'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
