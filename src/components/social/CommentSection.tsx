import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import type { PostCommentDTO } from '../../lib/types';
import { relTime } from '../../lib/utils';
import { Send, Trash2, Shield, Loader2 } from 'lucide-react';
import ReportModal from './ReportModal';

interface CommentSectionProps {
  postId: string;
  postAuthorId: string;
  initialCommentCount: number;
  onCommentCountChange?: (newCount: number) => void;
}

export default function CommentSection({
  postId,
  postAuthorId,
  initialCommentCount,
  onCommentCountChange,
}: CommentSectionProps) {
  const { currentUser, isAdmin } = useAuth();
  const { toast } = useToast();

  const [comments, setComments] = useState<PostCommentDTO[]>([]);
  const [total, setTotal] = useState(initialCommentCount);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [reportingCommentId, setReportingCommentId] = useState<string | null>(null);

  const fetchComments = async (pageToFetch: number, append: boolean = false) => {
    try {
      const res = await api.posts.getComments(postId, pageToFetch, 20);
      setComments((prev) => (append ? [...prev, ...res.comments] : res.comments));
      setTotal(res.total);
      setHasMore(res.comments.length + (append ? comments.length : 0) < res.total);
      if (onCommentCountChange) onCommentCountChange(res.total);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComments(1);
  }, [postId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanText = text.trim();
    if (!cleanText || submitting) return;

    setSubmitting(true);
    try {
      const newComment = await api.posts.addComment(postId, cleanText);
      setComments((prev) => [newComment, ...prev]);
      const nextTotal = total + 1;
      setTotal(nextTotal);
      if (onCommentCountChange) onCommentCountChange(nextTotal);
      setText('');
      toast('ok', 'Comment Added', 'Your comment has been published.');
    } catch (err: any) {
      toast('err', 'Failed to Comment', err?.message || 'Could not post comment.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    try {
      await api.posts.deleteComment(commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      const nextTotal = Math.max(0, total - 1);
      setTotal(nextTotal);
      if (onCommentCountChange) onCommentCountChange(nextTotal);
      toast('ok', 'Comment Deleted', 'The comment was removed.');
    } catch (err: any) {
      toast('err', 'Delete Failed', err?.message || 'Could not delete comment.');
    }
  };

  return (
    <div className="border-t border-line-soft/60 pt-3 mt-3 space-y-3">
      {/* Add comment input */}
      {currentUser && (
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <div
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-display text-[10px] font-bold text-night-950"
            style={{
              background: `linear-gradient(135deg, hsl(${currentUser.avatarHue} 85% 68%), hsl(${(currentUser.avatarHue + 42) % 360} 80% 55%))`,
            }}
          >
            {currentUser.name.slice(0, 2).toUpperCase()}
          </div>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write a comment..."
            maxLength={1000}
            className="flex-1 rounded-xl border border-line bg-night-900 px-3 py-1.5 text-xs text-ink placeholder:text-dim outline-none transition-colors focus:border-amber/60"
          />
          <button
            type="submit"
            disabled={!text.trim() || submitting}
            className="rounded-xl bg-amber px-3 py-1.5 text-xs font-bold text-night-950 hover:bg-amber-light disabled:opacity-50 transition-all"
          >
            {submitting ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
          </button>
        </form>
      )}

      {/* Comments list */}
      {loading ? (
        <div className="flex items-center justify-center py-4 text-xs text-dim">
          <Loader2 size={16} className="animate-spin mr-2" /> Loading comments...
        </div>
      ) : comments.length === 0 ? (
        <p className="text-center text-[11px] text-mute py-3">
          No comments yet. Be the first to share your thoughts!
        </p>
      ) : (
        <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
          {comments.map((c) => {
            const isOwnComment = currentUser?.id === c.author._id;
            const isPostOwner = currentUser?.id === postAuthorId;
            const canDelete = isOwnComment || isPostOwner || isAdmin;

            return (
              <div
                key={c.id}
                className="flex items-start justify-between gap-2.5 rounded-xl bg-night-900/60 p-2.5 border border-line-soft/40 text-xs"
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <div
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-display text-[10px] font-bold text-night-950"
                    style={{
                      background: `linear-gradient(135deg, hsl(${c.author.avatarHue} 85% 68%), hsl(${(c.author.avatarHue + 42) % 360} 80% 55%))`,
                    }}
                  >
                    {c.author.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-ink truncate">{c.author.name}</span>
                      {c.author.isVerified && (
                        <span title="Verified ID" className="inline-flex items-center">
                          <Shield size={11} className="text-safe shrink-0" />
                        </span>
                      )}
                      <span className="font-mono text-[10px] text-dim">
                        • {relTime(new Date(c.createdAt).getTime())}
                      </span>
                      {c.isEdited && (
                        <span className="font-mono text-[9px] text-dim italic">(edited)</span>
                      )}
                    </div>
                    <p className="text-xs text-ink mt-0.5 break-words whitespace-pre-wrap">{c.text}</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0 opacity-80 hover:opacity-100">
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => handleDelete(c.id)}
                      className="rounded p-1 text-mute hover:text-sos transition-colors"
                      title="Delete comment"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                  {!isOwnComment && (
                    <button
                      type="button"
                      onClick={() => setReportingCommentId(c.id)}
                      className="rounded p-1 text-dim hover:text-amber transition-colors text-[10px]"
                      title="Report comment"
                    >
                      Report
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {hasMore && (
            <button
              type="button"
              onClick={() => {
                const nextPage = page + 1;
                setPage(nextPage);
                fetchComments(nextPage, true);
              }}
              className="w-full py-1 text-center font-mono text-[10px] text-amber hover:underline"
            >
              Load older comments ({total - comments.length} remaining)
            </button>
          )}
        </div>
      )}

      {/* Comment Reporting Modal */}
      {reportingCommentId && (
        <ReportModal
          open={Boolean(reportingCommentId)}
          onClose={() => setReportingCommentId(null)}
          targetType="comment"
          targetId={reportingCommentId}
        />
      )}
    </div>
  );
}
