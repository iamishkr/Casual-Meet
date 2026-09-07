import React, { useState } from 'react';
import { BottomSheet, Button } from '../../../components/ui';
import { Image, MapPin, Sparkles, Smile } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';

interface MobileCreateSheetProps {
  open: boolean;
  onClose: () => void;
}

export default function MobileCreateSheet({ open, onClose }: MobileCreateSheetProps) {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('Coffee');

  const handlePost = () => {
    toast('ok', 'Post Drafted', 'Full social media feed and media uploads will be unlocked in Phase 3B.');
    setContent('');
    onClose();
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Create Meetup Post">
      <div className="space-y-4 pt-1">
        {/* User preview header */}
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-display text-xs font-bold text-night-950"
            style={{
              background: `linear-gradient(135deg, hsl(${currentUser?.avatarHue ?? 210} 85% 68%), hsl(${((currentUser?.avatarHue ?? 210) + 42) % 360} 80% 55%))`,
            }}
          >
            {currentUser?.name?.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <p className="text-xs font-bold text-ink">{currentUser?.name}</p>
            <p className="font-mono text-[10px] text-dim">@{currentUser?.username}</p>
          </div>
        </div>

        {/* Text area */}
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="What's your plan? Looking for a workout buddy or a slow coffee?"
          rows={3}
          className="w-full resize-none rounded-xl border border-line bg-night-850 p-3 text-xs text-ink placeholder:text-dim outline-none focus:border-amber/50"
        />

        {/* Categories */}
        <div>
          <span className="block font-mono text-[10px] uppercase tracking-wider text-dim mb-1.5">
            Category
          </span>
          <div className="flex flex-wrap gap-1.5">
            {['Coffee', 'Running', 'Tech', 'Food', 'Outdoors'].map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                  category === cat
                    ? 'border border-amber/50 bg-amber/20 text-amber font-bold'
                    : 'border border-line bg-night-850 text-mute'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-line-soft">
          <div className="flex items-center gap-2 text-mute">
            <button
              type="button"
              className="p-2 rounded-lg hover:bg-night-800 text-mute"
              title="Add Image (Phase 3B)"
            >
              <Image size={18} />
            </button>
            <button
              type="button"
              className="p-2 rounded-lg hover:bg-night-800 text-mute"
              title="Add Location"
            >
              <MapPin size={18} />
            </button>
          </div>

          <Button
            variant="primary"
            size="sm"
            disabled={!content.trim()}
            onClick={handlePost}
            leftIcon={<Sparkles size={14} />}
          >
            Post
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}
