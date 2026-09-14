import React, { useState, useEffect, useRef } from 'react';
import type { StoryGroupDTO, StoryDTO } from '../../lib/types';
import { api } from '../../lib/api';
import { X, ChevronLeft, ChevronRight, Clock, Shield, Flag } from 'lucide-react';
import { relTime } from '../../lib/utils';
import ReportModal from './ReportModal';

interface StoryViewerProps {
  storyGroup: StoryGroupDTO;
  onClose: () => void;
  onNextAuthor?: () => void;
  onPrevAuthor?: () => void;
}

export default function StoryViewer({
  storyGroup,
  onClose,
  onNextAuthor,
  onPrevAuthor,
}: StoryViewerProps) {
  const [storyIndex, setStoryIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [reportOpen, setReportOpen] = useState(false);
  const timerRef = useRef<any>(null);

  const stories: StoryDTO[] = storyGroup.stories || [];
  const currentStory: StoryDTO | undefined = stories[storyIndex];

  // Mark story as viewed on the backend
  useEffect(() => {
    if (currentStory) {
      api.stories.view(currentStory.id).catch(() => {});
    }
  }, [currentStory]);

  // Handle auto-advance progress timer (paused when report modal is open)
  useEffect(() => {
    if (reportOpen) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    setProgress(0);
    const duration = currentStory?.media?.duration
      ? Math.max(currentStory.media.duration * 1000, 3000)
      : 5000;

    const interval = 50;
    const step = (interval / duration) * 100;

    timerRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timerRef.current);
          handleNext();
          return 100;
        }
        return prev + step;
      });
    }, interval);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [storyIndex, currentStory, reportOpen]);

  const handleNext = () => {
    if (storyIndex < stories.length - 1) {
      setStoryIndex((idx) => idx + 1);
    } else if (onNextAuthor) {
      onNextAuthor();
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (storyIndex > 0) {
      setStoryIndex((idx) => idx - 1);
    } else if (onPrevAuthor) {
      onPrevAuthor();
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [storyIndex, stories.length]);

  if (!currentStory) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-night-950/95 backdrop-blur-lg">
      {/* Close button */}
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 z-20 rounded-full bg-night-850/80 p-2 text-mute hover:bg-night-800 hover:text-ink transition-colors"
        title="Close story"
      >
        <X size={22} />
      </button>

      {/* Main container */}
      <div className="relative h-full max-h-[92vh] w-full max-w-md rounded-3xl overflow-hidden bg-night-900 shadow-2xl flex flex-col justify-between border border-line-soft">
        {/* Top Progress Bars */}
        <div className="absolute top-0 inset-x-0 z-20 p-3 bg-gradient-to-b from-night-950/90 to-transparent space-y-3">
          <div className="flex items-center gap-1.5">
            {stories.map((s, idx) => (
              <div
                key={s.id}
                className="h-1 flex-1 rounded-full bg-white/20 overflow-hidden"
              >
                <div
                  className="h-full bg-amber transition-all duration-75"
                  style={{
                    width:
                      idx < storyIndex ? '100%' : idx === storyIndex ? `${progress}%` : '0%',
                  }}
                />
              </div>
            ))}
          </div>

          {/* Author Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-full font-display text-xs font-black text-night-950 shadow-md"
                style={{
                  background: `linear-gradient(135deg, hsl(${storyGroup.user.avatarHue} 85% 68%), hsl(${(storyGroup.user.avatarHue + 42) % 360} 80% 55%))`,
                }}
              >
                {storyGroup.user.name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="flex items-center gap-1 text-xs font-bold text-ink">
                  {storyGroup.user.name}
                  {storyGroup.user.isVerified && (
                    <Shield size={12} className="text-safe" />
                  )}
                </p>
                <p className="font-mono text-[10px] text-dim flex items-center gap-1">
                  <Clock size={10} className="text-amber" />
                  <span>{relTime(new Date(currentStory.createdAt).getTime())}</span>
                  <span>•</span>
                  <span className="capitalize">{currentStory.visibility}</span>
                </p>
              </div>
            </div>

            {/* In-context Story Report Action (Directive #9) */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setReportOpen(true);
              }}
              className="rounded-full bg-night-850/80 p-1.5 text-mute hover:text-amber hover:bg-night-800 transition-colors"
              title="Report story"
            >
              <Flag size={14} />
            </button>
          </div>
        </div>

        {/* Media Player Area */}
        <div className="relative flex-1 flex items-center justify-center bg-night-950 overflow-hidden">
          {currentStory.media.mediaType === 'video' ? (
            <video
              src={currentStory.media.url}
              autoPlay
              playsInline
              className="h-full w-full object-contain"
            />
          ) : (
            <img
              src={currentStory.media.url}
              alt="Story media"
              className="h-full w-full object-contain"
            />
          )}

          {/* Tap navigation hotzones */}
          <div
            className="absolute inset-y-0 left-0 w-1/3 cursor-pointer z-10"
            onClick={handlePrev}
            title="Previous story"
          />
          <div
            className="absolute inset-y-0 right-0 w-1/3 cursor-pointer z-10"
            onClick={handleNext}
            title="Next story"
          />
        </div>

        {/* Bottom Caption Area */}
        {currentStory.caption && (
          <div className="absolute bottom-0 inset-x-0 z-20 p-4 bg-gradient-to-t from-night-950/95 via-night-950/70 to-transparent text-center">
            <p className="text-xs sm:text-sm text-ink leading-relaxed font-medium drop-shadow-md">
              {currentStory.caption}
            </p>
          </div>
        )}
      </div>

      {/* Outer Prev/Next arrows for desktop */}
      {onPrevAuthor && (
        <button
          type="button"
          onClick={onPrevAuthor}
          className="hidden md:flex absolute left-8 top-1/2 -translate-y-1/2 rounded-full bg-night-850/80 p-3 text-mute hover:bg-night-800 hover:text-ink transition-colors"
        >
          <ChevronLeft size={28} />
        </button>
      )}
      {onNextAuthor && (
        <button
          type="button"
          onClick={onNextAuthor}
          className="hidden md:flex absolute right-8 top-1/2 -translate-y-1/2 rounded-full bg-night-850/80 p-3 text-mute hover:bg-night-800 hover:text-ink transition-colors"
        >
          <ChevronRight size={28} />
        </button>
      )}

      {/* Story In-Context Report Modal */}
      {reportOpen && (
        <ReportModal
          open={reportOpen}
          onClose={() => setReportOpen(false)}
          targetType="story"
          targetId={currentStory.id}
          targetName={`${storyGroup.user.name}'s story`}
        />
      )}
    </div>
  );
}
