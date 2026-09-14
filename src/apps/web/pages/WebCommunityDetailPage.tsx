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
  Share2,
  Trash2,
  Edit3,
  MessageSquare,
  Sparkles,
} from 'lucide-react';

export default function WebCommunityDetailPage() {
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
  const [feedPage, setFeedPage] = useState(1);
  const [feedTotal, setFeedTotal] = useState(0);

  // Members State
  const [members, setMembers] = useState<CommunityMemberDTO[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  // Requests State
  const [requests, setRequests] = useState<CommunityMembershipRequestDTO[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);

  // Settings Form State
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPrivacy, setEditPrivacy] = useState<'public' | 'private'>('public');
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  // Button Action Loading
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

  // Real-time socket room subscription
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

    const handleMembershipUpdate = (data: { communityId: string; status: string; role?: string }) => {
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

  // Load Feed
  const fetchFeed = useCallback(async () => {
    if (!id) return;
    setFeedLoading(true);
    try {
      const res = await api.communities.getPosts(id, 1, 20);
      setPosts(res.posts);
      setFeedTotal(res.total);
    } catch (err: any) {
      // ignore if private
    } finally {
      setFeedLoading(false);
    }
  }, [id]);

  // Load Members
  const fetchMembers = useCallback(async () => {
    if (!id) return;
    setMembersLoading(true);
    try {
      const res = await api.communities.getMembers(id, 1, 50);
      setMembers(res.members);
    } catch (err: any) {
      // ignore
    } finally {
      setMembersLoading(false);
    }
  }, [id]);

  // Load Requests
  const fetchRequests = useCallback(async () => {
    if (!id) return;
    setRequestsLoading(true);
    try {
      const res = await api.communities.getRequests(id, 1, 50);
      setRequests(res.requests);
    } catch (err: any) {
      // ignore
    } finally {
      setRequestsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!community) return;
    if (activeTab === 'feed') {
      fetchFeed();
    } else if (activeTab === 'members') {
      fetchMembers();
    } else if (activeTab === 'requests') {
      fetchRequests();
    }
  }, [activeTab, community, fetchFeed, fetchMembers, fetchRequests]);

  const isOwner = community?.userRole === 'owner' || community?.ownerId === currentUser?.id;
  const isAdmin = isOwner || community?.userRole === 'admin';
  const isActiveMember = community?.isMember === true;

  const handleJoinOrLeave = async () => {
    if (!community || actionLoading) return;
    setActionLoading(true);
    try {
      if (isActiveMember || community.membershipStatus === 'pending') {
        if (confirm('Are you sure you want to leave this community?')) {
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
      alert(err.message || 'Failed to approve request.');
    }
  };

  const handleRejectRequest = async (targetUserId: string) => {
    if (!community) return;
    try {
      await api.communities.rejectRequest(community.id, targetUserId);
      setRequests((prev) => prev.filter((r) => r.user.id !== targetUserId));
    } catch (err: any) {
      alert(err.message || 'Failed to reject request.');
    }
  };

  const handleRoleChange = async (targetUserId: string, newRole: 'admin' | 'member') => {
    if (!community) return;
    try {
      await api.communities.updateRole(community.id, targetUserId, newRole);
      setMembers((prev) =>
        prev.map((m) => (m.user.id === targetUserId ? { ...m, role: newRole } : m))
      );
    } catch (err: any) {
      alert(err.message || 'Failed to update role.');
    }
  };

  const handleKickMember = async (targetUserId: string, targetName: string) => {
    if (!community) return;
    if (!confirm(`Are you sure you want to remove ${targetName} from the community?`)) return;
    try {
      await api.communities.removeMember(community.id, targetUserId);
      setMembers((prev) => prev.filter((m) => m.user.id !== targetUserId));
      setCommunity((prev) => prev ? { ...prev, memberCount: Math.max(0, prev.memberCount - 1) } : null);
    } catch (err: any) {
      alert(err.message || 'Failed to remove member.');
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!community) return;
    setSavingSettings(true);
    setSettingsSuccess(null);
    setSettingsError(null);
    try {
      const updated = await api.communities.update(community.id, {
        name: editName.trim(),
        description: editDescription.trim(),
        privacy: editPrivacy,
      });
      setCommunity(updated);
      setSettingsSuccess('Community settings updated successfully.');
    } catch (err: any) {
      setSettingsError(err.message || 'Failed to update settings.');
    } finally {
      setSavingSettings(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 pb-12 animate-pulse">
        <div className="h-64 rounded-3xl bg-night-900/60 border border-line-soft" />
        <div className="h-96 rounded-3xl bg-night-900/40 border border-line-soft" />
      </div>
    );
  }

  if (error || !community) {
    return (
      <div className="max-w-md mx-auto my-12 rounded-3xl border border-red-500/30 bg-red-500/10 p-8 text-center text-red-300">
        <AlertCircle size={36} className="mx-auto mb-3 text-red-400" />
        <h2 className="text-lg font-bold text-white mb-1">Community Not Found</h2>
        <p className="text-xs text-red-200 mb-6">{error || 'This community does not exist or has been suspended.'}</p>
        <Link
          to="/app/communities"
          className="inline-flex items-center gap-2 rounded-xl bg-amber px-4 py-2 text-xs font-bold text-night-950 hover:brightness-110 transition-all"
        >
          <ArrowLeft size={14} />
          <span>Back to Communities</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Back Button */}
      <button
        onClick={() => navigate('/app/communities')}
        className="inline-flex items-center gap-2 text-xs font-semibold text-night-400 hover:text-white transition-colors"
      >
        <ArrowLeft size={14} />
        <span>All Communities</span>
      </button>

      {/* Community Header Card */}
      <div className="relative overflow-hidden rounded-3xl border border-line-soft bg-gradient-to-b from-night-900 via-night-850 to-night-900 shadow-xl">
        {/* Cover Accent Banner */}
        <div className="h-32 w-full bg-gradient-to-r from-amber/20 via-amber/10 to-amber-dark/20 border-b border-line-soft/50 relative">
          {community.coverImage && (
            <img src={community.coverImage} alt="Cover" className="h-full w-full object-cover" />
          )}
        </div>

        {/* Profile Details Container */}
        <div className="px-6 pb-6 pt-0 relative">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-12 mb-4">
            {/* Avatar & Title */}
            <div className="flex items-end gap-4">
              <div className="h-24 w-24 rounded-3xl border-4 border-night-900 bg-night-800 text-amber font-black text-2xl flex items-center justify-center overflow-hidden shadow-2xl shrink-0">
                {community.avatar ? (
                  <img src={community.avatar} alt={community.name} className="h-full w-full object-cover" />
                ) : (
                  community.name.slice(0, 2).toUpperCase()
                )}
              </div>
              <div className="space-y-1 mb-1">
                <div className="flex items-center gap-2.5">
                  <h1 className="text-2xl font-black text-white">{community.name}</h1>
                  {community.privacy === 'private' ? (
                    <span className="flex items-center gap-1 rounded-full border border-amber/40 bg-amber/15 px-2.5 py-0.5 text-[11px] font-bold text-amber">
                      <Lock size={11} />
                      Private Circle
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-bold text-emerald-400">
                      <Globe size={11} />
                      Public
                    </span>
                  )}
                </div>
                <p className="text-xs font-mono text-night-400">@{community.slug}</p>
              </div>
            </div>

            {/* Action Button */}
            <div className="flex items-center gap-2.5 self-start sm:self-auto">
              {isActiveMember ? (
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-400">
                    <CheckCircle2 size={14} />
                    <span>{community.userRole?.toUpperCase() || 'MEMBER'}</span>
                  </span>
                  {community.userRole !== 'owner' && (
                    <button
                      onClick={handleJoinOrLeave}
                      disabled={actionLoading}
                      className="rounded-2xl border border-line-soft bg-night-800/80 px-3.5 py-2 text-xs font-semibold text-night-300 hover:bg-red-500/15 hover:text-red-400 hover:border-red-500/30 transition-all"
                    >
                      Leave
                    </button>
                  )}
                </div>
              ) : community.membershipStatus === 'pending' ? (
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1.5 rounded-2xl border border-amber/40 bg-amber/15 px-4 py-2 text-xs font-bold text-amber">
                    <Clock size={14} />
                    <span>Request Pending</span>
                  </span>
                  <button
                    onClick={handleJoinOrLeave}
                    disabled={actionLoading}
                    className="rounded-2xl border border-line-soft bg-night-800/80 px-3 py-2 text-xs font-semibold text-night-400 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleJoinOrLeave}
                  disabled={actionLoading}
                  className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-amber to-amber-dark px-6 py-2.5 text-xs font-bold text-night-950 shadow-lg shadow-amber/20 hover:brightness-110 active:scale-95 transition-all"
                >
                  <Plus size={16} />
                  <span>{community.privacy === 'private' ? 'Request to Join' : 'Join Community'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Description */}
          {community.description && (
            <p className="text-xs md:text-sm text-night-300 leading-relaxed max-w-2xl mt-3">
              {community.description}
            </p>
          )}

          {/* Metadata counts */}
          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-line-soft/50 text-xs text-night-400">
            <span className="font-semibold text-white">
              <strong className="text-amber font-mono font-bold">{community.memberCount}</strong> {community.memberCount === 1 ? 'member' : 'members'}
            </span>
            <span>•</span>
            <span className="font-semibold text-white">
              <strong className="text-amber font-mono font-bold">{community.postCount}</strong> {community.postCount === 1 ? 'post' : 'posts'}
            </span>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="flex items-center gap-1 px-6 border-t border-line-soft bg-night-950/40">
          <button
            onClick={() => setActiveTab('feed')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'feed'
                ? 'border-amber text-amber'
                : 'border-transparent text-night-400 hover:text-white'
            }`}
          >
            <MessageSquare size={14} />
            <span>Community Feed</span>
          </button>

          <button
            onClick={() => setActiveTab('members')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'members'
                ? 'border-amber text-amber'
                : 'border-transparent text-night-400 hover:text-white'
            }`}
          >
            <Users size={14} />
            <span>Members ({community.memberCount})</span>
          </button>

          {isAdmin && (
            <button
              onClick={() => setActiveTab('requests')}
              className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-all ${
                activeTab === 'requests'
                  ? 'border-amber text-amber'
                  : 'border-transparent text-night-400 hover:text-white'
              }`}
            >
              <Clock size={14} />
              <span>Requests</span>
            </button>
          )}

          {isAdmin && (
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-all ${
                activeTab === 'settings'
                  ? 'border-amber text-amber'
                  : 'border-transparent text-night-400 hover:text-white'
              }`}
            >
              <Settings size={14} />
              <span>Settings</span>
            </button>
          )}
        </div>
      </div>

      {/* TAB CONTENTS */}

      {/* 1. FEED TAB */}
      {activeTab === 'feed' && (
        <div className="space-y-6">
          {/* Post composer: Active members only */}
          {isActiveMember ? (
            <div className="rounded-3xl border border-line-soft bg-night-900/80 p-5 shadow-lg">
              <h3 className="text-xs font-bold uppercase tracking-wider text-amber mb-3 flex items-center gap-1.5">
                <Sparkles size={14} />
                <span>Create Community Post</span>
              </h3>
              <CreatePost
                communityId={community.id}
                onPostCreated={(newPost) => {
                  setPosts((prev) => [newPost, ...prev]);
                  setCommunity((prev) => prev ? { ...prev, postCount: prev.postCount + 1 } : null);
                }}
              />
            </div>
          ) : community.privacy === 'private' ? (
            <div className="rounded-3xl border border-amber/30 bg-amber/10 p-8 text-center text-amber">
              <Lock size={36} className="mx-auto mb-2" />
              <h3 className="text-base font-bold text-white mb-1">Private Community Feed</h3>
              <p className="text-xs text-night-300 max-w-sm mx-auto mb-4">
                Posts and media in this community are confidential and restricted to active members.
              </p>
              {community.membershipStatus === 'pending' ? (
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-amber/40 bg-amber/20 px-4 py-2 text-xs font-bold text-amber">
                  <Clock size={13} />
                  <span>Your Request is Pending Approval</span>
                </span>
              ) : (
                <button
                  onClick={handleJoinOrLeave}
                  className="inline-flex items-center gap-2 rounded-xl bg-amber px-5 py-2 text-xs font-bold text-night-950 hover:brightness-110 transition-all shadow-md"
                >
                  <Plus size={14} />
                  <span>Request to Join to View Feed</span>
                </button>
              )}
            </div>
          ) : null}

          {/* Posts List */}
          {feedLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-44 rounded-3xl border border-line-soft bg-night-900/40 animate-pulse" />
              ))}
            </div>
          ) : posts.length === 0 ? (
            <div className="rounded-3xl border border-line-soft bg-night-900/40 p-12 text-center">
              <MessageSquare size={36} className="mx-auto mb-3 text-night-500" />
              <h3 className="text-base font-bold text-white">No Posts Yet</h3>
              <p className="mt-1 text-xs text-night-400 max-w-xs mx-auto">
                Be the first to share an update, photo, or conversation with this community!
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onPostDeleted={(postId: string) => {
                    setPosts((prev) => prev.filter((p) => p.id !== postId));
                    setCommunity((prev) => prev ? { ...prev, postCount: Math.max(0, prev.postCount - 1) } : null);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* 2. MEMBERS TAB */}
      {activeTab === 'members' && (
        <div className="rounded-3xl border border-line-soft bg-night-900/80 p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-line-soft">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Users size={18} className="text-amber" />
              <span>Community Members</span>
            </h3>
            <span className="text-xs text-night-400 font-mono">
              Total: {members.length}
            </span>
          </div>

          {membersLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-14 rounded-2xl bg-night-800/60 animate-pulse" />
              ))}
            </div>
          ) : members.length === 0 ? (
            <p className="text-center py-8 text-xs text-night-400">
              {community.privacy === 'private' && !isActiveMember
                ? 'Member list is hidden in private communities.'
                : 'No members found.'}
            </p>
          ) : (
            <div className="divide-y divide-line-soft/40">
              {members.map((member) => {
                const isMemberOwner = member.role === 'owner';
                const isMemberAdmin = member.role === 'admin';
                const canManageRoles = isOwner && !isMemberOwner && member.user.id !== currentUser?.id;
                const canKick = (isOwner || (isAdmin && !isMemberAdmin && !isMemberOwner)) && member.user.id !== currentUser?.id;

                return (
                  <div key={member.id} className="py-3.5 flex items-center justify-between gap-4">
                    <Link
                      to={`/app/profile/${member.user.id}`}
                      className="flex items-center gap-3 group min-w-0"
                    >
                      <div className="h-10 w-10 shrink-0 rounded-2xl border border-amber/30 bg-night-800 text-amber font-bold flex items-center justify-center overflow-hidden">
                        {member.user.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-white group-hover:text-amber transition-colors truncate">
                            {member.user.name}
                          </span>
                          {member.user.isVerified && (
                            <ShieldCheck size={12} className="text-emerald-400 shrink-0" />
                          )}
                        </div>
                        <span className="text-[11px] font-mono text-night-400 truncate block">
                          @{member.user.username}
                        </span>
                      </div>
                    </Link>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* Role Pill */}
                      {isMemberOwner ? (
                        <span className="flex items-center gap-1 rounded-full border border-amber/40 bg-amber/15 px-2.5 py-0.5 text-[10px] font-bold text-amber">
                          <Shield size={11} />
                          Owner
                        </span>
                      ) : isMemberAdmin ? (
                        <span className="flex items-center gap-1 rounded-full border border-sky-500/40 bg-sky-500/15 px-2.5 py-0.5 text-[10px] font-bold text-sky-400">
                          <ShieldCheck size={11} />
                          Admin
                        </span>
                      ) : (
                        <span className="rounded-full border border-line-soft bg-night-800 px-2.5 py-0.5 text-[10px] font-semibold text-night-300">
                          Member
                        </span>
                      )}

                      {/* Owner Role Management Dropdown / Toggle */}
                      {canManageRoles && (
                        <select
                          value={member.role}
                          onChange={(e) => handleRoleChange(member.user.id, e.target.value as any)}
                          className="rounded-xl border border-line-soft bg-night-800 px-2 py-1 text-[11px] text-white focus:border-amber focus:outline-none"
                        >
                          <option value="member">Member</option>
                          <option value="admin">Admin</option>
                        </select>
                      )}

                      {/* Kick Button */}
                      {canKick && (
                        <button
                          onClick={() => handleKickMember(member.user.id, member.user.name)}
                          title="Remove member"
                          className="rounded-xl p-1.5 text-night-400 hover:bg-red-500/20 hover:text-red-400 transition-colors"
                        >
                          <UserX size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 3. REQUESTS TAB (Owner / Admin only) */}
      {activeTab === 'requests' && isAdmin && (
        <div className="rounded-3xl border border-line-soft bg-night-900/80 p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-line-soft">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Clock size={18} className="text-amber" />
              <span>Pending Membership Requests</span>
            </h3>
            <span className="text-xs text-night-400 font-mono">
              Pending: {requests.length}
            </span>
          </div>

          {requestsLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="h-16 rounded-2xl bg-night-800/60 animate-pulse" />
              ))}
            </div>
          ) : requests.length === 0 ? (
            <p className="text-center py-10 text-xs text-night-400">
              No pending membership requests at this time.
            </p>
          ) : (
            <div className="divide-y divide-line-soft/40">
              {requests.map((req) => (
                <div key={req.id} className="py-4 flex items-center justify-between gap-4">
                  <Link
                    to={`/app/profile/${req.user.id}`}
                    className="flex items-center gap-3 group min-w-0"
                  >
                    <div className="h-11 w-11 shrink-0 rounded-2xl border border-amber/30 bg-night-800 text-amber font-bold flex items-center justify-center overflow-hidden">
                      {req.user.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-white group-hover:text-amber transition-colors truncate">
                          {req.user.name}
                        </span>
                        {req.user.isVerified && (
                          <ShieldCheck size={12} className="text-emerald-400 shrink-0" />
                        )}
                      </div>
                      <span className="text-[11px] font-mono text-night-400 truncate block">
                        @{req.user.username}
                      </span>
                    </div>
                  </Link>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleApproveRequest(req.user.id)}
                      className="flex items-center gap-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 px-3.5 py-1.5 text-xs font-bold text-emerald-400 hover:bg-emerald-500 hover:text-night-950 transition-all active:scale-95"
                    >
                      <UserCheck size={14} />
                      <span>Approve</span>
                    </button>
                    <button
                      onClick={() => handleRejectRequest(req.user.id)}
                      className="flex items-center gap-1.5 rounded-xl bg-red-500/15 border border-red-500/30 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500 hover:text-white transition-all active:scale-95"
                    >
                      <UserX size={14} />
                      <span>Decline</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 4. SETTINGS TAB (Owner / Admin only) */}
      {activeTab === 'settings' && isAdmin && (
        <div className="rounded-3xl border border-line-soft bg-night-900/80 p-6 md:p-8 shadow-xl">
          <div className="flex items-center gap-2 mb-6 pb-4 border-b border-line-soft">
            <Settings size={20} className="text-amber" />
            <h3 className="text-lg font-bold text-white">Community Settings</h3>
          </div>

          {settingsSuccess && (
            <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300 flex items-center gap-2">
              <CheckCircle2 size={16} className="shrink-0" />
              <span>{settingsSuccess}</span>
            </div>
          )}

          {settingsError && (
            <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300 flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{settingsError}</span>
            </div>
          )}

          <form onSubmit={handleSaveSettings} className="space-y-5 max-w-xl">
            <div>
              <label className="block text-xs font-semibold text-night-300 mb-1.5">
                Community Name
              </label>
              <input
                type="text"
                required
                maxLength={100}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full rounded-xl border border-line-soft bg-night-800 px-3.5 py-2 text-sm text-white focus:border-amber focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-night-300 mb-1.5">
                Description
              </label>
              <textarea
                rows={3}
                maxLength={1000}
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="w-full rounded-xl border border-line-soft bg-night-800 p-3 text-sm text-white focus:border-amber focus:outline-none resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-night-300 mb-1.5">
                Privacy Transition
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div
                  onClick={() => setEditPrivacy('public')}
                  className={`cursor-pointer rounded-2xl border p-3.5 transition-all ${
                    editPrivacy === 'public'
                      ? 'border-amber bg-amber/10 text-white'
                      : 'border-line-soft bg-night-800 text-night-400 hover:border-line-mid'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-xs mb-1">
                    <Globe size={14} className={editPrivacy === 'public' ? 'text-amber' : ''} />
                    <span>Public</span>
                  </div>
                  <p className="text-[11px] text-night-400">
                    Open to all users. Direct join enabled.
                  </p>
                </div>

                <div
                  onClick={() => setEditPrivacy('private')}
                  className={`cursor-pointer rounded-2xl border p-3.5 transition-all ${
                    editPrivacy === 'private'
                      ? 'border-amber bg-amber/10 text-white'
                      : 'border-line-soft bg-night-800 text-night-400 hover:border-line-mid'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-xs mb-1">
                    <Lock size={14} className={editPrivacy === 'private' ? 'text-amber' : ''} />
                    <span>Private</span>
                  </div>
                  <p className="text-[11px] text-night-400">
                    Restricted membership & feed. Requires admin approval.
                  </p>
                </div>
              </div>

              {community.privacy === 'private' && editPrivacy === 'public' && (
                <div className="mt-3 rounded-2xl border border-amber/30 bg-amber/10 p-3 text-xs text-amber space-y-1">
                  <p className="font-bold flex items-center gap-1.5">
                    <AlertCircle size={14} />
                    <span>Private → Public Transition Notice</span>
                  </p>
                  <p className="text-[11px] text-night-300 leading-relaxed">
                    Switching to Public will automatically convert all pending membership requests into active members and allow future users to join directly. Existing posts will become visible according to public community rules.
                  </p>
                </div>
              )}
            </div>

            <div className="pt-3">
              <button
                type="submit"
                disabled={savingSettings}
                className="flex items-center gap-2 rounded-xl bg-amber px-6 py-2.5 text-xs font-bold text-night-950 hover:brightness-110 disabled:opacity-50 transition-all shadow-md"
              >
                {savingSettings ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
