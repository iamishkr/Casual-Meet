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
  Clock,
  Shield,
  ShieldAlert,
} from 'lucide-react';
import { Button, EmptyState } from '../../../components/ui';

export default function WebNotificationsPage() {
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
        // Prevent duplicate notification IDs
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
      toast('ok', 'All Marked Read', 'Your notification feed is all caught up.');
    } catch (err: any) {
      toast('err', 'Failed', err?.message || 'Could not mark notifications as read.');
    } finally {
      setMarkingAll(false);
    }
  };

  const handleNotificationClick = async (n: SocialNotificationDTO) => {
    if (!n.isRead) {
      try {
        await api.notifications.markRead(n.id);
        setNotifications((prev) =>
          prev.map((item) => (item.id === n.id ? { ...item, isRead: true } : item))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch {
        // ignore
      }
    }

    if (n.type === 'safety_timer' || n.type === 'sos_alert' || n.type === 'sos') {
      navigate('/app/safety');
    } else if (n.type === 'new_message' || (n.targetType === 'chat' && n.targetId)) {
      navigate(`/app/messages${n.targetId ? `?chatId=${n.targetId}` : ''}`);
    } else if (n.targetType === 'user' && n.targetId) {
      navigate(`/app/profile/${n.targetId}`);
    } else if (n.actor?.id && (n.type === 'new_follower' || n.type === 'connection_requested' || n.type === 'connection_accepted')) {
      navigate(`/app/profile/${n.actor.id}`);
    } else if (n.targetType === 'post') {
      navigate('/app');
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'post_liked':
      case 'like':
        return <Heart size={16} className="text-rose-500 fill-rose-500" />;
      case 'post_commented':
      case 'comment':
        return <MessageCircle size={16} className="text-amber" />;
      case 'new_follower':
      case 'follow':
      case 'connection_requested':
      case 'connection_accepted':
        return <UserPlus size={16} className="text-safe" />;
      case 'safety_timer':
        return <Clock size={16} className="text-amber" />;
      case 'sos_alert':
      case 'sos':
        return <ShieldAlert size={16} className="text-sos" />;
      default:
        return <Sparkles size={16} className="text-amber" />;
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto w-full pb-10">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-line-soft/60 pb-5">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink flex items-center gap-2.5">
            <Bell size={24} className="text-amber" />
            Notifications
            {unreadCount > 0 && (
              <span className="rounded-full bg-amber px-2 py-0.5 font-mono text-xs font-bold text-night-950">
                {unreadCount} new
              </span>
            )}
          </h1>
          <p className="text-xs text-mute mt-1">
            Real-time updates on likes, comments, and new followers.
          </p>
        </div>

        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAllRead}
            disabled={markingAll}
            leftIcon={
              markingAll ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <CheckCheck size={14} className="text-amber" />
              )
            }
          >
            Mark All as Read
          </Button>
        )}
      </div>

      {/* Notifications List */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-xs text-dim">
          <Loader2 size={20} className="animate-spin mr-2 text-amber" /> Loading notifications...
        </div>
      ) : notifications.length === 0 ? (
        <EmptyState
          icon={<Bell size={32} className="text-amber" />}
          title="No Notifications Yet"
          description="When members like your posts, comment, or start following you, notifications will appear here."
        />
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => handleNotificationClick(n)}
              className={`flex items-start gap-3.5 rounded-2xl border p-4 shadow-sm backdrop-blur-sm cursor-pointer transition-all ${
                n.isRead
                  ? 'border-line-soft/60 bg-night-850/60 opacity-85 hover:border-line'
                  : 'border-amber/40 bg-night-850 shadow-md hover:border-amber/60'
              }`}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-night-900 border border-line-soft">
                {getNotificationIcon(n.type)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-display text-xs font-bold text-ink truncate">{n.title}</h4>
                  <span className="font-mono text-[10px] text-dim shrink-0">
                    {relTime(new Date(n.createdAt).getTime())}
                  </span>
                </div>
                <p className="text-xs text-mute mt-0.5 leading-relaxed">{n.message}</p>
              </div>

              {!n.isRead && (
                <div className="h-2 w-2 rounded-full bg-amber shrink-0 mt-2 shadow-[0_0_8px_rgba(255,178,36,0.8)]" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
