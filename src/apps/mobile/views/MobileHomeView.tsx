import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { useData } from '../../../context/DataContext';
import { api } from '../../../lib/api';
import type { DiscoverItem } from '../../../lib/types';
import {
  Shield,
  ShieldAlert,
  Clock,
  Compass,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Plus,
} from 'lucide-react';
import { Button } from '../../../components/ui';

export default function MobileHomeView() {
  const { currentUser } = useAuth();
  const { activeSos, activeTimer } = useData();
  const [nearby, setNearby] = useState<DiscoverItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.discover(10)
      .then((data) => {
        setNearby(Array.isArray(data) ? data.slice(0, 5) : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      {/* Safety Status Banner */}
      <div
        className={`rounded-2xl border p-4 shadow-sm backdrop-blur-md transition-all ${
          activeSos
            ? 'border-sos/50 bg-sos/15 text-sos'
            : activeTimer
            ? 'border-amber/40 bg-amber/10'
            : 'border-line-soft bg-night-850/80'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {activeSos ? (
              <ShieldAlert size={20} className="text-sos animate-pulse" />
            ) : (
              <Shield size={20} className={activeTimer ? 'text-amber' : 'text-safe'} />
            )}
            <div>
              <h3 className="font-display text-xs font-bold text-ink">
                {activeSos
                  ? 'EMERGENCY SOS ACTIVE'
                  : activeTimer
                  ? 'Meeting Timer In Progress'
                  : 'Safety Shield Active'}
              </h3>
              <p className="text-[10px] text-mute">
                {activeSos
                  ? 'Emergency contacts notified with location.'
                  : activeTimer
                  ? 'Authoritative server countdown running.'
                  : 'All verified public Safe Zones ready.'}
              </p>
            </div>
          </div>
          <Link
            to="/mobile/safety"
            className="rounded-lg bg-night-800 px-2.5 py-1 text-[11px] font-bold text-amber hover:bg-night-750"
          >
            Manage
          </Link>
        </div>
      </div>

      {/* Welcome Greeting */}
      <div className="rounded-2xl border border-line-soft bg-night-850/80 p-4 shadow-sm backdrop-blur-md">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-base font-bold text-ink">
              Hi, {currentUser?.name?.split(' ')[0]} 👋
            </h2>
            <p className="text-xs text-mute mt-0.5">
              Ready for a safe public hangout nearby?
            </p>
          </div>
          <span className="font-mono text-xs font-bold text-amber rounded-lg bg-amber/10 border border-amber/30 px-2 py-1">
            {currentUser?.trustScore} pts
          </span>
        </div>
      </div>

      {/* Nearby People (Horizontal Scroll Carousel) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="font-display text-xs font-bold uppercase tracking-wider text-ink flex items-center gap-1.5">
            <Compass size={14} className="text-amber" />
            Nearby Verified People
          </h3>
          <Link
            to="/mobile/discover"
            className="text-[11px] font-bold text-amber hover:underline flex items-center gap-0.5"
          >
            All <ArrowRight size={12} />
          </Link>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-2 pt-1 no-scrollbar">
          {loading ? (
            [1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-32 w-32 shrink-0 rounded-2xl border border-line-soft bg-night-850/50 animate-pulse"
              />
            ))
          ) : nearby.length === 0 ? (
            <p className="text-xs text-mute py-4 px-2">No people nearby right now.</p>
          ) : (
            nearby.map((item) => (
              <Link
                key={item.user.id}
                to="/mobile/discover"
                className="flex w-36 shrink-0 flex-col justify-between rounded-2xl border border-line-soft bg-night-850/90 p-3 shadow-sm hover:border-amber/40 transition-all text-left"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-xl font-display text-xs font-bold text-night-950 shadow-sm"
                      style={{
                        background: `linear-gradient(135deg, hsl(${item.user.avatarHue} 85% 68%), hsl(${(item.user.avatarHue + 42) % 360} 80% 55%))`,
                      }}
                    >
                      {item.user.name.slice(0, 2).toUpperCase()}
                    </div>
                    <span className="font-mono text-[9px] font-bold text-amber">
                      {item.distanceKm.toFixed(1)}km
                    </span>
                  </div>
                  <p className="font-display text-xs font-bold text-ink truncate">
                    {item.user.name}
                  </p>
                  <p className="text-[10px] text-mute truncate mt-0.5">
                    {item.user.occupation || 'Member'}
                  </p>
                </div>
                <span className="mt-2 block w-full rounded-lg bg-night-800 py-1 text-center font-mono text-[9px] font-bold text-amber">
                  Connect
                </span>
              </Link>
            ))
          )}
        </div>
      </div>

      {/* Social Feed Placeholder (Phase 3B Foundation) */}
      <div className="rounded-2xl border border-dashed border-line-soft bg-night-900/40 p-5 text-center space-y-2">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-line-soft bg-night-850 text-amber">
          <Sparkles size={18} />
        </div>
        <h4 className="font-display text-xs font-bold text-ink">
          Social Media Feed Coming in Phase 3B
        </h4>
        <p className="text-[11px] text-mute leading-relaxed">
          Stories, Posts, Comments, and Media Uploads are being connected to our authoritative backend.
        </p>
      </div>
    </div>
  );
}
