import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../../lib/api';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import type { DiscoverItem, DiscoverPersonDTO } from '../../../lib/types';
import { fmtDistance } from '../../../lib/utils';
import FeedList from '../../../components/social/FeedList';
import FollowButton from '../../../components/social/FollowButton';
import UserListModal from '../../../components/social/UserListModal';
import MeetupModal from '../../../components/social/MeetupModal';
import {
  Search,
  Compass,
  Users,
  UserCheck,
  MapPin,
  Sliders,
  Loader2,
  Shield,
  Clock,
  Sparkles,
  Check,
  X,
  MessageCircle,
} from 'lucide-react';
import { Button } from '../../../components/ui';
import MobileCommunitiesView from './MobileCommunitiesView';

type DiscoverTab = 'explore' | 'people' | 'communities' | 'requests';
type PeopleSubTab = 'social' | 'nearby';

export default function MobileDiscoverView() {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<DiscoverTab>('explore');
  const [peopleSubTab, setPeopleSubTab] = useState<PeopleSubTab>('social');
  const [searchQuery, setSearchQuery] = useState('');
  const [maxKm, setMaxKm] = useState(15);
  const [showRadiusSlider, setShowRadiusSlider] = useState(false);

  // Social People Discovery state
  const [socialPeople, setSocialPeople] = useState<DiscoverPersonDTO[]>([]);
  const [loadingSocial, setLoadingSocial] = useState(false);

  // Nearby People state
  const [nearbyPeople, setNearbyPeople] = useState<DiscoverItem[]>([]);
  const [loadingNearby, setLoadingNearby] = useState(false);
  const [connections, setConnections] = useState<any[]>([]);

  // Modals state
  const [mutualModalUser, setMutualModalUser] = useState<{ id: string; name: string } | null>(null);
  const [meetupTarget, setMeetupTarget] = useState<DiscoverPersonDTO | null>(null);

  const fetchSocialPeople = useCallback(async () => {
    setLoadingSocial(true);
    try {
      const res = await api.discover.people();
      setSocialPeople(res.people || []);
    } catch {
      setSocialPeople([]);
    } finally {
      setLoadingSocial(false);
    }
  }, []);

  const fetchDiscovery = useCallback(async (radius: number) => {
    setLoadingNearby(true);
    try {
      const data = await api.discover.nearby(radius);
      setNearbyPeople(Array.isArray(data) ? data : []);
    } catch {
      setNearbyPeople([]);
    } finally {
      setLoadingNearby(false);
    }
  }, []);

  const fetchConnections = useCallback(async () => {
    try {
      const res = await api.connections.list();
      setConnections(Array.isArray(res) ? res : []);
    } catch {
      setConnections([]);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'people') {
      if (peopleSubTab === 'social') {
        fetchSocialPeople();
      } else {
        fetchDiscovery(maxKm);
      }
      fetchConnections();
    } else if (activeTab === 'requests') {
      fetchConnections();
    }
  }, [activeTab, peopleSubTab, maxKm, fetchSocialPeople, fetchDiscovery, fetchConnections]);

  const handleConnect = async (targetUserId: string) => {
    try {
      await api.connections.request(targetUserId);
      toast('ok', 'Request Sent', 'Connection request sent to member.');
      if (peopleSubTab === 'social') {
        fetchSocialPeople();
      } else {
        fetchDiscovery(maxKm);
      }
      fetchConnections();
    } catch (err: any) {
      toast('err', 'Request Failed', err?.message || 'Could not send connection request.');
    }
  };

  const handleAccept = async (connId: string) => {
    try {
      const res = await api.connections.accept(connId);
      toast('ok', 'Connected', 'Direct messages unlocked!');
      fetchConnections();
      if (peopleSubTab === 'social') {
        fetchSocialPeople();
      } else {
        fetchDiscovery(maxKm);
      }
      if (res?.chatId) {
        navigate('/mobile/messages');
      }
    } catch (err: any) {
      toast('err', 'Action Failed', err?.message || 'Could not accept connection.');
    }
  };

  const handleReject = async (connId: string) => {
    try {
      await api.connections.reject(connId);
      toast('info', 'Request Declined', 'Connection request dismissed.');
      fetchConnections();
      if (peopleSubTab === 'social') {
        fetchSocialPeople();
      } else {
        fetchDiscovery(maxKm);
      }
    } catch (err: any) {
      toast('err', 'Action Failed', err?.message || 'Could not reject request.');
    }
  };

  const myId = currentUser?.id || '';
  const incoming = connections.filter((c) => {
    const recId = c.receiverId?._id || c.receiverId;
    return recId === myId && c.status === 'pending';
  });

  const outgoing = connections.filter((c) => {
    const reqId = c.requesterId?._id || c.requesterId;
    return reqId === myId && c.status === 'pending';
  });

  // Filter social people by search query
  const filteredSocialPeople = socialPeople.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.username.toLowerCase().includes(q) ||
      p.city?.toLowerCase().includes(q) ||
      p.occupation?.toLowerCase().includes(q) ||
      p.interests?.some((i) => i.toLowerCase().includes(q))
    );
  });

  // Filter nearby people by search query
  const filteredNearbyPeople = nearbyPeople.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.user.name.toLowerCase().includes(q) ||
      item.user.username.toLowerCase().includes(q) ||
      item.user.city?.toLowerCase().includes(q) ||
      item.user.occupation?.toLowerCase().includes(q) ||
      item.user.interests?.some((i) => i.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-mute" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search members, interests, or posts..."
          className="w-full rounded-2xl border border-line-soft bg-night-850 py-2.5 pl-10 pr-4 text-xs text-ink placeholder:text-dim outline-none focus:border-amber/50"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-dim hover:text-ink"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Tabs Navigation */}
      <div className="flex rounded-2xl border border-line-soft bg-night-900 p-1">
        <button
          type="button"
          onClick={() => setActiveTab('explore')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition-colors ${
            activeTab === 'explore'
              ? 'bg-amber text-night-950 font-bold shadow-sm'
              : 'text-mute hover:text-ink'
          }`}
        >
          <Sparkles size={13} />
          <span>Explore</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('people')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition-colors ${
            activeTab === 'people'
              ? 'bg-amber text-night-950 font-bold shadow-sm'
              : 'text-mute hover:text-ink'
          }`}
        >
          <Users size={13} />
          <span>People</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('communities')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition-colors ${
            activeTab === 'communities'
              ? 'bg-amber text-night-950 font-bold shadow-sm'
              : 'text-mute hover:text-ink'
          }`}
        >
          <Users size={13} />
          <span>Groups</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('requests')}
          className={`relative flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition-colors ${
            activeTab === 'requests'
              ? 'bg-amber text-night-950 font-bold shadow-sm'
              : 'text-mute hover:text-ink'
          }`}
        >
          <UserCheck size={13} />
          <span>Requests</span>
          {incoming.length > 0 && (
            <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-sos px-1 font-mono text-[9px] font-bold text-ink shadow-sm">
              {incoming.length}
            </span>
          )}
        </button>
      </div>

      {/* Tab 1: Explore Community Posts */}
      {activeTab === 'explore' && (
        <div className="space-y-4">
          <FeedList
            scope="explore"
            emptyTitle="No explore posts found"
            emptyMessage="Be the first to publish a public post to the CasualMeet community!"
          />
        </div>
      )}

      {/* Tab: Communities / Groups */}
      {activeTab === 'communities' && (
        <div className="-mx-4 -mt-2">
          <MobileCommunitiesView />
        </div>
      )}

      {/* Tab 2: People (Social Discovery + Nearby Toggle) */}
      {activeTab === 'people' && (
        <div className="space-y-3">
          {/* Sub-tab Pill Switcher */}
          <div className="flex items-center justify-between gap-2 px-1">
            <div className="flex rounded-xl bg-night-900 border border-line-soft/60 p-0.5">
              <button
                type="button"
                onClick={() => setPeopleSubTab('social')}
                className={`rounded-lg px-3 py-1 text-[11px] font-bold transition-all ${
                  peopleSubTab === 'social'
                    ? 'bg-amber/20 text-amber border border-amber/30'
                    : 'text-mute hover:text-ink'
                }`}
              >
                Suggested
              </button>
              <button
                type="button"
                onClick={() => setPeopleSubTab('nearby')}
                className={`rounded-lg px-3 py-1 text-[11px] font-bold transition-all ${
                  peopleSubTab === 'nearby'
                    ? 'bg-amber/20 text-amber border border-amber/30'
                    : 'text-mute hover:text-ink'
                }`}
              >
                Nearby
              </button>
            </div>

            {peopleSubTab === 'nearby' && (
              <button
                type="button"
                onClick={() => setShowRadiusSlider(!showRadiusSlider)}
                className="flex items-center gap-1 rounded-lg border border-line-soft bg-night-850 px-2 py-1 text-[10px] font-semibold text-mute hover:text-ink"
              >
                <Sliders size={11} />
                <span>Radius (~{maxKm}km)</span>
              </button>
            )}
          </div>

          {/* Radius Filter for Nearby */}
          {peopleSubTab === 'nearby' && showRadiusSlider && (
            <div className="rounded-2xl border border-line-soft bg-night-850 p-3 space-y-1.5">
              <div className="flex items-center justify-between text-xs font-mono text-dim">
                <span>Search Range</span>
                <span className="text-amber font-bold">{maxKm} km</span>
              </div>
              <input
                type="range"
                min={2}
                max={30}
                value={maxKm}
                onChange={(e) => setMaxKm(Number(e.target.value))}
                className="w-full accent-[#ffb224]"
              />
            </div>
          )}

          {/* View 1: Deterministic Social People Discovery */}
          {peopleSubTab === 'social' && (
            loadingSocial ? (
              <div className="flex items-center justify-center py-12 text-xs text-dim">
                <Loader2 size={18} className="animate-spin text-amber mr-2" />
                <span>Finding recommended members...</span>
              </div>
            ) : filteredSocialPeople.length === 0 ? (
              <div className="rounded-2xl border border-line-soft bg-night-850/60 p-8 text-center text-xs text-mute space-y-2">
                <Compass size={28} className="mx-auto text-dim" />
                <p className="font-bold text-ink">No members found</p>
                <p className="text-[11px]">Try adjusting your search query.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredSocialPeople.map((p) => {
                  const isConnected = p.relationship?.connectionStatus === 'connected';
                  const isPending = p.relationship?.connectionStatus === 'pending';

                  return (
                    <div
                      key={p.id}
                      className="rounded-2xl border border-line-soft bg-night-850/90 p-3.5 shadow-sm backdrop-blur-md space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2.5">
                        <Link
                          to={`/mobile/profile/${p.id}`}
                          className="flex items-center gap-2.5 min-w-0 flex-1 group"
                        >
                          <div
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl font-display text-xs font-black text-night-950 shadow-md"
                            style={{
                              background: `linear-gradient(135deg, hsl(${p.avatarHue ?? 210} 85% 68%), hsl(${((p.avatarHue ?? 210) + 42) % 360} 80% 55%))`,
                            }}
                          >
                            {p.name?.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-display text-xs font-bold text-ink group-hover:text-amber transition-colors truncate flex items-center gap-1">
                              {p.name}
                              {p.isVerified && (
                                <span title="ID Verified" className="inline-flex items-center">
                                  <Shield size={11} className="text-safe shrink-0" />
                                </span>
                              )}
                            </h4>
                            <p className="font-mono text-[10px] text-dim truncate">@{p.username}</p>
                            <p className="text-[10px] text-mute truncate mt-0.5">
                              {p.city || 'Coarse Area'} {p.occupation ? `· ${p.occupation}` : ''}
                            </p>
                          </div>
                        </Link>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <FollowButton userId={p.id} size="sm" />
                          {isConnected ? (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => setMeetupTarget(p)}
                              leftIcon={<Clock size={11} />}
                            >
                              Meet
                            </Button>
                          ) : isPending ? (
                            <span className="rounded-xl border border-amber/30 bg-amber/10 px-2.5 py-1 font-mono text-[10px] font-bold text-amber">
                              Pending
                            </span>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleConnect(p.id)}
                            >
                              Connect
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Bio */}
                      {p.bio && (
                        <p className="text-xs text-mute line-clamp-2 leading-relaxed">
                          {p.bio}
                        </p>
                      )}

                      {/* Explanations & Mutuals */}
                      <div className="flex flex-wrap items-center gap-1">
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
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {p.interests.slice(0, 4).map((tag) => {
                            const isShared = p.sharedInterests?.includes(tag);
                            return (
                              <span
                                key={tag}
                                className={`rounded-lg px-2 py-0.5 font-mono text-[9px] ${
                                  isShared
                                    ? 'bg-amber/20 border border-amber/40 text-amber font-semibold'
                                    : 'bg-night-900 border border-line-soft/40 text-dim'
                                }`}
                              >
                                #{tag}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          )}

          {/* View 2: Nearby Members (Geospatial) */}
          {peopleSubTab === 'nearby' && (
            loadingNearby ? (
              <div className="flex items-center justify-center py-12 text-xs text-dim">
                <Loader2 size={18} className="animate-spin text-amber mr-2" />
                <span>Finding nearby members...</span>
              </div>
            ) : filteredNearbyPeople.length === 0 ? (
              <div className="rounded-2xl border border-line-soft bg-night-850/60 p-8 text-center text-xs text-mute space-y-2">
                <Compass size={28} className="mx-auto text-dim" />
                <p className="font-bold text-ink">No members found nearby</p>
                <p className="text-[11px]">Try expanding your radius or adjust your search keywords.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredNearbyPeople.map((item) => {
                  const p = item.user;
                  const connStatus = item.conn?.status;

                  return (
                    <div
                      key={p.id}
                      className="rounded-2xl border border-line-soft bg-night-850/90 p-4 shadow-sm backdrop-blur-md space-y-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <Link
                          to={`/mobile/profile/${p.id}`}
                          className="flex items-center gap-3 min-w-0 flex-1 group"
                        >
                          <div
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl font-display text-xs font-black text-night-950 shadow-md"
                            style={{
                              background: `linear-gradient(135deg, hsl(${p.avatarHue ?? 210} 85% 68%), hsl(${((p.avatarHue ?? 210) + 42) % 360} 80% 55%))`,
                            }}
                          >
                            {p.name?.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-display text-xs font-bold text-ink group-hover:text-amber transition-colors truncate flex items-center gap-1">
                              {p.name}
                              {p.isVerified && (
                                <span title="ID Verified" className="inline-flex items-center">
                                  <Shield size={11} className="text-safe shrink-0" />
                                </span>
                              )}
                            </h4>
                            <p className="font-mono text-[10px] text-dim truncate">@{p.username}</p>
                            <p className="font-mono text-[10px] text-amber mt-0.5">
                              ~{fmtDistance(item.distanceKm)} away
                            </p>
                          </div>
                        </Link>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <FollowButton userId={p.id} size="sm" />
                          {connStatus === 'accepted' ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate('/mobile/messages')}
                            >
                              Chat
                            </Button>
                          ) : connStatus === 'pending' ? (
                            <span className="rounded-xl border border-amber/30 bg-amber/10 px-2.5 py-1 font-mono text-[10px] font-bold text-amber">
                              Pending
                            </span>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleConnect(p.id)}
                            >
                              Connect
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Bio & Interests */}
                      {p.bio && (
                        <p className="text-xs text-mute line-clamp-2 leading-relaxed">
                          {p.bio}
                        </p>
                      )}

                      {p.interests && p.interests.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {p.interests.slice(0, 4).map((tag) => (
                            <span
                              key={tag}
                              className="rounded-lg bg-night-900 px-2 py-0.5 font-mono text-[9px] text-dim border border-line-soft/40"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>
      )}

      {/* Tab 3: Connection Requests (Reusing existing request UI without duplicate screens) */}
      {activeTab === 'requests' && (
        <div className="space-y-4">
          <div>
            <h4 className="font-display text-xs font-bold uppercase tracking-wider text-ink px-1 mb-2">
              Incoming Requests ({incoming.length})
            </h4>
            {incoming.length === 0 ? (
              <p className="text-center text-xs text-mute py-6 rounded-2xl border border-line-soft bg-night-850/50">
                No pending connection requests.
              </p>
            ) : (
              <div className="space-y-2">
                {incoming.map((c) => {
                  const sender = c.requesterId;
                  return (
                    <div
                      key={c._id}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-line-soft bg-night-850 p-3"
                    >
                      <Link
                        to={`/mobile/profile/${sender._id || sender.id}`}
                        className="flex items-center gap-2.5 min-w-0 flex-1"
                      >
                        <div
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-display text-xs font-bold text-night-950"
                          style={{
                            background: `linear-gradient(135deg, hsl(${sender.avatarHue ?? 210} 85% 68%), hsl(${((sender.avatarHue ?? 210) + 42) % 360} 80% 55%))`,
                          }}
                        >
                          {sender.name?.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-xs text-ink truncate">{sender.name}</p>
                          <p className="font-mono text-[10px] text-dim truncate">@{sender.username}</p>
                        </div>
                      </Link>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleAccept(c._id)}
                          className="flex h-8 w-8 items-center justify-center rounded-xl bg-safe text-night-950 hover:bg-safe/90 transition-colors"
                          title="Accept"
                        >
                          <Check size={16} strokeWidth={2.5} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReject(c._id)}
                          className="flex h-8 w-8 items-center justify-center rounded-xl bg-night-800 text-mute hover:text-sos transition-colors"
                          title="Decline"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {outgoing.length > 0 && (
            <div>
              <h4 className="font-display text-xs font-bold uppercase tracking-wider text-ink px-1 mb-2">
                Outgoing Requests ({outgoing.length})
              </h4>
              <div className="space-y-2">
                {outgoing.map((c) => {
                  const receiver = c.receiverId;
                  return (
                    <div
                      key={c._id}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-line-soft bg-night-850 p-3 opacity-80"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-display text-xs font-bold text-night-950"
                          style={{
                            background: `linear-gradient(135deg, hsl(${receiver?.avatarHue ?? 210} 85% 68%), hsl(${((receiver?.avatarHue ?? 210) + 42) % 360} 80% 55%))`,
                          }}
                        >
                          {receiver?.name?.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-xs text-ink truncate">{receiver?.name}</p>
                          <p className="font-mono text-[10px] text-dim truncate">Waiting for response</p>
                        </div>
                      </div>
                      <span className="font-mono text-[10px] text-dim">Pending</span>
                    </div>
                  );
                })}
              </div>
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
