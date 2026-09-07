import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useEngine } from './lib/engine';
import ProtectedRoute from './components/auth/ProtectedRoute';
import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';
import UserPortal from './pages/UserPortal';
import AdminPortal from './pages/AdminPortal';
import { I } from './components/ui';

export default function App() {
  const state = useEngine();

  return (
    <>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/register" element={<AuthPage mode="register" />} />

        {/* User Application Portal */}
        <Route
          path="/app/*"
          element={
            <ProtectedRoute allowedRoles={['user', 'moderator', 'super_admin']}>
              <UserPortal />
            </ProtectedRoute>
          }
        />

        {/* Creator Admin HQ Console */}
        <Route
          path="/admin/*"
          element={
            <ProtectedRoute allowedRoles={['moderator', 'super_admin']}>
              <AdminPortal />
            </ProtectedRoute>
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* Global Toast Notifications (Overlay across all views) */}
      <div className="pointer-events-none fixed right-4 top-4 z-[99] flex w-[320px] flex-col gap-2">
        {state.toasts.map((t) => (
          <div
            key={t.id}
            className={`anim-slide-r pointer-events-auto rounded-xl border p-3 backdrop-blur-md ${
              t.tone === 'err'
                ? 'border-sos/50 bg-[#2a1116]/95'
                : t.tone === 'warn'
                ? 'border-amber/50 bg-[#2a2010]/95'
                : t.tone === 'ok'
                ? 'border-safe/50 bg-[#0e241c]/95'
                : 'border-sky/50 bg-[#0e1d2a]/95'
            }`}
            style={{ boxShadow: 'var(--shadow-pop)' }}
          >
            <p
              className={`flex items-center gap-1.5 text-[12px] font-bold ${
                t.tone === 'err'
                  ? 'text-sos'
                  : t.tone === 'warn'
                  ? 'text-amber'
                  : t.tone === 'ok'
                  ? 'text-safe'
                  : 'text-sky'
              }`}
            >
              {t.tone === 'err' ? (
                <I.sos size={13} />
              ) : t.tone === 'warn' ? (
                <I.alert size={13} />
              ) : t.tone === 'ok' ? (
                <I.check size={13} />
              ) : (
                <I.bolt size={13} />
              )}
              {t.title}
            </p>
            {t.sub && <p className="mt-0.5 pl-5 text-[11px] leading-snug text-mute">{t.sub}</p>}
          </div>
        ))}
      </div>
    </>
  );
}
