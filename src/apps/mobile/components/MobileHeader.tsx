import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { useData } from '../../../context/DataContext';
import { api } from '../../../lib/api';
import { getSocket } from '../../../lib/socket';
import {
  Shield,
  ShieldAlert,
  Clock,
  Bell,
} from 'lucide-react';
import { I } from '../../../components/ui';
import { fmtCountdown } from '../../../lib/utils';

export default function MobileHeader() {
  const { currentUser } = useAuth();
  const { activeSos, activeTimer } = useData();
  const [visualClock, setVisualClock] = useState(() => Date.now());
  const [notifUnreadCount, setNotifUnreadCount] = useState<number>(0);

  useEffect(() => {
    const t = setInterval(() => setVisualClock(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (currentUser) {
      api.notifications
        .list(1, 1)
        .then((res) => {
          setNotifUnreadCount(res.unreadCount || 0);
        })
        .catch(() => {});
    }

    const socket = getSocket();
    if (!socket) return;

    const handleNewNotif = () => {
      setNotifUnreadCount((c) => c + 1);
    };

    socket.on('notification', handleNewNotif);
    return () => {
      socket.off('notification', handleNewNotif);
    };
  }, [currentUser]);

  const timerRemain = activeTimer
    ? Math.max(0, new Date(activeTimer.expiresAt).getTime() - visualClock)
    : 0;

  return (
    <header className="sticky top-0 z-40 flex h-14 w-full items-center justify-between border-b border-line-soft bg-night-900/90 px-4 backdrop-blur-lg pt-[env(safe-area-inset-top)]">
      {/* Brand */}
      <Link to="/mobile" className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-amber/40 bg-amber/10 text-amber shadow-sm">
          <I.logo size={16} strokeWidth={2} />
        </span>
        <span className="font-display text-base font-extrabold tracking-tight text-ink">
          Casual<span className="text-amber">Meet</span>
        </span>
      </Link>

      {/* Center / Right Controls */}
      <div className="flex items-center gap-2.5">
        {/* Active Emergency SOS Alert Pill */}
        {activeSos && (
          <Link
            to="/mobile/safety"
            className="flex items-center gap-1 rounded-lg border border-sos/50 bg-sos/20 px-2 py-1 text-[10px] font-bold text-sos animate-pulse"
          >
            <ShieldAlert size={12} />
            <span>SOS ACTIVE</span>
          </Link>
        )}

        {/* Active Timer Pill */}
        {!activeSos && activeTimer && (
          <Link
            to="/mobile/safety"
            className="flex items-center gap-1 rounded-lg border border-amber/40 bg-amber/15 px-2 py-1 font-mono text-[10px] font-bold text-amber shadow-sm"
          >
            <Clock size={12} />
            <span>{fmtCountdown(timerRemain)}</span>
          </Link>
        )}

        {/* Notifications Bell */}
        <Link
          to="/mobile/notifications"
          className="relative flex h-8 w-8 items-center justify-center rounded-xl border border-line bg-night-850 text-mute hover:text-amber transition-colors"
          title="Notifications"
        >
          <Bell size={16} />
          {notifUnreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber px-1 font-mono text-[9px] font-bold text-night-950 shadow-sm">
              {notifUnreadCount > 99 ? '99+' : notifUnreadCount}
            </span>
          )}
        </Link>

        {/* Profile Avatar */}
        <Link to="/mobile/profile" className="flex items-center">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full font-display text-[11px] font-bold text-night-950 shadow-sm"
            style={{
              background: `linear-gradient(135deg, hsl(${currentUser?.avatarHue ?? 210} 85% 68%), hsl(${((currentUser?.avatarHue ?? 210) + 42) % 360} 80% 55%))`,
            }}
          >
            {currentUser?.name?.slice(0, 2).toUpperCase()}
          </div>
        </Link>
      </div>
    </header>
  );
}
