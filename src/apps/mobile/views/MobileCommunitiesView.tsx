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
  ArrowRight,
  X,
  AlertCircle,
} from 'lucide-react';

export default function MobileCommunitiesView() {
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

  // Create Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createPrivacy, setCreatePrivacy] = useState<'public' | 'private'>('public');
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Action Loading
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  const fetchCommunities = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (activeTab === 'my') {
        const res = await api.communities.my(page, 20);
        setCommunities(res.communities);
        setTotal(res.total);
      } else {
        const pFilter = privacyFilter === 'all' ? undefined : privacyFilter;
        const res = await api.communities.list(searchQuery, pFilter, page, 20);
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
      });

      setShowCreateModal(false);
      setCreateName('');
      setCreateDescription('');
      setCreatePrivacy('public');
      navigate(`/mobile/communities/${newComm.id}`);
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create community.');
    } finally {
      setCreateSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 px-4 py-3 pb-24">
      {/* Header with Title & Create Button */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <h1 className="text-xl font-black text-white flex items-center gap-2">
            <Users size={22} className="text-amber" />
            <span>Communities</span>
          </h1>
          <p className="text-[11px] text-night-400">Join circles and social groups</p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1 rounded-xl bg-amber px-3 py-1.5 text-xs font-bold text-night-950 shadow-md active:scale-95 transition-all"
        >
          <Plus size={15} />
          <span>New</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center rounded-xl border border-line-soft bg-night-900/80 p-1">
        <button
          onClick={() => {
            setActiveTab('discover');
            setPage(1);
          }}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold transition-all ${
            activeTab === 'discover'
              ? 'bg-amber text-night-950 shadow-sm'
              : 'text-night-400 hover:text-white'
          }`}
        >
          <Globe size={13} />
          <span>Discover</span>
        </button>
        <button
          onClick={() => {
            setActiveTab('my');
            setPage(1);
          }}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold transition-all ${
            activeTab === 'my'
              ? 'bg-amber text-night-950 shadow-sm'
              : 'text-night-400 hover:text-white'
          }`}
        >
          <Users size={13} />
          <span>My Groups</span>
        </button>
      </div>

      {/* Search & Filter (Discover tab only) */}
      {activeTab === 'discover' && (
        <div className="space-y-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-night-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search groups..."
              className="w-full rounded-xl border border-line-soft bg-night-900/90 pl-8 pr-3 py-2 text-xs text-white placeholder-night-500 focus:border-amber focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1.5 text-[11px]">
            <button
              onClick={() => {
                setPrivacyFilter('all');
                setPage(1);
              }}
              className={`rounded-lg px-2.5 py-1 font-semibold transition-colors ${
                privacyFilter === 'all' ? 'bg-amber/20 text-amber border border-amber/30' : 'bg-night-900 text-night-400'
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
                privacyFilter === 'public' ? 'bg-amber/20 text-amber border border-amber/30' : 'bg-night-900 text-night-400'
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
                privacyFilter === 'private' ? 'bg-amber/20 text-amber border border-amber/30' : 'bg-night-900 text-night-400'
              }`}
            >
              Private
            </button>
          </div>
        </div>
      )}

      {/* Communities List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-night-900/60 border border-line-soft animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center text-xs text-red-300">
          <AlertCircle size={24} className="mx-auto mb-2 text-red-400" />
          <p>{error}</p>
        </div>
      ) : communities.length === 0 ? (
        <div className="rounded-2xl border border-line-soft bg-night-900/40 p-8 text-center">
          <Users size={32} className="mx-auto mb-2 text-night-500" />
          <p className="text-xs font-bold text-white">
            {activeTab === 'my' ? 'No communities joined yet' : 'No communities found'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {communities.map((comm) => (
            <div
              key={comm.id}
              onClick={() => navigate(`/mobile/communities/${comm.id}`)}
              className="rounded-2xl border border-line-soft bg-night-900/80 p-4 active:scale-[0.99] transition-all shadow-md"
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-11 w-11 shrink-0 rounded-2xl border border-amber/30 bg-night-800 text-amber font-bold text-base flex items-center justify-center overflow-hidden">
                    {comm.avatar ? (
                      <img src={comm.avatar} alt={comm.name} className="h-full w-full object-cover" />
                    ) : (
                      comm.name.slice(0, 2).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-white truncate">{comm.name}</h3>
                    <span className="text-[10px] font-mono text-night-400 block truncate">@{comm.slug}</span>
                  </div>
                </div>

                {/* Privacy Badge */}
                {comm.privacy === 'private' ? (
                  <span className="flex items-center gap-1 rounded-full border border-amber/30 bg-amber/10 px-2 py-0.5 text-[9px] font-bold text-amber shrink-0">
                    <Lock size={9} />
                    Private
                  </span>
                ) : (
                  <span className="flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold text-emerald-400 shrink-0">
                    <Globe size={9} />
                    Public
                  </span>
                )}
              </div>

              {comm.description && (
                <p className="text-xs text-night-300 line-clamp-2 mb-3">
                  {comm.description}
                </p>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-line-soft/40 text-[11px]">
                <span className="text-night-400 font-medium">
                  <strong className="text-white">{comm.memberCount}</strong> members • <strong className="text-white">{comm.postCount}</strong> posts
                </span>

                {comm.isMember ? (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400">
                    <Check size={12} />
                    {comm.userRole ? comm.userRole.toUpperCase() : 'JOINED'}
                  </span>
                ) : comm.membershipStatus === 'pending' ? (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-amber">
                    <Clock size={12} />
                    PENDING
                  </span>
                ) : (
                  <button
                    onClick={(e) => handleJoin(e, comm)}
                    disabled={actionLoading[comm.id]}
                    className="flex items-center gap-1 rounded-lg bg-amber/20 border border-amber/30 px-2.5 py-1 text-[10px] font-bold text-amber active:scale-95"
                  >
                    <span>{comm.privacy === 'private' ? 'Request' : 'Join'}</span>
                    <ArrowRight size={10} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CREATE MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-night-950/80 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-sm rounded-3xl border border-line-soft bg-night-900 p-5 shadow-2xl">
            <button
              onClick={() => setShowCreateModal(false)}
              className="absolute right-4 top-4 text-night-400 hover:text-white"
            >
              <X size={18} />
            </button>

            <h2 className="text-base font-bold text-white mb-3">Create Community</h2>

            {createError && (
              <p className="text-xs text-red-400 mb-3">{createError}</p>
            )}

            <form onSubmit={handleCreateCommunity} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-night-300 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  required
                  maxLength={100}
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="Group Name"
                  className="w-full rounded-xl border border-line-soft bg-night-800 px-3 py-2 text-xs text-white focus:border-amber focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-night-300 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  maxLength={1000}
                  value={createDescription}
                  onChange={(e) => setCreateDescription(e.target.value)}
                  placeholder="About this group..."
                  className="w-full rounded-xl border border-line-soft bg-night-800 p-2.5 text-xs text-white focus:border-amber focus:outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-night-300 mb-1">
                  Privacy
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCreatePrivacy('public')}
                    className={`rounded-xl border p-2 text-left text-xs ${
                      createPrivacy === 'public'
                        ? 'border-amber bg-amber/10 text-white font-bold'
                        : 'border-line-soft bg-night-800 text-night-400'
                    }`}
                  >
                    Public (Open)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreatePrivacy('private')}
                    className={`rounded-xl border p-2 text-left text-xs ${
                      createPrivacy === 'private'
                        ? 'border-amber bg-amber/10 text-white font-bold'
                        : 'border-line-soft bg-night-800 text-night-400'
                    }`}
                  >
                    Private (Approval)
                  </button>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl px-3 py-1.5 text-xs text-night-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createSubmitting}
                  className="rounded-xl bg-amber px-4 py-1.5 text-xs font-bold text-night-950 disabled:opacity-50"
                >
                  {createSubmitting ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
