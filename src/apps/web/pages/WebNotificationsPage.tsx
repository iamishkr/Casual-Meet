import React, { useEffect, useState } from 'react';
import { useData } from '../../../context/DataContext';
import { getSocket } from '../../../lib/socket';
import {
  Bell,
  Shield,
  MessageCircle,
  UserPlus,
  Clock,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import { EmptyState, Button } from '../../../components/ui';

interface NotificationItem {
  id: string;
  type: 'message' | 'timer' | 'sos' | 'connection' | 'system';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
}

export default function WebNotificationsPage() {
  const { activeTimer, activeSos } = useData();
  const [notifications, setNotifications] = useState<NotificationItem[]>([
    {
      id: 'init_1',
      type: 'system',
      title: 'Welcome to CasualMeet Web',
      message: 'Your account is connected to our authoritative MongoDB backend.',
      timestamp: new Date(),
      read: true,
    },
  ]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleNotification = (data: any) => {
      setNotifications((prev) => [
        {
          id: `notif_${Date.now()}_${Math.random()}`,
          type: data.type || 'system',
          title: data.title || 'New Notification',
          message: data.message || '',
          timestamp: new Date(),
          read: false,
        },
        ...prev,
      ]);
    };

    const handleTimerExpired = (data: any) => {
      setNotifications((prev) => [
        {
          id: `timer_${Date.now()}`,
          type: 'timer',
          title: 'Meeting Timer Expired',
          message: `Timer for user ${data.userId} has expired. Automated safety escalation triggered.`,
          timestamp: new Date(),
          read: false,
        },
        ...prev,
      ]);
    };

    const handleSosTriggered = (data: any) => {
      setNotifications((prev) => [
        {
          id: `sos_${Date.now()}`,
          type: 'sos',
          title: 'Emergency SOS Broadcast',
          message: `SOS Incident ${data.incidentId} has been activated.`,
          timestamp: new Date(),
          read: false,
        },
        ...prev,
      ]);
    };

    socket.on('notification', handleNotification);
    socket.on('timer_expired', handleTimerExpired);
    socket.on('sos_triggered', handleSosTriggered);

    return () => {
      socket.off('notification', handleNotification);
      socket.off('timer_expired', handleTimerExpired);
      socket.off('sos_triggered', handleSosTriggered);
    };
  }, []);

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const getIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'message':
        return <MessageCircle size={16} className="text-amber" />;
      case 'timer':
        return <Clock size={16} className="text-amber" />;
      case 'sos':
        return <Shield size={16} className="text-sos" />;
      case 'connection':
        return <UserPlus size={16} className="text-safe" />;
      default:
        return <Sparkles size={16} className="text-sky" />;
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Page Header */}
      <div className="flex items-center justify-between border-b border-line-soft/60 pb-5">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink flex items-center gap-2.5">
            <Bell size={24} className="text-amber" />
            Notification Center
          </h1>
          <p className="text-xs text-mute mt-1">
            Real-time updates streamed from server Socket.io events.
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={markAllAsRead}>
          Mark All as Read
        </Button>
      </div>

      {/* Notifications List */}
      <div className="space-y-2.5">
        {notifications.length === 0 ? (
          <EmptyState
            icon={<Bell size={28} className="text-amber" />}
            title="All Caught Up"
            description="You don't have any unread notifications."
          />
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              className={`flex items-start gap-3.5 rounded-2xl border p-4 shadow-sm backdrop-blur-sm transition-all ${
                n.read
                  ? 'border-line-soft bg-night-850/60 opacity-80'
                  : 'border-amber/40 bg-night-850'
              }`}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-night-900 border border-line-soft">
                {getIcon(n.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-display text-xs font-bold text-ink">{n.title}</h4>
                  <span className="font-mono text-[10px] text-dim">
                    {n.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-xs text-mute mt-0.5">{n.message}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
