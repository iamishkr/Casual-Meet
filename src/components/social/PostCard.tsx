import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { PostDTO } from '../../lib/types';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../lib/api';
import { relTime } from '../../lib/utils';
import PostMedia from './PostMedia';
import CommentSection from './CommentSection';
import ReportModal from './ReportModal';
import {
  Heart,
  MessageCircle,
  Share2,
  MoreHorizontal,
  Shield,
  MapPin,
  Trash2,
  Flag,
  Globe,
  Users,
  Lock,
} from 'lucide-react';

interface PostCardProps {
  post: PostDTO;
  onPostDeleted?: (postId: string) => void;
}

export default function PostCard({ post, onPostDeleted }: PostCardProps) {
  const location = useLocation();
  const isMobile = location.pathname.startsWith('/mobile');
  const profilePrefix = isMobile ? '/mobile/profile' : '/app/profile';

  const { currentUser, isAdmin } = useAuth();
  const { toast } = useToast();

  const [isLiked, setIsLiked] = useState(post.isLiked);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [commentCount, setCommentCount] = useState(post.commentCount);
  const [likeLoading, setLikeLoading] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isAuthor = currentUser?.id === post.author._id;
  const canDelete = isAuthor || isAdmin;

  const handleLikeToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser) {
      toast('info', 'Sign in required', 'Please sign in to like posts.');
      return;
    }
    if (likeLoading) return;

    const prevLiked = isLiked;
    const prevCount = likeCount;

    // Optimistic UI update
    setIsLiked(!prevLiked);
    setLikeCount(prevLiked ? Math.max(0, prevCount - 1) : prevCount + 1);
    setLikeLoading(true);

    try {
      if (prevLiked) {
        const res = await api.posts.unlike(post.id);
        setLikeCount(res.likeCount);
        setIsLiked(res.liked);
      } else {
        const res = await api.posts.like(post.id);
        setLikeCount(res.likeCount);
        setIsLiked(res.liked);
      }
    } catch (err: any) {
      // Rollback on error
      setIsLiked(prevLiked);
      setLikeCount(prevCount);
      toast('err', 'Like Failed', err?.message || 'Could not update like status.');
    } finally {
      setLikeLoading(false);
    }
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const shareUrl = `${window.location.origin}${profilePrefix}/${post.author._id}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Post by ${post.author.name}`,
          text: post.caption,
          url: shareUrl,
        });
        return;
      } catch {
        // Fallback to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      toast('ok', 'Link Copied', 'Post link copied to clipboard.');
    } catch {
      toast('info', 'Share Post', shareUrl);
    }
  };

  const handleDeletePost = async () => {
    if (deleting) return;
    if (!window.confirm('Are you sure you want to delete this post?')) return;
    setDeleting(true);
    try {
      await api.posts.delete(post.id);
      toast('ok', 'Post Deleted', 'Your post has been removed.');
      if (onPostDeleted) onPostDeleted(post.id);
    } catch (err: any) {
      toast('err', 'Delete Failed', err?.message || 'Could not delete post.');
    } finally {
      setDeleting(false);
    }
  };

  const getVisibilityIcon = () => {
    switch (post.visibility) {
      case 'followers':
        return (
          <span title="Followers only" className="inline-flex items-center">
            <Users size={12} className="text-amber" />
          </span>
        );
      case 'connections':
        return (
          <span title="Connections only" className="inline-flex items-center">
            <Users size={12} className="text-safe" />
          </span>
        );
      case 'private':
        return (
          <span title="Private post" className="inline-flex items-center">
            <Lock size={12} className="text-dim" />
          </span>
        );
      default:
        return (
          <span title="Public post" className="inline-flex items-center">
            <Globe size={12} className="text-mute" />
          </span>
        );
    }
  };

  return (
    <article className="rounded-3xl border border-line-soft bg-night-850/80 p-5 shadow-sm backdrop-blur-sm transition-all hover:border-line">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <Link
          to={`${profilePrefix}/${post.author._id}`}
          className="flex items-center gap-3 group min-w-0"
        >
          {/* Avatar with Hue Gradient */}
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl font-display text-sm font-black text-night-950 shadow-md group-hover:scale-105 transition-transform"
            style={{
              background: `linear-gradient(135deg, hsl(${post.author.avatarHue ?? 210} 85% 68%), hsl(${((post.author.avatarHue ?? 210) + 42) % 360} 80% 55%))`,
            }}
          >
            {post.author.name?.slice(0, 2).toUpperCase()}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="font-display text-sm font-bold text-ink group-hover:text-amber transition-colors truncate">
                {post.author.name}
              </h3>
              {post.author.isVerified && (
                <span title="Verified Identity" className="inline-flex items-center">
                  <Shield size={13} className="text-safe shrink-0" />
                </span>
              )}
              <span className="font-mono text-[11px] text-dim truncate">
                @{post.author.username}
              </span>
            </div>

            <div className="flex items-center gap-2 font-mono text-[10px] text-dim mt-0.5">
              <span>{relTime(new Date(post.createdAt).getTime())}</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                {getVisibilityIcon()}
                <span className="capitalize">{post.visibility}</span>
              </span>
              {post.locationName && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-0.5 text-mute truncate max-w-[140px]">
                    <MapPin size={10} className="text-amber shrink-0" />
                    <span className="truncate">{post.locationName}</span>
                  </span>
                </>
              )}
            </div>
          </div>
        </Link>

        {/* Post Options Menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="rounded-lg p-1.5 text-mute hover:bg-night-800 hover:text-ink transition-colors"
            title="Post options"
          >
            <MoreHorizontal size={18} />
          </button>

          {menuOpen && (
            <div
              className="absolute right-0 top-8 z-20 w-40 rounded-2xl border border-line bg-night-900/95 p-1 shadow-xl backdrop-blur-md space-y-0.5"
              onClick={() => setMenuOpen(false)}
            >
              {canDelete && (
                <button
                  type="button"
                  onClick={handleDeletePost}
                  disabled={deleting}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-sos hover:bg-sos/15 transition-colors"
                >
                  <Trash2 size={14} />
                  <span>{deleting ? 'Deleting...' : 'Delete Post'}</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setReportModalOpen(true)}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-mute hover:bg-night-800 hover:text-ink transition-colors"
              >
                <Flag size={14} />
                <span>Report Post</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Caption Content */}
      {post.caption && (
        <p className="mt-3.5 text-xs sm:text-sm text-ink leading-relaxed break-words whitespace-pre-wrap">
          {post.caption}
        </p>
      )}

      {/* Media Gallery */}
      <PostMedia media={post.media} alt={`Post by ${post.author.name}`} />

      {/* Post Actions Bar */}
      <div className="flex items-center justify-between border-t border-line-soft/60 pt-3 mt-4 text-xs font-semibold text-mute">
        <div className="flex items-center gap-4">
          {/* Like Button */}
          <button
            type="button"
            onClick={handleLikeToggle}
            className={`flex items-center gap-1.5 transition-colors ${
              isLiked ? 'text-rose-500 font-bold' : 'hover:text-rose-500'
            }`}
          >
            <Heart size={17} className={isLiked ? 'fill-rose-500 text-rose-500' : ''} />
            <span className="font-mono text-xs">{likeCount}</span>
          </button>

          {/* Comment Button */}
          <button
            type="button"
            onClick={() => setShowComments(!showComments)}
            className={`flex items-center gap-1.5 transition-colors ${
              showComments ? 'text-amber font-bold' : 'hover:text-amber'
            }`}
          >
            <MessageCircle size={17} />
            <span className="font-mono text-xs">{commentCount}</span>
          </button>
        </div>

        {/* Share Button */}
        <button
          type="button"
          onClick={handleShare}
          className="flex items-center gap-1.5 hover:text-ink transition-colors"
          title="Share post"
        >
          <Share2 size={16} />
          <span className="hidden sm:inline text-xs">Share</span>
        </button>
      </div>

      {/* Expandable Comments Drawer */}
      {showComments && (
        <CommentSection
          postId={post.id}
          postAuthorId={post.author._id}
          initialCommentCount={post.commentCount}
          onCommentCountChange={setCommentCount}
        />
      )}

      {/* Report Modal */}
      {reportModalOpen && (
        <ReportModal
          open={reportModalOpen}
          onClose={() => setReportModalOpen(false)}
          targetType="post"
          targetId={post.id}
          targetName={`Post by ${post.author.name}`}
        />
      )}
    </article>
  );
}
