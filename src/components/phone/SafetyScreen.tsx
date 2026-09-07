import { useEffect, useRef, useState, useCallback } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import type { SafeZoneDTO, MeetingTimerDTO } from '../../lib/types';
import { fmtCountdown } from '../../lib/utils';
import { Avatar, Badge, Btn, Empty, I, Ring, Seg, Toggle, inputCls } from '../ui';

const STATUS_TONE: Record<string, string> = {
  active: 'warn',
  extended: 'info',
  safe: 'ok',
  expired: 'err',
  cancelled: 'dim',
};

export default function SafetyScreen({
  mode,
  setMode,
}: {
  mode: 'timer' | 'sos';
  setMode: (m: 'timer' | 'sos') => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 pt-3">
        <Seg
          value={mode}
          onChange={setMode}
          options={[
            {
              value: 'timer',
              label: (
                <span className="flex items-center gap-1.5">
                  <I.timer size={13} /> Meet timer
                </span>
              ),
            },
            {
              value: 'sos',
              label: (
                <span className="flex items-center gap-1.5">
                  <I.sos size={13} /> SOS
                </span>
              ),
            },
          ]}
        />
        <span className="chip">
          <I.shield size={10} className="text-safe" /> Server Worker Protected
        </span>
      </div>
      <div className="mt-3 flex-1 overflow-y-auto px-4 pb-4">
        {mode === 'timer' ? <TimerPane goSos={() => setMode('sos')} /> : <SosPane />}
      </div>
    </div>
  );
}

/* ================= AUTHORITATIVE MEETING TIMER ================= */

