import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { api } from '../../../lib/api';
import { getSocket } from '../../../lib/socket';
import type {
  CommunityDTO,
  CommunityMemberDTO,
  CommunityMembershipRequestDTO,
  PostDTO,
} from '../../../lib/types';
import PostCard from '../../../components/social/PostCard';
import CreatePost from '../../../components/social/CreatePost';
import {
  Users,
  Lock,
  Globe,
  Plus,
  Settings,
  ShieldCheck,
  Shield,
  UserCheck,
  UserX,
  Clock,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  MessageSquare,
  Sparkles,
} from 'lucide-react';

export default function MobileCommunityDetailView() {
  const { id } = useParams<{ id: string }>();
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [community, setCommunity] = useState<CommunityDTO | null>(null);
  const [activeTab, setActiveTab] = useState<'feed' | 'members' | 'requests' | 'settings'>('feed');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Feed State
  const [posts, setPosts] = useState<PostDTO[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);

  // Members State
  const [members, setMembers] = useState<CommunityMemberDTO[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  // Requests State
  const [requests, setRequests] = useState<CommunityMembershipRequestDTO[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);

  // Settings State
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPrivacy, setEditPrivacy] = useState<'public' | 'private'>('public');
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState<string | null>(null);

  // Action Loading
  const [actionLoading, setActionLoading] = useState(false);

  const fetchCommunity = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.communities.get(id);
      setCommunity(data);
      setEditName(data.name);
      setEditDescription(data.description || '');
      setEditPrivacy(data.privacy);
    } catch (err: any) {
      setError(err.message || 'Failed to load community.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchCommunity();
  }, [fetchCommunity]);

  // Real-time Socket.io
  useEffect(() => {
    if (!id) return;
    const socket = getSocket();
    if (!socket) return;

    socket.emit('community.join', id);

    const handleNewPost = (post: PostDTO) => {
      if (post.communityId === id) {
        setPosts((prev) => [post, ...prev.filter((p) => p.id !== post.id)]);
      }
    };

    const handleMembershipUpdate = (data: { communityId: string; status: string }) => {
      if (data.communityId === id) {
        fetchCommunity();
      }
    };

    socket.on('community_post', handleNewPost);
    socket.on('community_membership_updated', handleMembershipUpdate);

    return () => {
      socket.emit('community.leave', id);
      socket.off('community_post', handleNewPost);
      socket.off('community_membership_updated', handleMembershipUpdate);
    };
  }, [id, fetchCommunity]);

  // Fetch Feed
  const fetchFeed = useCallback(async () => {
    if (!id) return;
    setFeedLoading(true);
    try {
      const res = await api.communities.getPosts(id, 1, 20);
      setPosts(res.posts);
    } catch (err) {
      // ignore
    } finally {
      setFeedLoading(false);
    }
  }, [id]);

  // Fetch Members
  const fetchMembers = useCallback(async () => {
    if (!id) return;
    setMembersLoading(true);
    try {
      const res = await api.communities.getMembers(id, 1, 50);
      setMembers(res.members);
    } catch (err) {
      // ignore
    } finally {
      setMembersLoading(false);
    }
  }, [id]);

  // Fetch Requests
  const fetchRequests = useCallback(async () => {
    if (!id) return;
    setRequestsLoading(true);
    try {
      const res = await api.communities.getRequests(id, 1, 50);
      setRequests(res.requests);
    } catch (err) {
      // ignore
    } finally {
      setRequestsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!community) return;
    if (activeTab === 'feed') fetchFeed();
    else if (activeTab === 'members') fetchMembers();
    else if (activeTab === 'requests') fetchRequests();
  }, [activeTab, community, fetchFeed, fetchMembers, fetchRequests]);

  const isOwner = community?.userRole === 'owner' || community?.ownerId === currentUser?.id;
  const isAdmin = isOwner || community?.userRole === 'admin';
  const isActiveMember = community?.isMember === true;

  const handleJoinOrLeave = async () => {
    if (!community || actionLoading) return;
    setActionLoading(true);
    try {
      if (isActiveMember || community.membershipStatus === 'pending') {
        if (confirm('Leave this community?')) {
          await api.communities.leave(community.id);
          await fetchCommunity();
        }
      } else {
        const res = await api.communities.join(community.id);
        setCommunity(res.community);
      }
    } catch (err: any) {
      alert(err.message || 'Action failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApproveRequest = async (targetUserId: string) => {
    if (!community) return;
    try {
      await api.communities.approveRequest(community.id, targetUserId);
      setRequests((prev) => prev.filter((r) => r.user.id !== targetUserId));
      setCommunity((prev) => prev ? { ...prev, memberCount: prev.memberCount + 1 } : null);
    } catch (err: any) {
      alert(err.message || 'Approval failed.');
    }
  };

  const handleRejectRequest = async (targetUserId: string) => {
    if (!community) return;
    try {
      await api.communities.rejectRequest(community.id, targetUserId);
      setRequests((prev) => prev.filter((r) => r.user.id !== targetUserId));
    } catch (err: any) {
      alert(err.message || 'Rejection failed.');
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!community) return;
    setSavingSettings(true);
    setSettingsSuccess(null);
    try {
      const updated = await api.communities.update(community.id, {
        name: editName.trim(),
        description: editDescription.trim(),
        privacy: editPrivacy,
      });
      setCommunity(updated);
      setSettingsSuccess('Settings saved.');
    } catch (err: any) {
      alert(err.message || 'Save failed.');
    } finally {
      setSavingSettings(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 space-y-4 animate-pulse">
        <div className="h-40 rounded-3xl bg-night-900 border border-line-soft" />
      </div>
    );
  }

  if (error || !community) {
    return (
      <div className="p-6 text-center space-y-3">
        <AlertCircle size={32} className="mx-auto text-red-400" />
        <p className="text-xs text-red-300">{error || 'Community not found.'}</p>
        <button
          onClick={() => navigate('/mobile/communities')}
          className="rounded-xl bg-amber px-4 py-2 text-xs font-bold text-night-950"
        >
          Back to Communities
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 px-4 py-3 pb-24">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/mobile/communities')}
          className="flex items-center gap-1.5 text-xs text-night-400 hover:text-white"
        >
          <ArrowLeft size={16} />
          <span>Groups</span>
        </button>
      </div>

      {/* Community Summary Card */}
      <div className="rounded-3xl border border-line-soft bg-night-900/90 p-4 shadow-xl space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-12 w-12 shrink-0 rounded-2xl border border-amber/30 bg-night-800 text-amber font-bold text-lg flex items-center justify-center overflow-hidden">
              {community.avatar ? (
                <img src={community.avatar} alt={community.name} className="h-full w-full object-cover" />
              ) : (
                community.name.slice(0, 2).toUpperCase()
              )}
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-black text-white truncate">{community.name}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] font-mono text-night-400 truncate">@{community.slug}</span>
                {community.privacy === 'private' ? (
                  <span className="flex items-center gap-0.5 rounded-full border border-amber/30 bg-amber/10 px-1.5 py-0.2 text-[9px] font-bold text-amber">
                    <Lock size={8} /> Private
                  </span>
                ) : (
                  <span className="flex items-center gap-0.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.2 text-[9px] font-bold text-emerald-400">
                    <Globe size={8} /> Public
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {community.description && (
          <p className="text-xs text-night-300 leading-relaxed">
            {community.description}
          </p>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-line-soft/40">
          <span className="text-[11px] text-night-400 font-medium">
            <strong className="text-white font-bold">{community.memberCount}</strong> members • <strong className="text-white font-bold">{community.postCount}</strong> posts
          </span>

          <div>
            {isActiveMember ? (
              <button
                onClick={handleJoinOrLeave}
                disabled={actionLoading}
                className="rounded-xl border border-line-soft bg-night-800 px-3 py-1 text-[11px] font-bold text-night-200"
              >
                {community.userRole ? community.userRole.toUpperCase() : 'JOINED'}
              </button>
            ) : community.membershipStatus === 'pending' ? (
              <button
                onClick={handleJoinOrLeave}
                disabled={actionLoading}
                className="rounded-xl border border-amber/30 bg-amber/10 px-3 py-1 text-[11px] font-bold text-amber"
              >
                PENDING (CANCEL)
              </button>
            ) : (
              <button
                onClick={handleJoinOrLeave}
                disabled={actionLoading}
                className="rounded-xl bg-amber px-3.5 py-1 text-[11px] font-bold text-night-950 active:scale-95 shadow-md"
              >
                {community.privacy === 'private' ? 'Request to Join' : 'Join'}
              </button>
            )}
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex items-center gap-1 pt-2 border-t border-line-soft/40 text-xs">
          <button
            onClick={() => setActiveTab('feed')}
            className={`flex-1 py-1.5 font-bold text-center rounded-lg transition-all ${
              activeTab === 'feed' ? 'bg-amber/20 text-amber' : 'text-night-400'
            }`}
          >
            Feed
          </button>
          <button
            onClick={() => setActiveTab('members')}
            className={`flex-1 py-1.5 font-bold text-center rounded-lg transition-all ${
              activeTab === 'members' ? 'bg-amber/20 text-amber' : 'text-night-400'
            }`}
          >
            Members
          </button>
          {isAdmin && (
            <button
              onClick={() => setActiveTab('requests')}
              className={`flex-1 py-1.5 font-bold text-center rounded-lg transition-all ${
                activeTab === 'requests' ? 'bg-amber/20 text-amber' : 'text-night-400'
              }`}
            >
              Requests
            </button>
          )}
          {isAdmin && (
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex-1 py-1.5 font-bold text-center rounded-lg transition-all ${
                activeTab === 'settings' ? 'bg-amber/20 text-amber' : 'text-night-400'
              }`}
            >
              Settings
            </button>
          )}
        </div>
      </div>

      {/* FEED TAB */}
      {activeTab === 'feed' && (
        <div className="space-y-3">
          {isActiveMember ? (
            <CreatePost
              communityId={community.id}
              onPostCreated={(post) => {
                setPosts((prev) => [post, ...prev]);
                setCommunity((prev) => prev ? { ...prev, postCount: prev.postCount + 1 } : null);
              }}
            />
          ) : community.privacy === 'private' ? (
            <div className="rounded-2xl border border-amber/30 bg-amber/10 p-6 text-center text-amber">
              <Lock size={28} className="mx-auto mb-2" />
              <p className="text-xs font-bold text-white mb-1">Private Community Feed</p>
              <p className="text-[11px] text-night-300 mb-3">Join this community to view discussions and media.</p>
            </div>
          ) : null}

          {feedLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="h-32 rounded-2xl bg-night-900/60 border border-line-soft animate-pulse" />
              ))}
            </div>
          ) : posts.length === 0 ? (
            <div className="rounded-2xl border border-line-soft bg-night-900/40 p-8 text-center text-xs text-night-400">
              No posts in this community yet.
            </div>
          ) : (
            posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onPostDeleted={(pId: string) => {
                  setPosts((prev) => prev.filter((p) => p.id !== pId));
                  setCommunity((prev) => prev ? { ...prev, postCount: Math.max(0, prev.postCount - 1) } : null);
                }}
              />
            ))
          )}
        </div>
      )}

      {/* MEMBERS TAB */}
      {activeTab === 'members' && (
        <div className="rounded-2xl border border-line-soft bg-night-900/80 p-4 space-y-3">
          <h3 className="text-xs font-bold text-white">Members ({members.length})</h3>
          {membersLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 rounded-xl bg-night-800 animate-pulse" />
              ))}
            </div>
          ) : members.length === 0 ? (
            <p className="text-center text-xs text-night-400 py-4">No members visible.</p>
          ) : (
            <div className="divide-y divide-line-soft/30">
              {members.map((m) => (
                <div key={m.id} className="py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-8 w-8 rounded-xl bg-night-800 text-amber font-bold text-xs flex items-center justify-center shrink-0">
                      {m.user.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-white block truncate">{m.user.name}</span>
                      <span className="text-[10px] text-night-400 font-mono block truncate">@{m.user.username}</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-semibold text-amber shrink-0">{m.role.toUpperCase()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* REQUESTS TAB */}
      {activeTab === 'requests' && isAdmin && (
        <div className="rounded-2xl border border-line-soft bg-night-900/80 p-4 space-y-3">
          <h3 className="text-xs font-bold text-white">Pending Requests ({requests.length})</h3>
          {requests.length === 0 ? (
            <p className="text-center text-xs text-night-400 py-4">No pending requests.</p>
          ) : (
            <div className="divide-y divide-line-soft/30">
              {requests.map((r) => (
                <div key={r.id} className="py-2.5 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-white block truncate">{r.user.name}</span>
                    <span className="text-[10px] text-night-400 font-mono">@{r.user.username}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleApproveRequest(r.user.id)}
                      className="rounded-lg bg-emerald-500/20 border border-emerald-500/40 px-2 py-1 text-[10px] font-bold text-emerald-400"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleRejectRequest(r.user.id)}
                      className="rounded-lg bg-red-500/15 border border-red-500/30 px-2 py-1 text-[10px] text-red-400"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SETTINGS TAB */}
      {activeTab === 'settings' && isAdmin && (
        <div className="rounded-2xl border border-line-soft bg-night-900/80 p-4 space-y-3">
          <h3 className="text-xs font-bold text-white">Community Settings</h3>
          {settingsSuccess && <p className="text-xs text-emerald-400">{settingsSuccess}</p>}

          <form onSubmit={handleSaveSettings} className="space-y-3">
            <div>
              <label className="block text-[10px] font-semibold text-night-400 mb-1">Name</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full rounded-xl border border-line-soft bg-night-800 px-3 py-1.5 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-night-400 mb-1">Description</label>
              <textarea
                rows={2}
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="w-full rounded-xl border border-line-soft bg-night-800 p-2 text-xs text-white resize-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-night-400 mb-1">Privacy</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setEditPrivacy('public')}
                  className={`rounded-xl border p-2 text-xs text-left ${
                    editPrivacy === 'public' ? 'border-amber bg-amber/10 text-white font-bold' : 'border-line-soft bg-night-800 text-night-400'
                  }`}
                >
                  Public
                </button>
                <button
                  type="button"
                  onClick={() => setEditPrivacy('private')}
                  className={`rounded-xl border p-2 text-xs text-left ${
                    editPrivacy === 'private' ? 'border-amber bg-amber/10 text-white font-bold' : 'border-line-soft bg-night-800 text-night-400'
                  }`}
                >
                  Private
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={savingSettings}
              className="w-full rounded-xl bg-amber py-2 text-xs font-bold text-night-950"
            >
              {savingSettings ? 'Saving...' : 'Save Settings'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
