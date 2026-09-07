import React from 'react';
import { Navigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import type { Role } from '../../lib/types';
import { Btn, I } from '../ui';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: Role[];
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, currentUser, role, quickLogin } = useAuth();
  const location = useLocation();

  if (!isAuthenticated || !currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && role && !allowedRoles.includes(role)) {
    return (
      <div className="scene-bg scene-grid flex min-h-screen items-center justify-center p-4">
        <div className="panel max-w-md rounded-2xl p-8 text-center" style={{ boxShadow: 'var(--shadow-pop)' }}>
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-sos/40 bg-sos/10 text-sos">
            <I.ban size={28} />
          </div>
          <h2 className="font-display text-xl font-extrabold tracking-tight">Access Restricted</h2>
          <p className="mt-2 text-sm leading-relaxed text-mute">
            This area requires <span className="font-mono font-bold text-amber">Admin / Creator</span> privileges.
            You are currently signed in as <span className="font-bold text-ink">@{currentUser.username}</span> ({role}).
          </p>

          <div className="mt-6 flex flex-col gap-2.5">
            <button
              onClick={() => quickLogin('u_kavita')}
              className="btn-press flex items-center justify-center gap-2 rounded-xl bg-amber px-4 py-2.5 text-xs font-bold text-night-950 shadow-[0_6px_20px_-6px_rgba(255,178,36,0.6)]"
            >
              <I.shield size={14} /> Switch to Super Admin (@kavita.ops)
            </button>
            <Link to="/app" className="btn-press flex items-center justify-center gap-2 rounded-xl border border-line bg-night-850 px-4 py-2 text-xs font-semibold text-mute hover:text-ink">
              <I.chevL size={14} /> Return to User Portal
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
