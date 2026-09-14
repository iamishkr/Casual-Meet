import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Modal } from '../ui';
import { api } from '../../lib/api';
import type { FollowDTO } from '../../lib/types';
import FollowButton from './FollowButton';
import { Shield, Loader2, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface UserListModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  userId: string;
  type: 'followers' | 'following' | 'mutual';
}

interface DisplayUser {
  _id: string;
  name: string;
  username: string;
  avatarHue: number;
  isVerified: boolean;
  city?: string;
}

export default function UserListModal({
  open,
  onClose,
  title,
  userId,
  type,
}: UserListModalProps) {
  const location = useLocation();
  const isMobile = location.pathname.startsWith('/mobile');
  const profilePrefix = isMobile ? '/mobile/profile' : '/app/profile';
  const { currentUser } = useAuth();
  const [users, setUsers] = useState<DisplayUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!open) return;
    setLoading(true);

    if (type === 'mutual') {
      api.social
        .getMutualConnections(userId, 1, 50)
        .then((res) => {
          const list = (res.mutualConnections || []).map((m) => ({
            _id: m.id,
            name: m.name,
            username: m.username,
            avatarHue: m.avatarHue,
            isVerified: m.isVerified,
            city: m.city,
          }));
          setUsers(list);
          setTotal(res.total || 0);
        })
        .catch(() => {
          setUsers([]);
          setTotal(0);
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      const promise =
        type === 'followers'
          ? api.social.getFollowers(userId, 1, 50)
          : api.social.getFollowing(userId, 1, 50);

      promise
        .then((res: any) => {
          const items = type === 'followers' ? res.followers || [] : res.following || [];
          setUsers(items.map((f: any) => f.user));
          setTotal(res.total || 0);
        })
        .catch(() => {
          setUsers([]);
          setTotal(0);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [open, userId, type]);

  return (
    <Modal open={open} onClose={onClose} title={title} description={`${total} members`}>
      <div className="space-y-3 pt-1 max-h-96 overflow-y-auto pr-1">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-xs text-dim">
            <Loader2 size={18} className="animate-spin mr-2" /> Loading {type}...
          </div>
        ) : users.length === 0 ? (
          <div className="py-8 text-center text-xs text-mute flex flex-col items-center gap-2">
            <Users size={28} className="text-dim" />
            <p>No {type} found.</p>
          </div>
        ) : (
          users.map((u) => {
            const isSelf = currentUser?.id === u._id;


            return (
              <div
                key={u._id}
                className="flex items-center justify-between gap-3 rounded-2xl bg-night-900/60 p-2.5 border border-line-soft/40 hover:border-line transition-colors"
              >
                <Link
                  to={`${profilePrefix}/${u._id}`}
                  onClick={onClose}
                  className="flex items-center gap-3 min-w-0 flex-1 group"
                >
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl font-display text-xs font-black text-night-950 shadow-md group-hover:scale-105 transition-transform"
                    style={{
                      background: `linear-gradient(135deg, hsl(${u.avatarHue} 85% 68%), hsl(${(u.avatarHue + 42) % 360} 80% 55%))`,
                    }}
                  >
                    {u.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-xs text-ink group-hover:text-amber transition-colors flex items-center gap-1 truncate">
                      {u.name}
                      {u.isVerified && <Shield size={11} className="text-safe shrink-0" />}
                    </p>
                    <p className="font-mono text-[10px] text-dim truncate">@{u.username}</p>
                  </div>
                </Link>

                {!isSelf && <FollowButton userId={u._id} size="sm" />}
              </div>
            );
          })
        )}
      </div>
    </Modal>
  );
}
