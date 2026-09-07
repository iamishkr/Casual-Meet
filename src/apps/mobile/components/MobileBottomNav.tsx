import React from 'react';
import { NavLink } from 'react-router-dom';
import { useData } from '../../../context/DataContext';
import {
  Home,
  Compass,
  Plus,
  MessageCircle,
  Shield,
} from 'lucide-react';

interface MobileBottomNavProps {
  onCreateClick: () => void;
}

export default function MobileBottomNav({ onCreateClick }: MobileBottomNavProps) {
  const { unreadCount, activeSos, activeTimer } = useData();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-line-soft bg-night-900/95 backdrop-blur-xl px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
      <div className="mx-auto flex max-w-md items-center justify-around">
        {/* 1. Home */}
        <NavLink
          to="/mobile"
          end
          className={({ isActive }) =>
            `flex flex-col items-center justify-center gap-1 px-3 py-1 text-[10px] font-semibold transition-colors min-w-[54px] min-h-[44px] ${
              isActive ? 'text-amber font-bold' : 'text-mute hover:text-ink'
            }`
          }
        >
          <Home size={20} />
          <span>Home</span>
        </NavLink>

        {/* 2. Discover */}
        <NavLink
          to="/mobile/discover"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center gap-1 px-3 py-1 text-[10px] font-semibold transition-colors min-w-[54px] min-h-[44px] ${
              isActive ? 'text-amber font-bold' : 'text-mute hover:text-ink'
            }`
          }
        >
          <Compass size={20} />
          <span>Discover</span>
        </NavLink>

        {/* 3. Create Action (+) Button */}
        <button
          type="button"
          onClick={onCreateClick}
          className="btn-press flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber text-night-950 shadow-[0_4px_16px_-4px_rgba(255,178,36,0.7)] transition-transform active:scale-95"
          title="Create Meetup Post"
        >
          <Plus size={22} strokeWidth={2.6} />
        </button>

        {/* 4. Messages */}
        <NavLink
          to="/mobile/messages"
          className={({ isActive }) =>
            `relative flex flex-col items-center justify-center gap-1 px-3 py-1 text-[10px] font-semibold transition-colors min-w-[54px] min-h-[44px] ${
              isActive ? 'text-amber font-bold' : 'text-mute hover:text-ink'
            }`
          }
        >
          <div className="relative">
            <MessageCircle size={20} />
            {unreadCount > 0 && (
              <span className="absolute -right-2 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber px-1 font-mono text-[9px] font-bold text-night-950 shadow-sm">
                {unreadCount}
              </span>
            )}
          </div>
          <span>Messages</span>
        </NavLink>

        {/* 5. Safety Center */}
        <NavLink
          to="/mobile/safety"
          className={({ isActive }) =>
            `relative flex flex-col items-center justify-center gap-1 px-3 py-1 text-[10px] font-semibold transition-colors min-w-[54px] min-h-[44px] ${
              isActive ? 'text-amber font-bold' : 'text-mute hover:text-ink'
            }`
          }
        >
          <div className="relative">
            <Shield size={20} />
            {activeSos && (
              <span className="absolute -right-1 -top-1 flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sos opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-sos" />
              </span>
            )}
            {!activeSos && activeTimer && (
              <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-amber shadow-[0_0_6px_rgba(255,178,36,0.8)]" />
            )}
          </div>
          <span>Safety</span>
        </NavLink>
      </div>
    </nav>
  );
}
