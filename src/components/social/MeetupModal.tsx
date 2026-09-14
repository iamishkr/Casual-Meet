import React, { useState, useEffect } from 'react';
import { Modal, Button } from '../ui';
import { api } from '../../lib/api';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import type { SafeZoneDTO } from '../../lib/types';
import {
  Shield,
  Clock,
  MapPin,
  ShieldCheck,
  AlertTriangle,
  Loader2,
  ChevronRight,
  Info,
} from 'lucide-react';

interface MeetupModalProps {
  open: boolean;
  onClose: () => void;
  targetUser: {
    id: string;
    name: string;
    username: string;
    avatarHue?: number;
    isVerified?: boolean;
  };
  onStarted?: () => void;
}

const DURATION_PRESETS = [
  { mins: 30, label: '30 min', desc: 'Quick coffee' },
  { mins: 45, label: '45 min', desc: 'Casual meet' },
  { mins: 60, label: '1 hour', desc: 'Lunch / Walk' },
  { mins: 90, label: '1.5 hrs', desc: 'Dinner / Event' },
  { mins: 120, label: '2 hours', desc: 'Extended meetup' },
];

export default function MeetupModal({
  open,
  onClose,
  targetUser,
  onStarted,
}: MeetupModalProps) {
  const { startTimer, activeTimer } = useData();
  const { toast } = useToast();

  const [safeZones, setSafeZones] = useState<SafeZoneDTO[]>([]);
  const [selectedSafeZoneId, setSelectedSafeZoneId] = useState<string>('');
  const [customLocation, setCustomLocation] = useState<string>('');
  const [useSafeZone, setUseSafeZone] = useState<boolean>(true);
  const [durationMinutes, setDurationMinutes] = useState<number>(60);
  const [loadingSafeZones, setLoadingSafeZones] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (open) {
      setLoadingSafeZones(true);
      api.safeZones
        .list()
        .then((zones) => {
          setSafeZones(zones || []);
          if (zones && zones.length > 0) {
            setSelectedSafeZoneId(zones[0].id);
          }
        })
        .catch(() => {
          setUseSafeZone(false);
        })
        .finally(() => {
          setLoadingSafeZones(false);
        });
    }
  }, [open]);

  const handleStartMeetupTimer = async () => {
    let resolvedLocationName = '';
    let selectedZoneCoordinates: [number, number] | undefined = undefined;

    if (useSafeZone && selectedSafeZoneId) {
      const zone = safeZones.find((z) => z.id === selectedSafeZoneId);
      if (zone) {
        resolvedLocationName = `${zone.name} (${zone.area}) [Safe Zone]`;
        if (zone.venueCoordinates || (zone as any).location?.coordinates) {
          selectedZoneCoordinates = zone.venueCoordinates || (zone as any).location?.coordinates;
        }
      }
    } else {
      resolvedLocationName = customLocation.trim();
    }

    if (!resolvedLocationName) {
      toast('warn', 'Location Required', 'Please select a verified Safe Zone or enter a public location.');
      return;
    }

    if (activeTimer) {
      toast('err', 'Timer Active', 'You already have an active meeting timer running.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await startTimer({
        durationMinutes,
        locationName: resolvedLocationName,
        meetWithUserId: targetUser.id,
      });

      if (!res.ok) {
        throw new Error(res.error || 'Failed to start meeting safety timer.');
      }

      toast(
        'ok',
        'Safety Timer Armed',
        `Meeting safety timer set for ${durationMinutes} mins with ${targetUser.name}.`
      );
      onClose();
      if (onStarted) onStarted();
    } catch (err: any) {
      toast('err', 'Meetup Error', err?.message || 'Could not initiate safety timer.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Meet Safely"
      description="Prepare and arm server-side safety protection for your in-person meetup."
    >
      <div className="space-y-4 pt-1">
        {/* Partner Card */}
        <div className="flex items-center gap-3 rounded-2xl border border-line-soft bg-night-850 p-3.5 shadow-sm">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl font-display text-sm font-black text-night-950 shadow-md"
            style={{
              background: `linear-gradient(135deg, hsl(${targetUser.avatarHue ?? 210} 85% 68%), hsl(${((targetUser.avatarHue ?? 210) + 42) % 360} 80% 55%))`,
            }}
          >
            {targetUser.name?.slice(0, 2).toUpperCase()}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="font-display text-sm font-bold text-ink truncate">
                {targetUser.name}
              </h3>
              {targetUser.isVerified && (
                <span className="inline-flex items-center gap-0.5 rounded bg-safe/15 px-1.5 py-0.5 font-mono text-[9px] font-bold text-safe uppercase">
                  <Shield size={10} /> Verified
                </span>
              )}
            </div>
            <p className="font-mono text-[11px] text-dim truncate">@{targetUser.username}</p>
          </div>

          <span className="rounded-xl border border-safe/30 bg-safe/10 px-2.5 py-1 font-mono text-[10px] font-bold text-safe shrink-0">
            Connected
          </span>
        </div>

        {/* Step 1: Meetup Location */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="font-display text-xs font-bold text-ink flex items-center gap-1.5">
              <MapPin size={13} className="text-amber" />
              1. Meetup Location
            </label>
            <div className="flex items-center gap-1 text-[11px]">
              <button
                type="button"
                onClick={() => setUseSafeZone(true)}
                className={`px-2 py-0.5 rounded-lg font-mono text-[10px] transition-colors ${
                  useSafeZone ? 'bg-amber/15 text-amber font-bold border border-amber/30' : 'text-mute hover:text-ink'
                }`}
              >
                Safe Zones
              </button>
              <button
                type="button"
                onClick={() => setUseSafeZone(false)}
                className={`px-2 py-0.5 rounded-lg font-mono text-[10px] transition-colors ${
                  !useSafeZone ? 'bg-amber/15 text-amber font-bold border border-amber/30' : 'text-mute hover:text-ink'
                }`}
              >
                Public Venue
              </button>
            </div>
          </div>

          {useSafeZone ? (
            <div className="space-y-1.5">
              {loadingSafeZones ? (
                <div className="flex items-center justify-center p-4 text-xs text-mute">
                  <Loader2 size={16} className="animate-spin text-amber mr-2" />
                  Loading verified Safe Zones...
                </div>
              ) : safeZones.length > 0 ? (
                <select
                  value={selectedSafeZoneId}
                  onChange={(e) => setSelectedSafeZoneId(e.target.value)}
                  className="w-full rounded-xl border border-line-soft bg-night-900 px-3 py-2.5 text-xs text-ink focus:border-amber focus:outline-none transition-colors"
                >
                  {safeZones.map((z) => (
                    <option key={z.id} value={z.id}>
                      🛡️ {z.name} — {z.area} ({z.category})
                    </option>
                  ))}
                </select>
              ) : (
                <div className="text-xs text-mute italic p-2 bg-night-900 rounded-xl border border-line-soft">
                  No Safe Zones found nearby. Please enter a public venue below.
                </div>
              )}
            </div>
          ) : (
            <input
              type="text"
              placeholder="e.g. Starbucks, Indiranagar 100ft Rd"
              value={customLocation}
              onChange={(e) => setCustomLocation(e.target.value)}
              className="w-full rounded-xl border border-line-soft bg-night-900 px-3 py-2.5 text-xs text-ink placeholder:text-dim focus:border-amber focus:outline-none transition-colors"
            />
          )}
        </div>

        {/* Step 2: Safety Check-in Timer */}
        <div className="space-y-2">
          <label className="font-display text-xs font-bold text-ink flex items-center gap-1.5">
            <Clock size={13} className="text-amber" />
            2. Safety Check-In Duration
          </label>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
            {DURATION_PRESETS.map((p) => {
              const isSelected = durationMinutes === p.mins;
              return (
                <button
                  key={p.mins}
                  type="button"
                  onClick={() => setDurationMinutes(p.mins)}
                  className={`rounded-xl p-2 text-center transition-all border ${
                    isSelected
                      ? 'border-amber bg-amber/15 text-amber shadow-sm'
                      : 'border-line-soft bg-night-900 text-mute hover:border-line hover:text-ink'
                  }`}
                >
                  <p className="font-display text-xs font-bold">{p.label}</p>
                  <p className="text-[9px] text-dim mt-0.5 truncate">{p.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Step 3: Safety Reassurance Banner */}
        <div className="rounded-2xl border border-line-soft bg-night-900/90 p-3.5 text-xs text-mute space-y-2">
          <div className="flex items-start gap-2.5">
            <ShieldCheck size={16} className="text-safe shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-ink">Authoritative Server-Side Monitoring</p>
              <p className="text-[11px] text-dim leading-relaxed">
                CasualMeet monitors this timer server-side. If you do not mark yourself safe before
                the timer expires, your trusted emergency contacts are escalated automatically.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1.5 border-t border-line-soft/60 text-[10px] text-dim font-mono">
            <Info size={11} className="text-amber shrink-0" />
            <span>Emergency contact identities and phone numbers are never shared with meetup partners.</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-line-soft">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleStartMeetupTimer}
            disabled={submitting}
            leftIcon={submitting ? <Loader2 size={14} className="animate-spin" /> : <Shield size={14} />}
          >
            {submitting ? 'Arming Safety Timer...' : 'Start Safety Timer & Meet Safely'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
