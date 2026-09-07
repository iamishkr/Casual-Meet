import React, { useState } from 'react';
import { Modal, Button, Input } from '../../../components/ui';
import { Image, MapPin, Shield, Sparkles, Smile } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { useToasts } from '../../../context/ToastContext';

interface CreatePostModalProps {
  open: boolean;
  onClose: () => void;
}

export default function CreatePostModal({ open, onClose }: CreatePostModalProps) {
  const { currentUser } = useAuth();
  const { toast } = useToasts();
  const [content, setContent] = useState('');
  const [tag, setTag] = useState('Coffee & Chat');

  const handlePublishPlaceholder = () => {
    toast('info', 'Post Created (Foundation Placeholder)', 'Full social media feed and media uploads will be unlocked in Phase 3B.');
    setContent('');
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create New Post"
      description="Share an activity, coffee meetup, or thought with verified nearby members."
      wide
    >
      <div className="space-y-4 pt-1">
        {/* User preview header */}
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-display font-bold text-night-950 shadow-md"
            style={{
              background: `linear-gradient(135deg, hsl(${currentUser?.avatarHue ?? 210} 85% 68%), hsl(${((currentUser?.avatarHue ?? 210) + 42) % 360} 80% 55%))`,
            }}
          >
            {currentUser?.name?.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <p className="text-xs font-bold text-ink flex items-center gap-1.5">
              {currentUser?.name}
              <span className="inline-flex items-center gap-1 rounded bg-safe/15 px-1.5 py-0.2 font-mono text-[9px] font-bold text-safe uppercase">
                <Shield size={10} /> Verified
              </span>
            </p>
            <p className="font-mono text-[10px] text-dim">@{currentUser?.username}</p>
          </div>
        </div>

        {/* Text area */}
        <div className="relative">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What's happening? Looking for a slow coffee in Koramangala or a morning run partner?"
            rows={4}
            className="w-full resize-none rounded-xl border border-line bg-night-900/90 p-3.5 text-xs text-ink placeholder:text-dim outline-none transition-colors focus:border-amber/60"
          />
        </div>

        {/* Meetup Category Selector */}
        <div>
          <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-wider text-dim">
            Meetup Activity Category
          </label>
          <div className="flex flex-wrap gap-1.5">
            {['Coffee & Chat', 'Running & Fitness', 'Tech & Startups', 'Food & Dining', 'Board Games'].map(
              (cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setTag(cat)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                    tag === cat
                      ? 'border border-amber/40 bg-amber/15 text-amber font-bold'
                      : 'border border-line bg-night-850 text-mute hover:text-ink'
                  }`}
                >
                  {cat}
                </button>
              )
            )}
          </div>
        </div>

        {/* Media / Location Toolbar */}
        <div className="flex items-center justify-between border-t border-line-soft/60 pt-3">
          <div className="flex items-center gap-2 text-mute">
            <button
              type="button"
              className="rounded-lg p-2 hover:bg-night-800 hover:text-amber transition-colors"
              title="Add Image (Coming in Phase 3B)"
            >
              <Image size={16} />
            </button>
            <button
              type="button"
              className="rounded-lg p-2 hover:bg-night-800 hover:text-amber transition-colors"
              title="Add Safe Zone Location"
            >
              <MapPin size={16} />
            </button>
            <button
              type="button"
              className="rounded-lg p-2 hover:bg-night-800 hover:text-amber transition-colors"
              title="Add Emoji"
            >
              <Smile size={16} />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={!content.trim()}
              onClick={handlePublishPlaceholder}
              leftIcon={<Sparkles size={14} />}
            >
              Post to Feed
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
