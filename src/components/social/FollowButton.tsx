import React, { useState } from 'react';
import { api } from '../../lib/api';
import { useToast } from '../../context/ToastContext';
import { UserPlus, UserCheck, Loader2 } from 'lucide-react';

interface FollowButtonProps {
  userId: string;
  initialIsFollowing?: boolean;
  onFollowChange?: (isFollowing: boolean) => void;
  size?: 'sm' | 'md';
  className?: string;
}

export default function FollowButton({
  userId,
  initialIsFollowing = false,
  onFollowChange,
  size = 'sm',
  className = '',
}: FollowButtonProps) {
  const { toast } = useToast();
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [loading, setLoading] = useState(false);

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (loading) return;

    const previousState = isFollowing;
    const nextState = !previousState;

    // Optimistic UI
    setIsFollowing(nextState);
    if (onFollowChange) onFollowChange(nextState);
    setLoading(true);

    try {
      if (nextState) {
        await api.social.follow(userId);
      } else {
        await api.social.unfollow(userId);
      }
    } catch (err: any) {
      // Rollback on failure
      setIsFollowing(previousState);
      if (onFollowChange) onFollowChange(previousState);
      toast('err', 'Action Failed', err?.message || 'Failed to update follow status.');
    } finally {
      setLoading(false);
    }
  };

  const isSmall = size === 'sm';

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={loading}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl font-bold transition-all ${
        isSmall ? 'px-3 py-1 text-xs' : 'px-4 py-1.5 text-xs sm:text-sm'
      } ${
        isFollowing
          ? 'border border-line-soft bg-night-800 text-mute hover:border-sos/40 hover:bg-sos/10 hover:text-sos'
          : 'border border-amber/40 bg-amber text-night-950 hover:bg-amber-light shadow-sm'
      } ${className}`}
    >
      {loading ? (
        <Loader2 size={isSmall ? 12 : 14} className="animate-spin" />
      ) : isFollowing ? (
        <>
          <UserCheck size={isSmall ? 13 : 15} />
          <span>Following</span>
        </>
      ) : (
        <>
          <UserPlus size={isSmall ? 13 : 15} />
          <span>Follow</span>
        </>
      )}
    </button>
  );
}
