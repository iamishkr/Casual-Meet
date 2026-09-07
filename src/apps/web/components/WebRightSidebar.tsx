import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { useData } from '../../../context/DataContext';
import { api } from '../../../lib/api';
import {
  Shield,
  ShieldAlert,
  MapPin,
  Users,
  PhoneCall,
  Clock,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { fmtCountdown } from '../../../lib/utils';
import type { EmergencyContactDTO, SafeZoneDTO } from '../../../lib/types';
import { Button } from '../../../components/ui';

export default function WebRightSidebar() {
  const { currentUser } = useAuth();
  const { activeSos, activeTimer, markTimerSafe, triggerSos } = useData();
  const [contacts, setContacts] = useState<EmergencyContactDTO[]>([]);
  const [safeZones, setSafeZones] = useState<SafeZoneDTO[]>([]);
  const [clock, setClock] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (currentUser) {
      api.contacts.list().then(setContacts).catch(() => {});
      api.safeZones.list().then(setSafeZones).catch(() => {});
    }
  }, [currentUser]);

  const timerRemain = activeTimer
    ? Math.max(0, new Date(activeTimer.expiresAt).getTime() - clock)
    : 0;

  return (
    <aside className="hidden xl:flex sticky top-0 h-screen w-80 flex-col gap-5 border-l border-line-soft bg-night-900/60 p-5 backdrop-blur-xl overflow-y-auto shrink-0">
      {/* 1. Real-Time Safety Widget */}
      <div
        className={`rounded-2xl border p-4 shadow-lg backdrop-blur-md transition-all ${
          activeSos
            ? 'border-sos/50 bg-sos/10'
            : activeTimer
            ? 'border-amber/40 bg-amber/10'
            : 'border-line-soft bg-night-850/80'
        }`}
      >
        <div className="flex items-center justify-between pb-3 border-b border-line-soft/50">
          <div className="flex items-center gap-2">
            {activeSos ? (
              <ShieldAlert size={18} className="text-sos animate-pulse" />
            ) : (
              <Shield size={18} className="text-amber" />
            )}
            <h4 className="font-display text-xs font-bold text-ink uppercase tracking-wider">
              Safety Center Live
            </h4>
          </div>
          <Link
            to="/app/safety"
            className="text-[11px] font-semibold text-amber hover:underline flex items-center gap-1"
          >
            Manage <ArrowRight size={12} />
          </Link>
        </div>

        {activeSos ? (
          <div className="mt-3 space-y-2">
            <p className="font-mono text-xs font-bold text-sos">
              EMERGENCY SOS IS ACTIVE
            </p>
            <p className="text-[11px] text-mute">
              Incident ID: <span className="font-mono text-ink">{activeSos._id}</span>
            </p>
            <Link to="/app/safety">
              <Button variant="danger" size="sm" className="w-full mt-2">
                Open Emergency Response
              </Button>
            </Link>
          </div>
        ) : activeTimer ? (
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-mute">Meeting Countdown:</span>
              <span className="font-mono text-sm font-bold text-amber">
                {fmtCountdown(timerRemain)}
              </span>
            </div>
            {activeTimer.locationName && (
              <p className="text-[11px] text-mute flex items-center gap-1">
                <MapPin size={12} className="text-amber" />
                <span className="truncate">{activeTimer.locationName}</span>
              </p>
            )}
            <Button
              variant="safe"
              size="sm"
              className="w-full mt-2"
              onClick={() => markTimerSafe(activeTimer._id)}
            >
              I Am Safe Now
            </Button>
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            <p className="text-[11px] text-mute leading-relaxed">
              No active meetup timer. Start a check-in timer when meeting someone new.
            </p>
            <div className="flex gap-2 pt-1">
              <Link to="/app/safety" className="flex-1">
                <Button variant="outline" size="sm" className="w-full text-[11px]">
                  <Clock size={12} className="mr-1 text-amber" /> Start Timer
                </Button>
              </Link>
              <Button
                variant="danger"
                size="sm"
                className="text-[11px]"
                onClick={() => triggerSos({ locationName: 'Current Location', source: 'manual' })}
              >
                SOS
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* 2. Emergency Contacts Summary */}
      <div className="rounded-2xl border border-line-soft bg-night-850/80 p-4 shadow-md backdrop-blur-md">
        <div className="flex items-center justify-between pb-2 border-b border-line-soft/50">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-amber" />
            <h4 className="font-display text-xs font-bold text-ink">Emergency Contacts</h4>
          </div>
          <span className="font-mono text-[10px] text-dim">{contacts.length} saved</span>
        </div>

        <div className="mt-3 space-y-2">
          {contacts.length === 0 ? (
            <p className="text-xs text-mute py-2 text-center">
              No emergency contacts added yet.
            </p>
          ) : (
            contacts.slice(0, 3).map((c) => (
              <div
                key={c._id}
                className="flex items-center justify-between rounded-xl bg-night-900/60 p-2 border border-line-soft/40 text-xs"
              >
                <div className="truncate">
                  <p className="font-semibold text-ink truncate">{c.name}</p>
                  <p className="font-mono text-[10px] text-dim">{c.relationship}</p>
                </div>
                <a
                  href={`tel:${c.phone}`}
                  className="rounded-lg p-1.5 text-mute hover:bg-night-800 hover:text-amber transition-colors"
                  title="Call Contact"
                >
                  <PhoneCall size={14} />
                </a>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 3. Verified Community Safe Zones */}
      <div className="rounded-2xl border border-line-soft bg-night-850/80 p-4 shadow-md backdrop-blur-md flex-1">
        <div className="flex items-center justify-between pb-2 border-b border-line-soft/50">
          <div className="flex items-center gap-2">
            <MapPin size={16} className="text-safe" />
            <h4 className="font-display text-xs font-bold text-ink">Nearby Safe Zones</h4>
          </div>
          <span className="rounded bg-safe/10 px-1.5 py-0.5 font-mono text-[9px] font-bold text-safe uppercase">
            Verified
          </span>
        </div>

        <div className="mt-3 space-y-2">
          {safeZones.slice(0, 4).map((z) => (
            <div
              key={z.id}
              className="rounded-xl bg-night-900/60 p-2.5 border border-line-soft/40 text-xs"
            >
              <div className="flex items-center justify-between">
                <p className="font-semibold text-ink truncate">{z.name}</p>
                <span className="font-mono text-[9px] text-dim uppercase">{z.category}</span>
              </div>
              <p className="text-[11px] text-mute mt-0.5 truncate">{z.area}</p>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