function TimerPane({ goSos }: { goSos: () => void }) {
  const { currentUser } = useAuth();
  const { activeTimer, activeSos, startTimer, extendTimer, markTimerSafe, cancelTimer, refreshSafetyState } = useData();
  const { toast } = useToast();

  const [duration, setDuration] = useState(60);
  const [locName, setLocName] = useState('');
  const [withUser, setWithUser] = useState('');
  const [includeLoc, setIncludeLoc] = useState(true);
  const [safeZones, setSafeZones] = useState<SafeZoneDTO[]>([]);
  const [connections, setConnections] = useState<any[]>([]);
  const [pastTimers, setPastTimers] = useState<MeetingTimerDTO[]>([]);
  const [visualClock, setVisualClock] = useState(() => Date.now());

  // Visual countdown timer clock tick (Display ONLY, never triggers SOS escalation)
  useEffect(() => {
    const t = setInterval(() => setVisualClock(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Fetch verified safe zones from backend consumer API
  useEffect(() => {
    api.safeZones.list()
      .then((zones) => setSafeZones(Array.isArray(zones) ? zones : []))
      .catch(() => {});

    api.connections.list()
      .then((conns) => {
        if (Array.isArray(conns)) {
          const accepted = conns
            .filter((c) => c.status === 'accepted')
            .map((c) => (c.requesterId?._id === currentUser?.id ? c.receiverId : c.requesterId))
            .filter(Boolean);
          setConnections(accepted);
        }
      })
      .catch(() => {});

    api.timers.list()
      .then((list) => {
        if (Array.isArray(list)) {
          setPastTimers(list.filter((t) => !['active', 'extended'].includes(t.status)));
        }
      })
      .catch(() => {});
  }, [currentUser?.id]);

  const handleStartTimer = async () => {
    const res = await startTimer({
      durationMinutes: duration,
      locationName: locName.trim() || 'Public meetup',
      meetWithUserId: withUser || undefined,
    });
    if (res.ok) {
      setLocName('');
      setWithUser('');
    }
  };

  if (activeTimer) {
    const expiresAtMs = new Date(activeTimer.expiresAt).getTime();
    const startedAtMs = new Date(activeTimer.startedAt).getTime();
    const totalMs = Math.max(1000, expiresAtMs - startedAtMs);
    const remainMs = Math.max(0, expiresAtMs - visualClock);
    const isLow = remainMs <= 5 * 60 * 1000;
    const isExpired = activeTimer.status === 'expired' || remainMs === 0;

    return (
      <div className="space-y-3">
        <div
          className={`rounded-2xl border p-4 text-center ${
            isExpired
              ? 'border-sos/50 bg-sos/10'
              : isLow
              ? 'border-amber/50 bg-amber/5'
              : 'border-line-soft bg-night-800/60'
          }`}
        >
          <div className="mb-2 flex items-center justify-between">
            <Badge tone={STATUS_TONE[activeTimer.status] || 'warn'}>
              {activeTimer.status.toUpperCase()}
            </Badge>
            <span className="chip">
              <I.pin size={10} className="text-amber" /> {activeTimer.locationName}
            </span>
          </div>

          {isExpired ? (
            <div className="py-5">
              <p className="font-display text-xl font-extrabold text-sos">Timer Expired</p>
              <p className="mt-1 text-xs text-mute">
                No check-in received. Server worker escalation is active on backend.
              </p>
            </div>
          ) : (
            <div className="flex justify-center py-2">
              <Ring
                progress={totalMs > 0 ? remainMs / totalMs : 0}
                size={172}
                stroke={10}
                color={isLow ? '#ffb224' : '#3ecf8e'}
              >
                <span className="tick-num font-display text-[34px] font-extrabold tracking-tight">
                  {fmtCountdown(remainMs)}
                </span>
                <span className="font-mono text-[9px] uppercase tracking-widest text-dim">
                  until check-in due
                </span>
                {isLow && <span className="mt-1 chip text-amber pulse-dot">T-5m window</span>}
              </Ring>
            </div>
          )}

          {activeTimer.meetWithUserId && (
            <div className="mt-1 flex items-center justify-center gap-2 text-xs text-mute">
              <span>Meeting with registered connection</span>
            </div>
          )}

          {activeSos && (
            <Btn tone="danger" className="mt-3 w-full" onClick={goSos}>
              <I.sos size={15} /> View Active SOS Emergency
            </Btn>
          )}
        </div>

        {!isExpired && (
          <div className="grid grid-cols-2 gap-2">
            <Btn
              tone="safe"
              size="lg"
              className="col-span-2"
              onClick={() => markTimerSafe(activeTimer._id)}
            >
              <I.check size={16} /> I’m safe — check in
            </Btn>
            <Btn tone="outline" onClick={() => extendTimer(activeTimer._id, 15)}>
              +15 min
            </Btn>
            <Btn tone="outline" onClick={() => extendTimer(activeTimer._id, 30)}>
              +30 min
            </Btn>
            <Btn
              tone="ghost"
              className="col-span-2 text-sos hover:text-sos"
              onClick={() => cancelTimer(activeTimer._id)}
            >
              Cancel timer (stand down)
            </Btn>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-line-soft bg-night-800/60 p-3.5">
        <div className="mb-1 flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-dim">
          <span>Timer duration</span>
          <span className="text-amber">
            {duration >= 60
              ? `${Math.floor(duration / 60)}h${duration % 60 ? ` ${duration % 60}m` : ''}`
              : `${duration}m`}
          </span>
        </div>
        <input
          type="range"
          min={15}
          max={480}
          step={15}
          value={duration}
          onChange={(e) => setDuration(+e.target.value)}
          className="w-full accent-[#ffb224]"
        />
        <div className="mt-0.5 flex justify-between font-mono text-[9px] text-dim">
          <span>15m</span>
          <span>480m</span>
        </div>

        <div className="mt-3 space-y-2.5">
          <input
            value={locName}
            onChange={(e) => setLocName(e.target.value)}
            placeholder="Location name (e.g. Blue Tokai Coffee, Koramangala)"
            className={inputCls}
          />
          <select
            value={withUser}
            onChange={(e) => setWithUser(e.target.value)}
            className={inputCls}
          >
            <option value="">Meeting someone? (optional)</option>
            {connections.map((u: any) => (
              <option key={u._id || u.id} value={u._id || u.id}>
                {u.name} (@{u.username})
              </option>
            ))}
          </select>
          <div className="flex items-center justify-between rounded-lg border border-line-soft bg-night-900/60 px-3 py-2">
            <span className="flex items-center gap-2 text-xs font-semibold text-mute">
              <I.pin size={13} className="text-amber" /> Attach GPS coordinates
            </span>
            <Toggle on={includeLoc} onChange={setIncludeLoc} />
          </div>
        </div>

        {safeZones.length > 0 && (
          <div className="mt-3">
            <p className="mb-1.5 font-mono text-[10px] uppercase tracking-widest text-dim">
              Meet near a Verified Safe Zone
            </p>
            <div className="flex flex-wrap gap-1.5">
              {safeZones.slice(0, 4).map((z) => (
                <button
                  key={z.id}
                  onClick={() => setLocName(z.name)}
                  className={`btn-press chip ${
                    locName === z.name
                      ? 'border-safe/60 text-safe'
                      : 'hover:border-amber/50 hover:text-amber'
                  }`}
                >
                  <I.pin size={10} /> {z.name} ({z.area})
                </button>
              ))}
            </div>
          </div>
        )}

        <Btn tone="amber" size="lg" className="mt-4 w-full" onClick={handleStartTimer}>
          <I.timer size={16} /> Start meeting timer
        </Btn>
        <p className="mt-2 text-center text-[10px] leading-snug text-dim">
          Authoritative server timer. If the countdown reaches zero without a check-in, the
          server background worker automatically triggers SOS dispatch to your emergency contacts.
        </p>
      </div>

      {pastTimers.length > 0 && (
        <div>
          <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-dim">
            Recent timers
          </p>
          <div className="space-y-1.5">
            {pastTimers.slice(0, 4).map((t) => (
              <div
                key={t._id}
                className="flex items-center justify-between rounded-xl border border-line-soft bg-night-800/50 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold">{t.locationName}</p>
                  <p className="font-mono text-[10px] text-dim">{t.durationMinutes}m duration</p>
                </div>
                <Badge tone={STATUS_TONE[t.status] || 'dim'}>{t.status}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ================= AUTHORITATIVE SOS EMERGENCY ================= */

function SosPane() {
  const { activeSos, triggerSos, resolveSos } = useData();
  const [locName, setLocName] = useState('');
  const [includeLoc, setIncludeLoc] = useState(true);
  const [hold, setHold] = useState(0);
  const holdRef = useRef<number | null>(null);
  const firedRef = useRef(false);

  const startHold = () => {
    firedRef.current = false;
    const t0 = performance.now();
    const loop = () => {
      const p = Math.min(1, (performance.now() - t0) / 1200);
      setHold(p);
      if (p >= 1) {
        if (!firedRef.current) {
          firedRef.current = true;
          setHold(0);
          void triggerSos({
            locationName: locName.trim() || 'Current Location',
            includeLocation: includeLoc,
            source: 'manual',
          });
        }
        return;
      }
      holdRef.current = requestAnimationFrame(loop);
    };
    holdRef.current = requestAnimationFrame(loop);
  };

  const endHold = () => {
    if (holdRef.current) cancelAnimationFrame(holdRef.current);
    holdRef.current = null;
    if (!firedRef.current) setHold(0);
  };

  useEffect(() => () => {
    if (holdRef.current) cancelAnimationFrame(holdRef.current);
  }, []);

  return (
    <div className="space-y-3">
      {activeSos ? (
        <ActiveSos sos={activeSos} onResolve={(status) => resolveSos(activeSos._id, status)} />
      ) : (
        <div className="rounded-2xl border border-line-soft bg-night-800/60 p-4 text-center">
          <p className="font-display text-[15px] font-bold">One-tap emergency SOS</p>
          <p className="mx-auto mt-1 max-w-[260px] text-[11px] leading-snug text-mute">
            Hold the beacon for 1.2s. Alerts your emergency contacts via Fast2SMS (+91) and Twilio
            (international), and alerts the administrator console via real-time WebSocket.
          </p>
          <div className="relative mx-auto mt-4 h-44 w-44">
            <span
              className="absolute inset-0 rounded-full bg-sos/20"
              style={{ animation: 'ping-soft 1.8s cubic-bezier(0,0,0.2,1) infinite' }}
            />
            <span
              className="absolute inset-0 rounded-full bg-sos/10"
              style={{
                animation: 'ping-soft 1.8s cubic-bezier(0,0,0.2,1) infinite',
                animationDelay: '0.5s',
              }}
            />
            <button
              onPointerDown={startHold}
              onPointerUp={endHold}
              onPointerLeave={endHold}
              onContextMenu={(e) => e.preventDefault()}
              className="btn-press absolute inset-0 select-none rounded-full"
              style={{ touchAction: 'none' }}
              aria-label="Hold to trigger SOS"
            >
              <Ring progress={hold} size={176} stroke={10} color="#ff5d64">
                <span
                  className="flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-b from-sos to-[#d63d49] font-display text-2xl font-extrabold tracking-wide text-night-950 shadow-[0_10px_40px_-8px_rgba(255,93,100,0.8)]"
                  style={{ animation: hold > 0 ? undefined : 'breathe 2.6s ease-in-out infinite' }}
                >
                  SOS
                </span>
              </Ring>
            </button>
          </div>
          <p className="mt-3 font-mono text-[9px] uppercase tracking-widest text-dim">
            {hold > 0
              ? `arming… ${Math.round(hold * 100)}%`
              : 'hold to trigger · release to cancel'}
          </p>

          <div className="mt-4 space-y-2 text-left">
            <input
              value={locName}
              onChange={(e) => setLocName(e.target.value)}
              placeholder="Optional place name (e.g. Cubbon Park east gate)"
              className={inputCls}
            />
            <div className="flex items-center justify-between rounded-lg border border-line-soft bg-night-900/60 px-3 py-2">
              <span className="flex items-center gap-2 text-xs font-semibold text-mute">
                <I.pin size={13} className="text-sos" /> Include live GPS fix
              </span>
              <Toggle on={includeLoc} onChange={setIncludeLoc} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ActiveSos({
  sos,
  onResolve,
}: {
  sos: any;
  onResolve: (status: 'resolved' | 'false_alarm') => void;
}) {
  return (
    <div className="anim-rise rounded-2xl border border-sos/60 bg-sos/10 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span
              className="absolute h-full w-full rounded-full bg-sos"
              style={{ animation: 'ping-soft 1.4s infinite' }}
            />
            <span className="h-3 w-3 rounded-full bg-sos" />
          </span>
          <p className="font-display text-[15px] font-extrabold text-sos">SOS ACTIVE</p>
        </div>
        <Badge tone="err">{sos.status.toUpperCase()}</Badge>
      </div>

      <div className="mt-2 space-y-1.5 text-xs text-mute">
        <p className="flex items-center gap-2">
          <I.pin size={12} className="text-sos" /> Location: {sos.locationName || 'Attached GPS'}
        </p>
        <p className="flex items-center gap-2">
          <I.users size={12} className="text-sos" /> {sos.contactsNotified ?? 0} emergency
          contact(s) reached · admins notified
        </p>
        {sos.smsSent && (
          <p className="font-mono text-[10px] text-safe">
            ✓ Gateway dispatch confirmed via SMS service
          </p>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Btn tone="safe" onClick={() => onResolve('resolved')}>
          <I.check size={14} /> I’m safe
        </Btn>
        <Btn tone="outline" onClick={() => onResolve('false_alarm')}>
          False alarm
        </Btn>
      </div>
    </div>
  );
}
