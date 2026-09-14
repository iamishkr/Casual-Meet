import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../lib/api';
import { getSocket } from '../../../lib/socket';
import { useToast } from '../../../context/ToastContext';
import type { SocialNotificationDTO } from '../../../lib/types';
import { relTime } from '../../../lib/utils';
import {
  Bell,
  Heart,
  MessageCircle,
  UserPlus,
  Sparkles,
  CheckCheck,
  Loader2,
  Shield,
  ShieldAlert,
  Clock,
} from 'lucide-react';
import { Button, EmptyState } from '../../../components/ui';

export default function MobileNotificationsView() {
  const { toast } = useToast();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState<SocialNotificationDTO[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  const loadNotifications = useCallback(async () => {
    try {
      const res = await api.notifications.list(1, 40);
      setNotifications(res.notifications || []);
      setUnreadCount(res.unreadCount || 0);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();

    const socket = getSocket();
    if (!socket) return;

    const handleNewNotification = (data: any) => {
      setNotifications((prev) => {
        if (prev.some((n) => n.id === data.id)) return prev;
        const newNotif: SocialNotificationDTO = {
          id: data.id || `notif_${Date.now()}`,
          type: data.type || 'system',
          title: data.title || 'Notification',
          message: data.message || '',
          actor: data.actor || { id: '', name: 'Someone', username: 'member' },
          targetType: data.targetType,
          targetId: data.targetId,
          isRead: false,
          createdAt: data.createdAt || new Date().toISOString(),
        };
        return [newNotif, ...prev];
      });
      setUnreadCount((c) => c + 1);
    };

    socket.on('notification', handleNewNotification);
    return () => {
      socket.off('notification', handleNewNotification);
    };
  }, [loadNotifications]);

  const handleMarkAllRead = async () => {
    if (unreadCount === 0 || markingAll) return;
    setMarkingAll(true);
    try {
      await api.notifications.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
      toast('ok', 'All Read', 'Marked all notifications as read.');
    } catch (err: any) {
      toast('err', 'Failed', err?.message || 'Could not mark notifications as read.');
    } finally {
      setMarkingAll(false);
    }
  };

  const handleNotificationClick = async (notif: SocialNotificationDTO) => {
    if (!notif.isRead) {
      try {
        await api.notifications.markRead(notif.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch {
        // ignore
      }
    }

    if (notif.type === 'safety_timer' || notif.type === 'sos_alert' || notif.type === 'sos') {
      navigate('/mobile/safety');
    } else if (notif.type === 'new_message' || (notif.targetType === 'chat' && notif.targetId)) {
      navigate(`/mobile/messages${notif.targetId ? `?chatId=${notif.targetId}` : ''}`);
    } else if (notif.targetType === 'user' && notif.targetId) {
      navigate(`/mobile/profile/${notif.targetId}`);
    } else if (notif.actor?.id && (notif.type === 'follow' || notif.type === 'new_follower' || notif.type === 'connection_requested' || notif.type === 'connection_accepted')) {
      navigate(`/mobile/profile/${notif.actor.id}`);
    } else if (notif.targetType === 'post') {
      navigate('/mobile');
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'like':
      case 'post_liked':
        return <Heart size={16} className="text-rose-500 fill-rose-500" />;
      case 'comment':
      case 'post_commented':
        return <MessageCircle size={16} className="text-amber" />;
      case 'follow':
      case 'new_follower':
      case 'connection_requested':
      case 'connection_accepted':
        return <UserPlus size={16} className="text-safe" />;
      case 'safety_timer':
        return <Clock size={16} className="text-amber" />;
      case 'sos':
      case 'sos_alert':
        return <ShieldAlert size={16} className="text-sos" />;
      default:
        return <Bell size={16} className="text-dim" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="font-display text-base font-bold text-ink flex items-center gap-2">
            <span>Notifications</span>
            {unreadCount > 0 && (
              <span className="rounded-full bg-amber px-2 py-0.5 font-mono text-[10px] font-bold text-night-950">
                {unreadCount} new
              </span>
            )}
          </h2>
          <p className="text-[11px] text-mute">Real-time alerts and activity updates</p>
        </div>

        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleMarkAllRead}
            disabled={markingAll}
            leftIcon={markingAll ? <Loader2 size={13} className="animate-spin" /> : <CheckCheck size={13} />}
          >
            Mark all read
          </Button>
        )}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-xs text-dim">
          <Loader2 size={20} className="animate-spin text-amber mr-2" />
          <span>Loading notifications...</span>
        </div>
      ) : notifications.length === 0 ? (
        <div className="rounded-3xl border border-line-soft bg-night-850/60 p-12 text-center text-xs text-mute space-y-2">
          <Sparkles size={28} className="mx-auto text-amber" />
          <p className="font-bold text-ink">You're all caught up!</p>
          <p className="text-[11px]">When people like your posts, comment, or follow you, updates appear here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((notif) => (
            <div
              key={notif.id}
              onClick={() => handleNotificationClick(notif)}
              className={`flex items-start gap-3 rounded-2xl border p-3.5 transition-all cursor-pointer ${
                notif.isRead
                  ? 'border-line-soft/60 bg-night-900/60 text-mute hover:border-line hover:bg-night-850'
                  : 'border-amber/40 bg-night-850 text-ink shadow-sm hover:border-amber'
              }`}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-night-950/80 border border-line-soft shadow-sm mt-0.5">
                {getIcon(notif.type)}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-xs font-semibold text-ink leading-snug">
                    {notif.title || notif.message}
                  </p>
                  <span className="shrink-0 font-mono text-[10px] text-dim">
                    {relTime(new Date(notif.createdAt).getTime())}
                  </span>
                </div>

                {notif.message && notif.title && (
                  <p className="text-[11px] text-mute mt-0.5 line-clamp-2">
                    {notif.message}
                  </p>
                )}
              </div>

              {!notif.isRead && (
                <div className="h-2 w-2 shrink-0 rounded-full bg-amber mt-2 shadow-[0_0_6px_rgba(255,178,36,0.8)]" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
