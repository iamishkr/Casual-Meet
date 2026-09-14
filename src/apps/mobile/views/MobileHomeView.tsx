import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { useData } from '../../../context/DataContext';
import StoryBar from '../../../components/social/StoryBar';
import FeedList from '../../../components/social/FeedList';
import MobileCreateSheet from '../components/MobileCreateSheet';
import type { PostDTO } from '../../../lib/types';
import {
  ShieldAlert,
  Clock,
  Image,
  Sparkles,
} from 'lucide-react';
import { fmtCountdown } from '../../../lib/utils';

export default function MobileHomeView() {
  const { currentUser } = useAuth();
  const { activeSos, activeTimer } = useData();
  const [createSheetOpen, setCreateSheetOpen] = useState(false);
  const [newlyCreatedPost, setNewlyCreatedPost] = useState<PostDTO | null>(null);

  return (
    <div className="space-y-4">
      {/* Active Safety Alert Banner (Only shown if SOS or Timer is active) */}
      {activeSos && (
        <div className="rounded-2xl border border-sos/50 bg-sos/15 p-3.5 text-sos shadow-sm backdrop-blur-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <ShieldAlert size={20} className="text-sos animate-pulse shrink-0" />
              <div>
                <h3 className="font-display text-xs font-bold">EMERGENCY SOS ACTIVE</h3>
                <p className="text-[10px] text-sos/80">Emergency contacts notified with location.</p>
              </div>
            </div>
            <Link
              to="/mobile/safety"
              className="rounded-xl bg-sos px-3 py-1 text-xs font-bold text-night-950 hover:bg-sos/90"
            >
              Manage
            </Link>
          </div>
        </div>
      )}

      {!activeSos && activeTimer && (
        <div className="rounded-2xl border border-amber/40 bg-amber/10 p-3 text-ink shadow-sm backdrop-blur-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Clock size={18} className="text-amber shrink-0" />
              <div>
                <h3 className="font-display text-xs font-bold">Meeting Timer Active</h3>
                <p className="text-[10px] text-mute">
                  Server countdown: <span className="font-mono text-amber font-bold">{fmtCountdown(Math.max(0, new Date(activeTimer.expiresAt).getTime() - Date.now()))}</span>
                </p>
              </div>
            </div>
            <Link
              to="/mobile/safety"
              className="rounded-xl bg-amber px-3 py-1 text-xs font-bold text-night-950 hover:bg-amber/90"
            >
              View
            </Link>
          </div>
        </div>
      )}

      {/* Stories Tray Carousel */}
      <StoryBar />

      {/* Quick Mobile Post Composer Trigger */}
      <div
        onClick={() => setCreateSheetOpen(true)}
        className="flex items-center gap-3 rounded-2xl border border-line-soft bg-night-850/80 p-3 shadow-sm backdrop-blur-sm cursor-pointer hover:border-line transition-colors"
      >
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-display text-xs font-bold text-night-950 shadow-sm"
          style={{
            background: `linear-gradient(135deg, hsl(${currentUser?.avatarHue ?? 210} 85% 68%), hsl(${((currentUser?.avatarHue ?? 210) + 42) % 360} 80% 55%))`,
          }}
        >
          {currentUser?.name?.slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 rounded-xl bg-night-900/60 px-3.5 py-2 text-xs text-dim">
          Share an update or photo...
        </div>
        <button
          type="button"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-night-800 text-amber hover:bg-night-750 transition-colors"
          title="Add Media"
        >
          <Image size={16} />
        </button>
      </div>

      {/* Social Feed List */}
      <div className="space-y-4">
        <FeedList
          scope="home"
          newPost={newlyCreatedPost}
          emptyTitle="Your feed is empty"
          emptyMessage="Follow other verified members or post an update to see content here."
        />
      </div>

      {/* Mobile Create Post Sheet */}
      <MobileCreateSheet
        open={createSheetOpen}
        onClose={() => setCreateSheetOpen(false)}
        onPostCreated={(post) => setNewlyCreatedPost(post)}
      />
    </div>
  );
}
