import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../lib/api';
import type { PostDTO } from '../../lib/types';
import PostCard from './PostCard';
import { EmptyState, ErrorState, SkeletonCard } from '../ui';
import { Sparkles, Loader2, RefreshCw } from 'lucide-react';

interface FeedListProps {
  scope?: 'home' | 'explore' | 'following' | 'connections';
  newPost?: PostDTO | null;
  emptyTitle?: string;
  emptyMessage?: string;
  className?: string;
}

export default function FeedList({
  scope = 'home',
  newPost,
  emptyTitle = 'No posts in your feed yet',
  emptyMessage = 'Connect with or follow other verified members to see their posts here.',
  className = '',
}: FeedListProps) {
  const [posts, setPosts] = useState<PostDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  // Prepend newPost if passed from parent composer
  useEffect(() => {
    if (newPost) {
      setPosts((prev) => {
        // Prevent duplicate addition
        if (prev.some((p) => p.id === newPost.id)) return prev;
        return [newPost, ...prev];
      });
    }
  }, [newPost]);

  const loadFeed = useCallback(
    async (cursor?: string, append: boolean = false) => {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const res = await api.feed.get({
          limit: 20,
          cursor,
          scope,
        });

        setPosts((prev) => {
          if (!append) return res.items;
          const seen = new Set(prev.map((p) => p.id));
          const additions = res.items.filter((p) => !seen.has(p.id));
          return [...prev, ...additions];
        });

        setNextCursor(res.nextCursor);
        setHasMore(res.hasMore);
      } catch (err: any) {
        setError(err?.message || 'Failed to load feed.');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [scope]
  );

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  const handlePostDeleted = (postId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  };

  if (loading) {
    return (
      <div className={`space-y-4 ${className}`}>
        {[1, 2, 3].map((i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className={className}>
        <ErrorState message={error} onRetry={() => loadFeed()} />
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className={className}>
        <EmptyState
          icon={<Sparkles size={32} className="text-amber" />}
          title={emptyTitle}
          description={emptyMessage}
          actionLabel="Refresh Feed"
          onAction={() => loadFeed()}
        />
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {posts.map((post) => (
        <PostCard key={post.id} post={post} onPostDeleted={handlePostDeleted} />
      ))}

      {/* Pagination Load More */}
      {hasMore && (
        <div className="pt-2 pb-6 flex justify-center">
          <button
            type="button"
            onClick={() => nextCursor && loadFeed(nextCursor, true)}
            disabled={loadingMore}
            className="flex items-center gap-2 rounded-2xl border border-line-soft bg-night-850 px-5 py-2.5 text-xs font-bold text-mute hover:border-amber/40 hover:text-amber transition-colors disabled:opacity-50 shadow-sm"
          >
            {loadingMore ? (
              <>
                <Loader2 size={14} className="animate-spin text-amber" />
                <span>Loading more posts...</span>
              </>
            ) : (
              <>
                <RefreshCw size={14} />
                <span>Load Older Posts</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
