import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import type { StoryGroupDTO } from '../../lib/types';
import StoryViewer from './StoryViewer';
import CreateStoryModal from './CreateStoryModal';
import { Plus, Shield } from 'lucide-react';

export default function StoryBar() {
  const { currentUser } = useAuth();
  const [storyGroups, setStoryGroups] = useState<StoryGroupDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeViewerIndex, setActiveViewerIndex] = useState<number | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const loadStories = useCallback(async () => {
    try {
      const groups = await api.stories.list();
      setStoryGroups(Array.isArray(groups) ? groups : []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStories();
  }, [loadStories]);

  if (!currentUser) return null;

  // Check if current user has an active story in the list
  const myStoryGroup = storyGroups.find(
    (g) => g.user._id === currentUser.id
  );

  return (
    <>
      <div className="rounded-3xl border border-line-soft bg-night-850/80 p-3.5 shadow-sm backdrop-blur-md">
        <div className="flex items-center gap-4 overflow-x-auto no-scrollbar py-1">
          {/* User's Own Story Action */}
          <div className="flex flex-col items-center gap-1.5 shrink-0 w-16 text-center cursor-pointer group">
            <div
              className="relative"
              onClick={() => {
                if (myStoryGroup) {
                  const idx = storyGroups.indexOf(myStoryGroup);
                  setActiveViewerIndex(idx);
                } else {
                  setCreateModalOpen(true);
                }
              }}
            >
              <div
                className={`flex h-14 w-14 items-center justify-center rounded-full font-display text-sm font-black text-night-950 transition-transform group-hover:scale-105 shadow-md ${
                  myStoryGroup
                    ? 'p-0.5 ring-2 ring-amber ring-offset-2 ring-offset-night-900'
                    : ''
                }`}
                style={{
                  background: `linear-gradient(135deg, hsl(${currentUser.avatarHue} 85% 68%), hsl(${(currentUser.avatarHue + 42) % 360} 80% 55%))`,
                }}
              >
                {currentUser.name.slice(0, 2).toUpperCase()}
              </div>

              {/* Plus Badge if no active story */}
              {!myStoryGroup && (
                <div className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-amber text-night-950 shadow-md border-2 border-night-900">
                  <Plus size={12} strokeWidth={3} />
                </div>
              )}
            </div>
            <span className="truncate w-full font-medium text-[11px] text-ink">
              {myStoryGroup ? 'Your Story' : 'Add Story'}
            </span>
          </div>

          {/* Skeletons on initial load */}
          {loading ? (
            <div className="flex items-center gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex flex-col items-center gap-1.5 shrink-0 w-16 animate-pulse">
                  <div className="h-14 w-14 rounded-full bg-night-800" />
                  <div className="h-2 w-10 rounded bg-night-800" />
                </div>
              ))}
            </div>
          ) : (
            /* Other Users' Stories */
            storyGroups
              .filter((g) => g.user._id !== currentUser.id)
              .map((group, idx) => {
                // Determine original index in storyGroups for viewer
                const originalIndex = storyGroups.indexOf(group);
                return (
                  <div
                    key={group.user._id}
                    onClick={() => setActiveViewerIndex(originalIndex)}
                    className="flex flex-col items-center gap-1.5 shrink-0 w-16 text-center cursor-pointer group"
                  >
                    <div className="p-0.5 rounded-full ring-2 ring-amber ring-offset-2 ring-offset-night-900 group-hover:scale-105 transition-transform shadow-md">
                      <div
                        className="flex h-13 w-13 items-center justify-center rounded-full font-display text-xs font-black text-night-950"
                        style={{
                          background: `linear-gradient(135deg, hsl(${group.user.avatarHue} 85% 68%), hsl(${(group.user.avatarHue + 42) % 360} 80% 55%))`,
                        }}
                      >
                        {group.user.name.slice(0, 2).toUpperCase()}
                      </div>
                    </div>
                    <span className="truncate w-full font-medium text-[11px] text-mute group-hover:text-ink transition-colors">
                      {group.user.name.split(' ')[0]}
                    </span>
                  </div>
                );
              })
          )}
        </div>
      </div>

      {/* Story Viewer Overlay */}
      {activeViewerIndex !== null && storyGroups[activeViewerIndex] && (
        <StoryViewer
          storyGroup={storyGroups[activeViewerIndex]}
          onClose={() => setActiveViewerIndex(null)}
          onNextAuthor={
            activeViewerIndex < storyGroups.length - 1
              ? () => setActiveViewerIndex((i) => i! + 1)
              : undefined
          }
          onPrevAuthor={
            activeViewerIndex > 0 ? () => setActiveViewerIndex((i) => i! - 1) : undefined
          }
        />
      )}

      {/* Create Story Modal */}
      <CreateStoryModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onStoryCreated={() => {
          loadStories();
        }}
      />
    </>
  );
}
