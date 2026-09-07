import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { api } from '../../../lib/api';
import type { DiscoverItem } from '../../../lib/types';
import {
  Compass,
  Shield,
  UserPlus,
  Clock,
  Check,
  Search,
  RefreshCw,
} from 'lucide-react';
import { Button, SkeletonCard, EmptyState, ErrorState } from '../../../components/ui';

export default function WebDiscoverPage() {
  const { currentUser } = useAuth();
  const { toast } = useToast();

  const [cards, setCards] = useState<DiscoverItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'verified' | 'near' | 'coffee'>('all');

  const loadDiscovery = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.discover(20);
      setCards(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load nearby people');
      setCards([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDiscovery();
  }, [currentUser, loadDiscovery]);

  const handleConnect = async (targetId: string, name: string) => {
    setConnectingId(targetId);
    try {
      await api.connections.request(targetId);
      toast('ok', `Connection Request Sent`, `Sent to ${name}.`);
      loadDiscovery();
    } catch (err: any) {
      toast('err', 'Connection Error', err?.message || 'Failed to send request');
    } finally {
      setConnectingId(null);
    }
  };

  // Filter people
  const filtered = cards.filter((item) => {
    const p = item.user;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchName = p.name.toLowerCase().includes(q);
      const matchBio = p.bio?.toLowerCase().includes(q);
      const matchInterests = p.interests?.some((i: string) => i.toLowerCase().includes(q));
      if (!matchName && !matchBio && !matchInterests) return false;
    }

    if (filterMode === 'verified' && !p.isVerified) return false;
    if (filterMode === 'near' && item.distanceKm > 5) return false;
    if (filterMode === 'coffee' && !p.interests?.some((i: string) => i.toLowerCase().includes('coffee'))) return false;

    return true;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line-soft/60 pb-5">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink flex items-center gap-2.5">
            <Compass size={24} className="text-amber" />
            Discover Nearby Verified People
          </h1>
          <p className="text-xs text-mute mt-1">
            Authoritative geospatial discovery calculated server-side using MongoDB $geoNear.
            Raw GPS coordinates are strictly redacted for member safety.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadDiscovery}
            leftIcon={<RefreshCw size={13} className={loading ? 'animate-spin' : ''} />}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-mute" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter by name, occupation, interests..."
            className="w-full rounded-xl border border-line bg-night-850 py-2 pl-9 pr-4 text-xs text-ink placeholder:text-dim outline-none focus:border-amber/50"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: 'all', label: 'All Nearby' },
            { id: 'verified', label: 'Verified ID' },
            { id: 'near', label: 'Under 5 km' },
            { id: 'coffee', label: 'Coffee Lovers' },
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilterMode(f.id as any)}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-all ${
                filterMode === f.id
                  ? 'border border-amber/40 bg-amber/15 text-amber font-bold shadow-sm'
                  : 'border border-line bg-night-850 text-mute hover:text-ink'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid View */}
      {loading ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={loadDiscovery} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Compass size={28} className="text-amber" />}
          title="No People Found"
          description="Try broadening your search query or filter settings."
          actionLabel="Clear Filters"
          onAction={() => {
            setSearchQuery('');
            setFilterMode('all');
          }}
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => {
            const person = item.user;
            const connStatus = item.conn?.status;
            const isConnecting = connectingId === person.id;

            return (
              <div
                key={person.id}
                className="group relative flex flex-col justify-between rounded-2xl border border-line-soft bg-night-850/80 p-5 shadow-sm backdrop-blur-sm transition-all hover:border-amber/40 hover:bg-night-800/90 hover:shadow-md"
              >
                <div>
                  {/* Top user row */}
                  <div className="flex items-start justify-between gap-3 mb-3.5">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl font-display text-sm font-bold text-night-950 shadow-md"
                        style={{
                          background: `linear-gradient(135deg, hsl(${person.avatarHue} 85% 68%), hsl(${(person.avatarHue + 42) % 360} 80% 55%))`,
                        }}
                      >
                        {person.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="truncate">
                        <h3 className="font-display text-sm font-bold text-ink truncate flex items-center gap-1.5">
                          {person.name}
                          {person.isVerified && (
                            <span
                              className="text-sky"
                              title="Verified Government ID"
                            >
                              <Shield size={13} strokeWidth={2.5} />
                            </span>
                          )}
                        </h3>
                        <p className="font-mono text-[10px] text-dim truncate">
                          @{person.username}
                        </p>
                      </div>
                    </div>

                    {/* Server distance pill */}
                    <span className="shrink-0 rounded-lg border border-amber/30 bg-amber/10 px-2 py-0.5 font-mono text-[10px] font-bold text-amber">
                      {item.distanceKm.toFixed(1)} km
                    </span>
                  </div>

                  {/* Occupation & Bio */}
                  {person.occupation && (
                    <p className="text-xs font-semibold text-ink/90 mb-1">
                      {person.occupation}
                    </p>
                  )}
                  <p className="text-xs text-mute line-clamp-3 leading-relaxed">
                    {person.bio || 'New to CasualMeet. Up for coffee meetups at verified Safe Zones.'}
                  </p>

                  {/* Interests tags */}
                  {person.interests && person.interests.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3">
                      {person.interests.map((tag: string) => (
                        <span
                          key={tag}
                          className="rounded-md border border-line bg-night-900/80 px-2 py-0.5 font-mono text-[9px] text-mute"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Privacy Redaction Tag */}
                  <div className="mt-3 flex items-center justify-between font-mono text-[9px] text-dim border-t border-line-soft/40 pt-2.5">
                    <span>Trust: {person.trustScore} pts</span>
                    <span>GPS: {item.coordinatesRedacted}</span>
                  </div>
                </div>

                {/* Bottom Action Area */}
                <div className="mt-4 pt-3 border-t border-line-soft/60">
                  {connStatus === 'accepted' ? (
                    <Button
                      variant="safe"
                      size="sm"
                      className="w-full"
                      leftIcon={<Check size={14} />}
                      disabled
                    >
                      Connected
                    </Button>
                  ) : connStatus === 'pending' ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-dim"
                      leftIcon={<Clock size={14} />}
                      disabled
                    >
                      Request Pending
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      size="sm"
                      className="w-full"
                      isLoading={isConnecting}
                      onClick={() => handleConnect(person.id, person.name)}
                      leftIcon={<UserPlus size={14} />}
                    >
                      Connect
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
