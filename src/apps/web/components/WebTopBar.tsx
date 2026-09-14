import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { useData } from '../../../context/DataContext';
import { Button } from '../../../components/ui';
import {
  Search,
  Plus,
  Shield,
  ShieldAlert,
  Clock,
  Smartphone,
  CheckCircle2,
  Menu,
} from 'lucide-react';
import { fmtCountdown } from '../../../lib/utils';
import CreatePostModal from './CreatePostModal';

interface WebTopBarProps {
  onMenuToggle?: () => void;
}

export default function WebTopBar({ onMenuToggle }: WebTopBarProps) {
  const { currentUser } = useAuth();
  const { activeSos, activeTimer, markTimerSafe, extendTimer } = useData();
  const navigate = useNavigate();

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [visualClock, setVisualClock] = useState(() => Date.now());
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const t = setInterval(() => setVisualClock(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const timerRemain = activeTimer
    ? Math.max(0, new Date(activeTimer.expiresAt).getTime() - visualClock)
    : 0;

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/app/discover?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-line-soft bg-night-900/80 px-4 sm:px-6 backdrop-blur-md">
        {/* Left section: Hamburger (mobile) + Search Bar */}
        <div className="flex items-center gap-3">
          {onMenuToggle && (
            <button
              type="button"
              onClick={onMenuToggle}
              className="rounded-xl border border-line-soft bg-night-850 p-2 text-mute hover:text-ink md:hidden transition-colors"
              title="Open Navigation"
            >
              <Menu size={18} />
            </button>
          )}

          {/* Search Bar */}
          <form onSubmit={handleSearchSubmit} className="relative w-48 sm:w-80">
            <Search
              size={15}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-mute"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search people & explore..."
              className="w-full rounded-xl border border-line bg-night-850/80 py-1.5 sm:py-2 pl-9 pr-3 text-xs text-ink placeholder:text-dim outline-none transition-all focus:border-amber/50 focus:bg-night-850"
            />
          </form>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Active SOS Warning Pill */}
          {activeSos && (
            <Link
              to="/app/safety"
              className="flex items-center gap-1.5 sm:gap-2 rounded-xl border border-sos/50 bg-sos/15 px-2.5 sm:px-3 py-1.5 text-xs font-bold text-sos animate-pulse shadow-[0_0_15px_-3px_rgba(255,93,100,0.6)]"
            >
              <ShieldAlert size={15} />
              <span className="hidden sm:inline">EMERGENCY SOS</span>
            </Link>
          )}

          {/* Active Meeting Timer Pill */}
          {!activeSos && activeTimer && (
            <div className="flex items-center gap-1.5 sm:gap-2 rounded-xl border border-amber/40 bg-amber/10 px-2.5 sm:px-3 py-1.5 text-xs font-mono font-bold text-amber shadow-[0_0_15px_-4px_rgba(255,178,36,0.4)]">
              <Clock size={14} />
              <span>{fmtCountdown(timerRemain)}</span>
              <div className="hidden sm:flex items-center gap-1 pl-1 border-l border-amber/30">
                <button
                  type="button"
                  onClick={() => extendTimer(activeTimer._id, 15)}
                  className="rounded px-1.5 py-0.5 text-[10px] uppercase font-bold hover:bg-amber/20 transition-colors"
                  title="Extend +15m"
                >
                  +15m
                </button>
                <button
                  type="button"
                  onClick={() => markTimerSafe(activeTimer._id)}
                  className="rounded px-1.5 py-0.5 text-[10px] uppercase font-bold text-safe hover:bg-safe/20 transition-colors"
                  title="Mark Safe"
                >
                  Safe
                </button>
              </div>
            </div>
          )}

          {/* Normal Safety Status Indicator */}
          {!activeSos && !activeTimer && (
            <div className="hidden lg:flex items-center gap-1.5 rounded-xl border border-safe/30 bg-safe/10 px-2.5 py-1.5 text-[11px] font-semibold text-safe">
              <CheckCircle2 size={13} />
              <span>Safety Shield Ready</span>
            </div>
          )}

          {/* Experience Switcher: Link to Consumer Mobile App */}
          <Link
            to="/mobile"
            className="hidden sm:flex items-center gap-1.5 rounded-xl border border-line-soft bg-night-850 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-mute hover:border-amber/40 hover:text-amber transition-all"
            title="Switch to Mobile App View"
          >
            <Smartphone size={14} />
            <span className="hidden md:inline">Mobile App</span>
          </Link>

          {/* Create Post Button */}
          <Button
            variant="primary"
            size="sm"
            onClick={() => setCreateModalOpen(true)}
            leftIcon={<Plus size={15} strokeWidth={2.5} />}
          >
            <span className="hidden sm:inline">Create Post</span>
            <span className="sm:hidden">Post</span>
          </Button>
        </div>
      </header>

      {/* Create Post Modal */}
      <CreatePostModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
      />
    </>
  );
}
