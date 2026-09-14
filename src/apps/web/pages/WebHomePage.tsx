import React, { useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useData } from '../../../context/DataContext';
import type { PostDTO } from '../../../lib/types';
import StoryBar from '../../../components/social/StoryBar';
import CreatePost from '../../../components/social/CreatePost';
import FeedList from '../../../components/social/FeedList';
import { Shield, ShieldAlert, Clock, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { fmtCountdown } from '../../../lib/utils';

export default function WebHomePage() {
  const { currentUser } = useAuth();
  const { activeTimer, activeSos } = useData();
  const [newlyCreatedPost, setNewlyCreatedPost] = useState<PostDTO | null>(null);

  return (
    <div className="space-y-5 max-w-2xl mx-auto w-full pb-10">
      {/* Subtle Safety Notification Banner (only if active timer or SOS) */}
      {activeSos ? (
        <div className="flex items-center justify-between rounded-2xl border border-sos/50 bg-sos/15 p-3 text-xs text-sos animate-pulse shadow-md">
          <div className="flex items-center gap-2 font-bold">
            <ShieldAlert size={18} />
            <span>Emergency SOS is active. Emergency response dispatched.</span>
          </div>
          <Link
            to="/app/safety"
            className="rounded-lg bg-sos px-2.5 py-1 text-xs font-black text-white hover:bg-sos/90 transition-colors"
          >
            View SOS
          </Link>
        </div>
      ) : activeTimer ? (
        <div className="flex items-center justify-between rounded-2xl border border-amber/40 bg-amber/10 p-3 text-xs text-amber shadow-sm">
          <div className="flex items-center gap-2">
            <Clock size={16} />
            <span>
              Meeting timer in progress: <strong className="font-mono">{fmtCountdown(Math.max(0, new Date(activeTimer.expiresAt).getTime() - Date.now()))}</strong>
            </span>
          </div>
          <Link
            to="/app/safety"
            className="rounded-lg border border-amber/40 bg-amber/20 px-2.5 py-1 text-[11px] font-bold text-amber hover:bg-amber/30 transition-colors"
          >
            Safety Center
          </Link>
        </div>
      ) : null}

      {/* Stories Carousel */}
      <StoryBar />

      {/* Social Post Composer */}
      <CreatePost onPostCreated={(post) => setNewlyCreatedPost(post)} />

      {/* Social Home Feed */}
      <FeedList
        scope="home"
        newPost={newlyCreatedPost}
        emptyTitle="Your Social Feed is Empty"
        emptyMessage="Follow people or discover nearby connections to see their posts, updates, and stories right here."
      />
    </div>
  );
}
