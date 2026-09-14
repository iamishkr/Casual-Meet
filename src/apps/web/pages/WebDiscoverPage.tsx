import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { api } from '../../../lib/api';
import type { DiscoverItem, DiscoverPersonDTO } from '../../../lib/types';
import FeedList from '../../../components/social/FeedList';
import FollowButton from '../../../components/social/FollowButton';
import UserListModal from '../../../components/social/UserListModal';
import MeetupModal from '../../../components/social/MeetupModal';
import {
  Compass,
  Sparkles,
  Users,
  Shield,
  Search,
  RefreshCw,
  UserPlus,
  ArrowRight,
  Clock,
  MapPin,
  X,
} from 'lucide-react';
import { Button, SkeletonCard, EmptyState, ErrorState } from '../../../components/ui';
import { fmtDistance } from '../../../lib/utils';

const INTEREST_TAGS = ['All', 'Coffee', 'Photography', 'Tech', 'Design', 'Fitness', 'Music', 'Reading', 'Art'];

export default function WebDiscoverPage() {
  const { currentUser } = useAuth();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<'explore' | 'people' | 'nearby'>('people');

  // People Discovery State
  const [people, setPeople] = useState<DiscoverPersonDTO[]>([]);
  const [loadingPeople, setLoadingPeople] = useState(true);
  const [peopleError, setPeopleError] = useState<string | null>(null);
  const [selectedInterest, setSelectedInterest] = useState('All');
  const [peopleSearchQuery, setPeopleSearchQuery] = useState('');

  // Nearby Discovery State
  const [nearbyCards, setNearbyCards] = useState<DiscoverItem[]>([]);
  const [loadingNearby, setLoadingNearby] = useState(false);
  const [nearbyError, setNearbyError] = useState<string | null>(null);
  const [nearbySearchQuery, setNearbySearchQuery] = useState('');

  // Actions & Modals State
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [mutualModalUser, setMutualModalUser] = useState<{ id: string; name: string } | null>(null);
  const [meetupTarget, setMeetupTarget] = useState<DiscoverPersonDTO | null>(null);

  // Load Deterministic People Discovery
  const loadPeople = useCallback(async () => {
    setLoadingPeople(true);
    setPeopleError(null);
    try {
      const res = await api.discover.people({
        interest: selectedInterest === 'All' ? undefined : selectedInterest,
      });
      setPeople(res.people || []);
    } catch (err: any) {
      setPeopleError(err?.message || 'Failed to load social recommendations.');
      setPeople([]);
    } finally {
      setLoadingPeople(false);
    }
  }, [selectedInterest]);

  // Load Nearby Geospatial Discovery
  const loadNearby = useCallback(async () => {
    setLoadingNearby(true);
    setNearbyError(null);
    try {
      const data = await api.discover.nearby(20);
      setNearbyCards(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setNearbyError(err?.message || 'Failed to load nearby members.');
      setNearbyCards([]);
    } finally {
      setLoadingNearby(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'people') {
      loadPeople();
    } else if (activeTab === 'nearby') {
      loadNearby();
    }
  }, [activeTab, loadPeople, loadNearby]);

  const handleConnect = async (targetId: string, name: string) => {
    setConnectingId(targetId);
    try {
      await api.connections.request(targetId);
      toast('ok', 'Connection Request Sent', `Request sent to ${name}.`);
      if (activeTab === 'people') {
        loadPeople();
      } else {
        loadNearby();
      }
    } catch (err: any) {
      toast('err', 'Connection Error', err?.message || 'Failed to send connection request.');
    } finally {
      setConnectingId(null);
    }
  };

  const filteredPeople = people.filter((p) => {
    if (!peopleSearchQuery.trim()) return true;
    const q = peopleSearchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.username.toLowerCase().includes(q) ||
      p.city?.toLowerCase().includes(q) ||
      p.occupation?.toLowerCase().includes(q) ||
      p.interests?.some((i) => i.toLowerCase().includes(q))
    );
  });

  const filteredNearby = nearbyCards.filter((item) => {
    const p = item.user;
    if (!nearbySearchQuery.trim()) return true;
    const q = nearbySearchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.username.toLowerCase().includes(q) ||
      p.bio?.toLowerCase().includes(q) ||
      p.interests?.some((i) => i.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6 max-w-3xl mx-auto w-full pb-10">
      {/* Header & Tabs */}
      <div className="border-b border-line-soft/60 pb-4 space-y-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink flex items-center gap-2.5">
            <Compass size={24} className="text-amber" />
            Social Discovery & Explore
          </h1>
          <p className="text-xs text-mute mt-1">
            Connect through mutual friends, shared public interests, and coarse location. All ranking is explainable and deterministic.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('people')}
            className={`flex items-center gap-2 rounded-2xl px-4 py-2 text-xs font-bold transition-all ${
              activeTab === 'people'
                ? 'border border-amber/40 bg-amber/15 text-amber shadow-sm'
                : 'border border-line bg-night-850 text-mute hover:text-ink'
            }`}
          >
            <Users size={14} />
            <span>Discover People</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('explore')}
            className={`flex items-center gap-2 rounded-2xl px-4 py-2 text-xs font-bold transition-all ${
              activeTab === 'explore'
                ? 'border border-amber/40 bg-amber/15 text-amber shadow-sm'
                : 'border border-line bg-night-850 text-mute hover:text-ink'
            }`}
          >
            <Sparkles size={14} />
            <span>Explore Community Posts</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('nearby')}
            className={`flex items-center gap-2 rounded-2xl px-4 py-2 text-xs font-bold transition-all ${
              activeTab === 'nearby'
                ? 'border border-amber/40 bg-amber/15 text-amber shadow-sm'
                : 'border border-line bg-night-850 text-mute hover:text-ink'
            }`}
          >
            <MapPin size={14} />
            <span>Nearby Verified Members</span>
          </button>
        </div>
      </div>

      {/* Tab 1: Discover People (Deterministic Social Recommendations) */}
      {activeTab === 'people' && (
        <div className="space-y-5">
          {/* Interest Filter Tags & Search */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-mute" />
                <input
                  type="text"
                  value={peopleSearchQuery}
                  onChange={(e) => setPeopleSearchQuery(e.target.value)}
                  placeholder="Filter by name, username, city, or interests..."
                  className="w-full rounded-2xl border border-line bg-night-850 py-2 pl-10 pr-4 text-xs text-ink placeholder:text-dim outline-none transition-colors focus:border-amber/50"
                />
                {peopleSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setPeopleSearchQuery('')}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-dim hover:text-ink"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={loadPeople}
                leftIcon={<RefreshCw size={13} className={loadingPeople ? 'animate-spin' : ''} />}
              >
                Refresh
              </Button>
            </div>

            {/* Interest Tag Filter Bar */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              <span className="text-[11px] font-semibold text-dim shrink-0 mr-1">Interests:</span>
              {INTEREST_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setSelectedInterest(tag)}
                  className={`rounded-xl px-2.5 py-1 text-[11px] font-medium transition-colors shrink-0 ${
                    selectedInterest === tag
                      ? 'bg-amber text-night-950 font-bold shadow-sm'
                      : 'border border-line-soft bg-night-900/80 text-mute hover:text-ink hover:border-line'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Cards Grid */}
          {loadingPeople ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {[1, 2, 3, 4].map((i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : peopleError ? (
            <ErrorState message={peopleError} onRetry={loadPeople} />
          ) : filteredPeople.length === 0 ? (
            <EmptyState
              icon={<Users size={32} className="text-amber" />}
              title="No members found"
              description={
                selectedInterest !== 'All'
                  ? `No members found matching interest "${selectedInterest}". Try selecting "All".`
                  : 'Check back soon as more community members join your area.'
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {filteredPeople.map((p) => {
                const isConnecting = connectingId === p.id;
                const isConnected = p.relationship?.connectionStatus === 'connected';
                const isPending = p.relationship?.connectionStatus === 'pending';

                return (
                  <div
                    key={p.id}
                    className="rounded-3xl border border-line-soft bg-night-850/90 p-4 shadow-sm backdrop-blur-md flex flex-col justify-between space-y-3 hover:border-line transition-all"
                  >
                    <div>
                      {/* Avatar, Name & Follow */}
                      <div className="flex items-start justify-between gap-3">
                        <Link
                          to={`/app/profile/${p.id}`}
                          className="flex items-center gap-3 group min-w-0"
                        >
                          <div
                            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl font-display text-sm font-black text-night-950 shadow-md group-hover:scale-105 transition-transform"
                            style={{
                              background: `linear-gradient(135deg, hsl(${p.avatarHue} 85% 68%), hsl(${(p.avatarHue + 42) % 360} 80% 55%))`,
                            }}
                          >
                            {p.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-display text-xs font-bold text-ink group-hover:text-amber transition-colors truncate flex items-center gap-1.5">
                              {p.name}
                              {p.isVerified && (
                                <span title="ID Verified" className="inline-flex items-center">
                                  <Shield size={12} className="text-safe shrink-0" />
                                </span>
                              )}
                            </h4>
                            <p className="font-mono text-[10px] text-dim truncate">@{p.username}</p>
                            <p className="text-[10px] text-mute truncate mt-0.5">
                              {p.city || 'Coarse Area'} {p.occupation ? `· ${p.occupation}` : ''}
                            </p>
                          </div>
                        </Link>

                        <FollowButton userId={p.id} size="sm" />
                      </div>

                      {/* Bio */}
                      {p.bio && (
                        <p className="text-[11px] text-mute mt-2.5 line-clamp-2 leading-relaxed">
                          {p.bio}
                        </p>
                      )}

                      {/* Non-sensitive Explanations & Mutuals */}
                      <div className="flex flex-wrap items-center gap-1.5 mt-3">
                        {p.mutualConnectionsCount > 0 && (
                          <button
                            type="button"
                            onClick={() => setMutualModalUser({ id: p.id, name: p.name })}
                            className="rounded-lg bg-amber/15 border border-amber/30 px-2 py-0.5 font-mono text-[9px] font-bold text-amber hover:bg-amber/25 transition-colors"
                          >
                            {p.mutualConnectionsCount} mutual connection{p.mutualConnectionsCount > 1 ? 's' : ''}
                          </button>
                        )}

                        {p.explanations
                          ?.filter((exp) => !exp.includes('mutual connection'))
                          .map((exp, idx) => (
                            <span
                              key={idx}
                              className="rounded-lg bg-night-900 border border-line-soft px-2 py-0.5 font-mono text-[9px] text-dim"
                            >
                              {exp}
                            </span>
                          ))}
                      </div>

                      {/* Shared & General Interests */}
                      {p.interests && p.interests.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2.5">
                          {p.interests.slice(0, 4).map((interest) => {
                            const isShared = p.sharedInterests?.includes(interest);
                            return (
                              <span
                                key={interest}
                                className={`rounded-lg px-2 py-0.5 font-mono text-[9px] ${
                                  isShared
                                    ? 'bg-amber/20 border border-amber/40 text-amber font-semibold'
                                    : 'bg-night-900 border border-line-soft text-dim'
                                }`}
                              >
                                {interest}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Footer Actions */}
                    <div className="flex items-center justify-between border-t border-line-soft/60 pt-2.5 mt-2">
                      <Link
                        to={`/app/profile/${p.id}`}
                        className="text-[11px] font-semibold text-mute hover:text-amber transition-colors flex items-center gap-1"
                      >
                        Profile <ArrowRight size={11} />
                      </Link>

                      <div className="flex items-center gap-2">
                        {isConnected ? (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => setMeetupTarget(p)}
                            leftIcon={<Clock size={12} />}
                          >
                            Meet Safely
                          </Button>
                        ) : isPending ? (
                          <span className="rounded-xl border border-line-soft bg-night-900 px-3 py-1 text-[11px] font-medium text-dim">
                            Pending
                          </span>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isConnecting}
                            onClick={() => handleConnect(p.id, p.name)}
                            leftIcon={<UserPlus size={12} />}
                          >
                            {isConnecting ? 'Connecting...' : 'Connect'}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Explore Posts Feed */}
      {activeTab === 'explore' && (
        <FeedList
          scope="explore"
          emptyTitle="No public posts found"
          emptyMessage="Check back later as community members publish new public posts."
        />
      )}

      {/* Tab 3: Nearby People Discovery (Geospatial with Redacted Coords) */}
      {activeTab === 'nearby' && (
        <div className="space-y-5">
          {/* Search bar */}
          <div className="flex items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-mute" />
              <input
                type="text"
                value={nearbySearchQuery}
                onChange={(e) => setNearbySearchQuery(e.target.value)}
                placeholder="Search by name, interests, occupation..."
                className="w-full rounded-2xl border border-line bg-night-850 py-2 pl-10 pr-4 text-xs text-ink placeholder:text-dim outline-none transition-colors focus:border-amber/50"
              />
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={loadNearby}
              leftIcon={<RefreshCw size={13} className={loadingNearby ? 'animate-spin' : ''} />}
            >
              Refresh
            </Button>
          </div>

          {/* Cards Grid */}
          {loadingNearby ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {[1, 2, 3, 4].map((i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : nearbyError ? (
            <ErrorState message={nearbyError} onRetry={loadNearby} />
          ) : filteredNearby.length === 0 ? (
            <EmptyState
              icon={<Users size={32} className="text-amber" />}
              title="No nearby members found"
              description="Try adjusting your search criteria or refresh the nearby discovery list."
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {filteredNearby.map((item) => {
                const p = item.user;
                const isConnecting = connectingId === p.id;
                const isConnected = item.conn?.status === 'accepted';
                const isPending = item.conn?.status === 'pending';

                return (
                  <div
                    key={p.id}
                    className="rounded-3xl border border-line-soft bg-night-850/90 p-4 shadow-sm backdrop-blur-md flex flex-col justify-between space-y-3 hover:border-line transition-all"
                  >
                    <div>
                      {/* Avatar & Verification Header */}
                      <div className="flex items-start justify-between gap-3">
                        <Link
                          to={`/app/profile/${p.id}`}
                          className="flex items-center gap-3 group min-w-0"
                        >
                          <div
                            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl font-display text-sm font-black text-night-950 shadow-md group-hover:scale-105 transition-transform"
                            style={{
                              background: `linear-gradient(135deg, hsl(${p.avatarHue} 85% 68%), hsl(${(p.avatarHue + 42) % 360} 80% 55%))`,
                            }}
                          >
                            {p.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-display text-xs font-bold text-ink group-hover:text-amber transition-colors truncate flex items-center gap-1.5">
                              {p.name}
                              {p.isVerified && (
                                <span title="ID Verified" className="inline-flex items-center">
                                  <Shield size={12} className="text-safe shrink-0" />
                                </span>
                              )}
                            </h4>
                            <p className="font-mono text-[10px] text-dim truncate">@{p.username}</p>
                            <p className="font-mono text-[10px] text-amber mt-0.5">
                              ~{fmtDistance(item.distanceKm)} away
                            </p>
                          </div>
                        </Link>

                        <FollowButton userId={p.id} size="sm" />
                      </div>

                      {/* Bio & Interests */}
                      {p.bio && (
                        <p className="text-[11px] text-mute mt-2.5 line-clamp-2 leading-relaxed">
                          {p.bio}
                        </p>
                      )}

                      {p.interests && p.interests.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2.5">
                          {p.interests.slice(0, 3).map((interest) => (
                            <span
                              key={interest}
                              className="rounded-lg bg-night-900 border border-line-soft px-2 py-0.5 font-mono text-[9px] text-dim"
                            >
                              {interest}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Footer Actions */}
                    <div className="flex items-center justify-between border-t border-line-soft/60 pt-2.5 mt-2">
                      <Link
                        to={`/app/profile/${p.id}`}
                        className="text-[11px] font-semibold text-mute hover:text-amber transition-colors flex items-center gap-1"
                      >
                        Profile <ArrowRight size={11} />
                      </Link>

                      <div className="flex items-center gap-2">
                        {isConnected ? (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() =>
                              setMeetupTarget({
                                id: p.id,
                                name: p.name,
                                username: p.username,
                                avatarHue: p.avatarHue,
                                isVerified: p.isVerified,
                                interests: p.interests || [],
                                sharedInterests: [],
                                mutualConnectionsCount: 0,
                                explanations: [],
                                relationship: {
                                  isFollowing: false,
                                  isFollower: false,
                                  connectionStatus: 'connected',
                                },
                              })
                            }
                            leftIcon={<Clock size={12} />}
                          >
                            Meet Safely
                          </Button>
                        ) : isPending ? (
                          <span className="rounded-xl border border-line-soft bg-night-900 px-3 py-1 text-[11px] font-medium text-dim">
                            Pending
                          </span>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isConnecting}
                            onClick={() => handleConnect(p.id, p.name)}
                            leftIcon={<UserPlus size={12} />}
                          >
                            {isConnecting ? 'Connecting...' : 'Connect'}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Mutual Connections Modal */}
      {mutualModalUser && (
        <UserListModal
          open={Boolean(mutualModalUser)}
          onClose={() => setMutualModalUser(null)}
          title={`Mutual Connections with ${mutualModalUser.name}`}
          userId={mutualModalUser.id}
          type="mutual"
        />
      )}

      {/* Meetup Safety Timer Modal */}
      {meetupTarget && (
        <MeetupModal
          open={Boolean(meetupTarget)}
          onClose={() => setMeetupTarget(null)}
          targetUser={meetupTarget}
          onStarted={() => {
            toast('ok', 'Meetup Armed', `Safety timer running with ${meetupTarget.name}.`);
            setMeetupTarget(null);
          }}
        />
      )}
    </div>
  );
}
