import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { useData } from '../../../context/DataContext';
import { api } from '../../../lib/api';
import {
  Shield,
  Compass,
  Plus,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';
import { Button } from '../../../components/ui';
import type { DiscoverItem } from '../../../lib/types';
import CreatePostModal from '../components/CreatePostModal';

export default function WebHomePage() {
  const { currentUser } = useAuth();
  const { activeTimer, activeSos } = useData();
  const [nearby, setNearby] = useState<DiscoverItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  useEffect(() => {
    api.discover(15)
      .then((data) => {
        setNearby(Array.isArray(data) ? data.slice(0, 4) : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Welcome Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-amber/30 bg-gradient-to-br from-night-850 via-night-900 to-amber/5 p-7 shadow-xl">
        <div className="relative z-10 max-w-2xl space-y-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber/40 bg-amber/15 px-3 py-1 font-mono text-[11px] font-bold text-amber uppercase">
            <Sparkles size={12} /> Social Discovery & Safety Platform
          </span>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-ink">
            Welcome back, <span className="text-amber">{currentUser?.name}</span>
          </h1>
          <p className="text-xs sm:text-sm text-mute leading-relaxed">
            Discover verified people nearby for real-world hangouts, protected by
            authoritative server-side meeting timers, verified Safe Zones, and instant SOS dispatch.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Button
              variant="primary"
              size="md"
              onClick={() => setCreateModalOpen(true)}
              leftIcon={<Plus size={16} strokeWidth={2.5} />}
            >
              Create Post
            </Button>
            <Link to="/app/discover">
              <Button
                variant="outline"
                size="md"
                leftIcon={<Compass size={16} className="text-amber" />}
              >
                Explore Nearby
              </Button>
            </Link>
          </div>
        </div>

        {/* Ambient Glow */}
        <div className="pointer-events-none absolute -right-10 -bottom-10 h-64 w-64 rounded-full bg-amber/10 blur-3xl" />
      </div>

      {/* Safety & Profile Readiness Checklist */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Card 1: Identity Verification */}
        <div className="rounded-2xl border border-line-soft bg-night-850/70 p-4 shadow-sm backdrop-blur-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-dim">
              Identity Status
            </span>
            {currentUser?.isVerified ? (
              <CheckCircle2 size={16} className="text-safe" />
            ) : (
              <AlertCircle size={16} className="text-amber" />
            )}
          </div>
          <p className="font-display text-sm font-bold text-ink">
            {currentUser?.isVerified ? 'ID Verified' : 'Unverified Profile'}
          </p>
          <p className="text-[11px] text-mute mt-1">
            {currentUser?.isVerified
              ? 'Your government ID badge is active and recognized.'
              : 'Submit verification to increase trust score to 100+.'}
          </p>
          {!currentUser?.isVerified && (
            <Link
              to="/app/profile"
              className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-amber hover:underline"
            >
              Get Verified <ArrowRight size={12} />
            </Link>
          )}
        </div>

        {/* Card 2: Active Safety Protection */}
        <div className="rounded-2xl border border-line-soft bg-night-850/70 p-4 shadow-sm backdrop-blur-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-dim">
              Meeting Safety
            </span>
            <Shield size={16} className={activeTimer ? 'text-amber' : 'text-safe'} />
          </div>
          <p className="font-display text-sm font-bold text-ink">
            {activeSos
              ? 'Emergency Active'
              : activeTimer
              ? 'Timer In Progress'
              : 'Protection Ready'}
          </p>
          <p className="text-[11px] text-mute mt-1">
            {activeSos
              ? 'Emergency response personnel notified.'
              : activeTimer
              ? 'Server countdown running with auto-escalation.'
              : 'Start a meeting timer before meeting a connection.'}
          </p>
          <Link
            to="/app/safety"
            className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-amber hover:underline"
          >
            Safety Center <ArrowRight size={12} />
          </Link>
        </div>

        {/* Card 3: Trust Score */}
        <div className="rounded-2xl border border-line-soft bg-night-850/70 p-4 shadow-sm backdrop-blur-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-dim">
              Safety Reputation
            </span>
            <span className="font-mono text-xs font-bold text-amber">
              {currentUser?.trustScore ?? 100} pts
            </span>
          </div>
          <p className="font-display text-sm font-bold text-ink">Trust Score</p>
          <p className="text-[11px] text-mute mt-1">
            Calculated from verified ID, safe meetups, and clean account history.
          </p>
          <div className="mt-3 h-1.5 w-full rounded-full bg-night-750 overflow-hidden">
            <div
              className="h-full bg-amber rounded-full shadow-[0_0_8px_rgba(255,178,36,0.7)]"
              style={{ width: `${Math.min(100, (currentUser?.trustScore ?? 100) / 1.5)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Discovery Quick Preview Section */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-base font-bold text-ink">Nearby People</h2>
            <p className="text-xs text-mute">
              Real geospatial discovery powered by MongoDB $geoNear
            </p>
          </div>
          <Link
            to="/app/discover"
            className="text-xs font-bold text-amber hover:underline flex items-center gap-1"
          >
            View All <ArrowRight size={13} />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-44 rounded-2xl border border-line-soft bg-night-850/50 animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {nearby.map((item) => (
              <div
                key={item.user.id}
                className="rounded-2xl border border-line-soft bg-night-850/80 p-4 shadow-sm hover:border-amber/40 hover:bg-night-800/90 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div
                      className="flex h-11 w-11 items-center justify-center rounded-full font-display font-bold text-night-950 shadow-md"
                      style={{
                        background: `linear-gradient(135deg, hsl(${item.user.avatarHue} 85% 68%), hsl(${(item.user.avatarHue + 42) % 360} 80% 55%))`,
                      }}
                    >
                      {item.user.name.slice(0, 2).toUpperCase()}
                    </div>
                    <span className="rounded-md border border-line bg-night-900 px-2 py-0.5 font-mono text-[10px] text-amber font-semibold">
                      {item.distanceKm.toFixed(1)} km
                    </span>
                  </div>
                  <h3 className="font-display text-xs font-bold text-ink truncate">
                    {item.user.name}
                  </h3>
                  <p className="font-mono text-[10px] text-dim truncate">
                    @{item.user.username}
                  </p>
                  <p className="text-[11px] text-mute mt-1 line-clamp-2">
                    {item.user.bio || 'Active CasualMeet member.'}
                  </p>
                </div>

                <div className="pt-3 border-t border-line-soft/60 mt-3">
                  <Link to="/app/discover" className="w-full block">
                    <Button variant="outline" size="sm" className="w-full text-xs">
                      Connect
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Social Feed Foundation Placeholder Card (Phase 3B readiness) */}
      <div className="rounded-2xl border border-dashed border-line-soft bg-night-900/40 p-6 text-center space-y-3">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-line-soft bg-night-850 text-amber">
          <Sparkles size={20} />
        </div>
        <h3 className="font-display text-sm font-bold text-ink">
          Social Community Feed Coming in Phase 3B
        </h3>
        <p className="max-w-md mx-auto text-xs text-mute leading-relaxed">
          The foundation is ready! Posts, Stories, Likes, Comments, Followers, and Media Sharing
          will connect to our authoritative MongoDB backend in the upcoming phase.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCreateModalOpen(true)}
          leftIcon={<Plus size={14} />}
        >
          Draft a Meetup Post
        </Button>
      </div>

      {/* Modal for Post Creation */}
      <CreatePostModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
      />
    </div>
  );
}
