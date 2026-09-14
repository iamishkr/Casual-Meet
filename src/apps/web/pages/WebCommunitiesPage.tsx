import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { api } from '../../../lib/api';
import type { CommunityDTO } from '../../../lib/types';
import {
  Users,
  Search,
  Plus,
  Lock,
  Globe,
  Check,
  Clock,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  X,
  AlertCircle,
  Image as ImageIcon,
} from 'lucide-react';

export default function WebCommunitiesPage() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'discover' | 'my'>('discover');
  const [privacyFilter, setPrivacyFilter] = useState<'all' | 'public' | 'private'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [communities, setCommunities] = useState<CommunityDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 12;

  // Create Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createPrivacy, setCreatePrivacy] = useState<'public' | 'private'>('public');
  const [createAvatar, setCreateAvatar] = useState('');
  const [createCover, setCreateCover] = useState('');
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Joining state tracker
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  const fetchCommunities = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (activeTab === 'my') {
        const res = await api.communities.my(page, limit);
        setCommunities(res.communities);
        setTotal(res.total);
      } else {
        const pFilter = privacyFilter === 'all' ? undefined : privacyFilter;
        const res = await api.communities.list(searchQuery, pFilter, page, limit);
        setCommunities(res.communities);
        setTotal(res.total);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load communities.');
    } finally {
      setLoading(false);
    }
  }, [activeTab, privacyFilter, searchQuery, page]);

  useEffect(() => {
    fetchCommunities();
  }, [fetchCommunities]);

  const handleJoin = async (e: React.MouseEvent, comm: CommunityDTO) => {
    e.stopPropagation();
    if (actionLoading[comm.id]) return;

    setActionLoading((prev) => ({ ...prev, [comm.id]: true }));
    try {
      const res = await api.communities.join(comm.id);
      setCommunities((prev) =>
        prev.map((c) => {
          if (c.id === comm.id) {
            return {
              ...c,
              isMember: res.membership.status === 'active',
              membershipStatus: res.membership.status,
              memberCount: res.community.memberCount,
            };
          }
          return c;
        })
      );
    } catch (err: any) {
      alert(err.message || 'Failed to join community.');
    } finally {
      setActionLoading((prev) => ({ ...prev, [comm.id]: false }));
    }
  };

  const handleCreateCommunity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createName.trim() || createName.trim().length < 2) {
      setCreateError('Community name must be at least 2 characters.');
      return;
    }

    setCreateSubmitting(true);
    setCreateError(null);
    try {
      const newComm = await api.communities.create({
        name: createName.trim(),
        description: createDescription.trim() || undefined,
        privacy: createPrivacy,
        avatar: createAvatar.trim() || undefined,
        coverImage: createCover.trim() || undefined,
      });

      setShowCreateModal(false);
      setCreateName('');
      setCreateDescription('');
      setCreatePrivacy('public');
      setCreateAvatar('');
      setCreateCover('');
      navigate(`/app/communities/${newComm.id}`);
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create community.');
    } finally {
      setCreateSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto w-full pb-12">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-line-soft bg-gradient-to-br from-night-900 via-night-800 to-night-900 p-6 md:p-8 shadow-xl">
        <div className="absolute -right-10 -top-10 h-60 w-60 rounded-full bg-amber/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-amber/30 bg-amber/10 text-amber shadow-[0_0_20px_-4px_rgba(255,178,36,0.5)]">
                <Users size={22} />
              </div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">
                Social Communities & Circles
              </h1>
            </div>
            <p className="text-sm text-night-300 max-w-xl">
              Connect around shared passions, hobbies, sports, and local meetups. Join open public groups or request access to curated private circles.
            </p>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center justify-center gap-2 rounded-2xl border border-amber/40 bg-gradient-to-r from-amber to-amber-dark px-5 py-3 text-sm font-bold text-night-950 shadow-lg shadow-amber/20 hover:brightness-110 active:scale-95 transition-all self-start md:self-auto"
          >
            <Plus size={18} />
            <span>Create Community</span>
          </button>
        </div>
      </div>

      {/* Tabs & Search Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Tab Buttons */}
        <div className="flex items-center rounded-2xl border border-line-soft bg-night-900/80 p-1.5 backdrop-blur-md">
          <button
            onClick={() => {
              setActiveTab('discover');
              setPage(1);
            }}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              activeTab === 'discover'
                ? 'bg-amber text-night-950 shadow-md'
                : 'text-night-300 hover:text-white'
            }`}
          >
            <Globe size={15} />
            <span>Discover</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('my');
              setPage(1);
            }}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              activeTab === 'my'
                ? 'bg-amber text-night-950 shadow-md'
                : 'text-night-300 hover:text-white'
            }`}
          >
            <Users size={15} />
            <span>My Communities</span>
          </button>
        </div>

        {/* Search & Privacy Filters */}
        {activeTab === 'discover' && (
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Privacy Pills */}
            <div className="flex items-center rounded-xl border border-line-soft bg-night-900/60 p-1 text-xs">
              <button
                onClick={() => {
                  setPrivacyFilter('all');
                  setPage(1);
                }}
                className={`rounded-lg px-2.5 py-1 font-semibold transition-colors ${
                  privacyFilter === 'all' ? 'bg-night-700 text-amber' : 'text-night-400 hover:text-white'
                }`}
              >
                All
              </button>
              <button
                onClick={() => {
                  setPrivacyFilter('public');
                  setPage(1);
                }}
                className={`rounded-lg px-2.5 py-1 font-semibold transition-colors ${
                  privacyFilter === 'public' ? 'bg-night-700 text-amber' : 'text-night-400 hover:text-white'
                }`}
              >
                Public
              </button>
              <button
                onClick={() => {
                  setPrivacyFilter('private');
                  setPage(1);
                }}
                className={`rounded-lg px-2.5 py-1 font-semibold transition-colors ${
                  privacyFilter === 'private' ? 'bg-night-700 text-amber' : 'text-night-400 hover:text-white'
                }`}
              >
                Private
              </button>
            </div>

            {/* Search Input */}
            <div className="relative min-w-[220px]">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-night-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Search communities..."
                className="w-full rounded-xl border border-line-soft bg-night-900/90 pl-9 pr-3 py-1.5 text-xs text-white placeholder-night-400 focus:border-amber focus:outline-none transition-colors"
              />
            </div>
          </div>
        )}
      </div>

      {/* Community Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-56 rounded-3xl border border-line-soft bg-night-900/40 animate-pulse"
            />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-3xl border border-red-500/30 bg-red-500/10 p-8 text-center text-sm text-red-300">
          <AlertCircle size={32} className="mx-auto mb-2 text-red-400" />
          <p className="font-semibold">{error}</p>
          <button
            onClick={fetchCommunities}
            className="mt-4 rounded-xl border border-red-500/40 bg-red-500/20 px-4 py-2 text-xs font-bold text-white hover:bg-red-500/30 transition-colors"
          >
            Retry
          </button>
        </div>
      ) : communities.length === 0 ? (
        <div className="rounded-3xl border border-line-soft bg-night-900/40 p-12 text-center">
          <Users size={40} className="mx-auto mb-3 text-night-500" />
          <h3 className="text-base font-bold text-white">
            {activeTab === 'my' ? 'No Communities Joined Yet' : 'No Communities Found'}
          </h3>
          <p className="mt-1 text-xs text-night-400 max-w-sm mx-auto">
            {activeTab === 'my'
              ? 'Explore and join public communities or create your own circle to get started.'
              : 'Try searching with a different keyword or filter.'}
          </p>
          {activeTab === 'my' && (
            <button
              onClick={() => setActiveTab('discover')}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-amber px-4 py-2 text-xs font-bold text-night-950 hover:brightness-110 transition-all"
            >
              <Globe size={14} />
              <span>Explore Communities</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {communities.map((comm) => (
            <div
              key={comm.id}
              onClick={() => navigate(`/app/communities/${comm.id}`)}
              className="group relative flex flex-col justify-between rounded-3xl border border-line-soft bg-night-900/70 p-5 backdrop-blur-sm hover:border-amber/40 hover:bg-night-850 transition-all duration-200 cursor-pointer shadow-md hover:shadow-xl hover:-translate-y-0.5"
            >
              <div>
                {/* Cover & Avatar Header */}
                <div className="relative mb-4 flex items-center gap-3.5">
                  <div className="h-12 w-12 shrink-0 rounded-2xl border border-amber/30 bg-gradient-to-br from-amber/20 to-amber/5 flex items-center justify-center text-amber font-bold text-lg overflow-hidden shadow-inner">
                    {comm.avatar ? (
                      <img src={comm.avatar} alt={comm.name} className="h-full w-full object-cover" />
                    ) : (
                      comm.name.slice(0, 2).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-base font-bold text-white group-hover:text-amber transition-colors">
                        {comm.name}
                      </h3>
                    </div>
                    <span className="text-[11px] font-mono text-night-400 truncate block">
                      @{comm.slug}
                    </span>
                  </div>
                  {/* Privacy Badge */}
                  <div className="shrink-0">
                    {comm.privacy === 'private' ? (
                      <span className="flex items-center gap-1 rounded-full border border-amber/30 bg-amber/10 px-2 py-0.5 text-[10px] font-bold text-amber">
                        <Lock size={10} />
                        Private
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                        <Globe size={10} />
                        Public
                      </span>
                    )}
                  </div>
                </div>

                {/* Description */}
                <p className="text-xs text-night-300 line-clamp-2 leading-relaxed min-h-[36px]">
                  {comm.description || 'Welcome to this community. Join to participate in discussions and events.'}
                </p>
              </div>

              {/* Stats & Action Footer */}
              <div className="mt-5 pt-3 border-t border-line-soft/50 flex items-center justify-between">
                <div className="flex items-center gap-3 text-[11px] text-night-400">
                  <span className="flex items-center gap-1 font-semibold text-night-200">
                    <Users size={13} className="text-amber" />
                    {comm.memberCount} {comm.memberCount === 1 ? 'member' : 'members'}
                  </span>
                  <span>•</span>
                  <span>{comm.postCount} {comm.postCount === 1 ? 'post' : 'posts'}</span>
                </div>

                {/* Action button */}
                {comm.isMember ? (
                  <span className="flex items-center gap-1 rounded-xl border border-line-soft bg-night-800 px-3 py-1.5 text-[11px] font-bold text-night-200">
                    <Check size={12} className="text-emerald-400" />
                    {comm.userRole ? comm.userRole.toUpperCase() : 'JOINED'}
                  </span>
                ) : comm.membershipStatus === 'pending' ? (
                  <span className="flex items-center gap-1 rounded-xl border border-amber/30 bg-amber/10 px-3 py-1.5 text-[11px] font-bold text-amber">
                    <Clock size={12} />
                    PENDING
                  </span>
                ) : (
                  <button
                    onClick={(e) => handleJoin(e, comm)}
                    disabled={actionLoading[comm.id]}
                    className="flex items-center gap-1 rounded-xl bg-amber/20 border border-amber/40 px-3 py-1.5 text-[11px] font-bold text-amber hover:bg-amber hover:text-night-950 active:scale-95 transition-all"
                  >
                    <span>{comm.privacy === 'private' ? 'Request' : 'Join'}</span>
                    <ArrowRight size={12} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CREATE COMMUNITY MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-night-950/80 p-4 backdrop-blur-md">
          <div className="relative w-full max-w-lg rounded-3xl border border-line-soft bg-night-900 p-6 md:p-8 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setShowCreateModal(false)}
              className="absolute right-5 top-5 rounded-full p-1 text-night-400 hover:bg-night-800 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-amber/30 bg-amber/10 text-amber shadow-[0_0_15px_-3px_rgba(255,178,36,0.4)]">
                <Users size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Create New Community</h2>
                <p className="text-xs text-night-400">Start a group for your circle, interest, or local meetup.</p>
              </div>
            </div>

            {createError && (
              <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300 flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0" />
                <span>{createError}</span>
              </div>
            )}

            <form onSubmit={handleCreateCommunity} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-night-300 mb-1.5">
                  Community Name <span className="text-amber">*</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={100}
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="e.g. Weekend Hikers & Trekkers"
                  className="w-full rounded-xl border border-line-soft bg-night-800 px-3.5 py-2 text-sm text-white placeholder-night-500 focus:border-amber focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-night-300 mb-1.5">
                  Description
                </label>
                <textarea
                  rows={3}
                  maxLength={1000}
                  value={createDescription}
                  onChange={(e) => setCreateDescription(e.target.value)}
                  placeholder="What is this community about? Share guidelines, meetup locations, or interests..."
                  className="w-full rounded-xl border border-line-soft bg-night-800 p-3 text-sm text-white placeholder-night-500 focus:border-amber focus:outline-none transition-colors resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-night-300 mb-1.5">
                  Privacy Type
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div
                    onClick={() => setCreatePrivacy('public')}
                    className={`cursor-pointer rounded-2xl border p-3 transition-all ${
                      createPrivacy === 'public'
                        ? 'border-amber bg-amber/10 text-white'
                        : 'border-line-soft bg-night-800/60 text-night-400 hover:border-line-mid'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold text-xs mb-1">
                      <Globe size={14} className={createPrivacy === 'public' ? 'text-amber' : ''} />
                      <span>Public</span>
                    </div>
                    <p className="text-[11px] text-night-400 leading-tight">
                      Anyone can discover, view content, and join immediately.
                    </p>
                  </div>

                  <div
                    onClick={() => setCreatePrivacy('private')}
                    className={`cursor-pointer rounded-2xl border p-3 transition-all ${
                      createPrivacy === 'private'
                        ? 'border-amber bg-amber/10 text-white'
                        : 'border-line-soft bg-night-800/60 text-night-400 hover:border-line-mid'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold text-xs mb-1">
                      <Lock size={14} className={createPrivacy === 'private' ? 'text-amber' : ''} />
                      <span>Private</span>
                    </div>
                    <p className="text-[11px] text-night-400 leading-tight">
                      Membership requires admin approval. Content is member-only.
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl border border-line-soft bg-night-800 px-4 py-2 text-xs font-semibold text-night-300 hover:bg-night-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createSubmitting}
                  className="flex items-center gap-2 rounded-xl bg-amber px-5 py-2 text-xs font-bold text-night-950 hover:brightness-110 disabled:opacity-50 transition-all shadow-md"
                >
                  {createSubmitting ? 'Creating...' : 'Create Community'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
