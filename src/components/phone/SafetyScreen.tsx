import { useEffect, useRef, useState } from 'react';
import { engine, useEngine } from '../../lib/engine';
import type { GeoPoint } from '../../lib/types';
import { COORD_REDACTED, fmtCountdown, haversineKm } from '../../lib/utils';
import { Avatar, Badge, Btn, Empty, I, Ring, Seg, Toggle, inputCls } from '../ui';

const V_MIN = 60_000;
const STATUS_TONE: Record<string, string> = { active: 'warn', extended: 'info', safe: 'ok', expired: 'err', cancelled: 'dim' };

export default function SafetyScreen({ mode, setMode }: { mode: 'timer' | 'sos'; setMode: (m: 'timer' | 'sos') => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 pt-3">
        <Seg value={mode} onChange={setMode} options={[
          { value: 'timer', label: <span className="flex items-center gap-1.5"><I.timer size={13} /> Meet timer</span> },
          { value: 'sos', label: <span className="flex items-center gap-1.5"><I.sos size={13} /> SOS</span> },
        ]} />
        <span className="chip"><I.shield size={10} className="text-safe" /> safety engine</span>
      </div>
      <div className="mt-3 flex-1 overflow-y-auto px-4 pb-4">
        {mode === 'timer' ? <TimerPane goSos={() => setMode('sos')} /> : <SosPane />}
      </div>
    </div>
  );
}

/* ================= meeting timer ================= */

function TimerPane({ goSos }: { goSos: () => void }) {
  const state = useEngine();
  const me = state.personaId;
  const active = state.timers.find((t) => t.userId === me && (t.status === 'active' || t.status === 'extended' || t.status === 'expired'));
  const [duration, setDuration] = useState(60);
  const [locName, setLocName] = useState('');
  const [withUser, setWithUser] = useState('');
  const [includeLoc, setIncludeLoc] = useState(true);

  const myLoc = engine.loc(me)?.location;
  const connected = state.connections
    .filter((c) => c.status === 'accepted' && (c.requesterId === me || c.receiverId === me))
    .map((c) => (c.requesterId === me ? c.receiverId : c.requesterId))
    .map((id) => engine.user(id));
  const zones = [...state.safeZones]
    .map((z) => ({ z, km: myLoc ? haversineKm(myLoc, z.location) : 99 }))
    .sort((a, b) => a.km - b.km).slice(0, 3);

  if (active) {
    const total = active.durationMinutes * V_MIN;
    const remain = Math.max(0, active.expiresAtV - state.vnow);
    const low = remain <= 5 * V_MIN;
    const partner = active.meetWithUserId ? engine.user(active.meetWithUserId) : null;
    const sosEv = active.status === 'expired' ? state.sosEvents.find((s) => s.triggeredTimerId === active.id) : null;
    return (
      <div className="space-y-3">
        <div className={`rounded-2xl border p-4 text-center ${active.status === 'expired' ? 'border-sos/50 bg-sos/10' : low ? 'border-amber/50 bg-amber/5' : 'border-line-soft bg-night-800/60'}`}>
          <div className="mb-2 flex items-center justify-between">
            <Badge tone={STATUS_TONE[active.status]}>{active.status}</Badge>
            <span className="chip"><I.pin size={10} className="text-amber" /> {active.locationName}</span>
          </div>
          {active.status === 'expired' ? (
            <div className="py-5">
              <p className="font-display text-xl font-extrabold text-sos">Timer expired</p>
              <p className="mt-1 text-xs text-mute">No check-in received. SOS escalation {sosEv ? `dispatched (${sosEv.contactsNotified} contacts reached)` : 'in progress'}…</p>
            </div>
          ) : (
            <div className="flex justify-center py-2">
              <Ring progress={remain / total} size={172} stroke={10} color={low ? '#ffb224' : '#3ecf8e'}>
                <span className="tick-num font-display text-[34px] font-extrabold tracking-tight">{fmtCountdown(remain)}</span>
                <span className="font-mono text-[9px] uppercase tracking-widest text-dim">until check-in due</span>
                {low && <span className="mt-1 chip text-amber pulse-dot">T-5m reminder sent</span>}
              </Ring>
            </div>
          )}
          {partner && (
            <div className="mt-1 flex items-center justify-center gap-2 text-xs text-mute">
              <Avatar user={partner} size={22} /> meeting {partner.name}
            </div>
          )}
          {active.status === 'expired' && sosEv && sosEv.status === 'active' && (
            <Btn tone="danger" className="mt-3 w-full" onClick={goSos}><I.sos size={15} /> Manage active SOS</Btn>
          )}
        </div>

        {active.status !== 'expired' && (
          <div className="grid grid-cols-2 gap-2">
            <Btn tone="safe" size="lg" className="col-span-2" onClick={() => engine.markSafe(active.id)}><I.check size={16} /> I’m safe — check in</Btn>
            <Btn tone="outline" onClick={() => engine.extendTimer(active.id, 15)}>+15 min</Btn>
            <Btn tone="outline" onClick={() => engine.extendTimer(active.id, 30)}>+30 min</Btn>
            <Btn tone="ghost" className="col-span-2 text-sos hover:text-sos" onClick={() => engine.cancelTimer(active.id)}>Cancel timer (no escalation)</Btn>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-line-soft bg-night-800/60 p-3.5">
        <div className="mb-1 flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-dim">
          <span>Timer duration</span><span className="text-amber">{duration >= 60 ? `${Math.floor(duration / 60)}h${duration % 60 ? ` ${duration % 60}m` : ''}` : `${duration}m`}</span>
        </div>
        <input type="range" min={15} max={480} step={15} value={duration} onChange={(e) => setDuration(+e.target.value)} className="w-full accent-[#ffb224]" />
        <div className="mt-0.5 flex justify-between font-mono text-[9px] text-dim"><span>15m</span><span>480m</span></div>

        <div className="mt-3 space-y-2.5">
          <input value={locName} onChange={(e) => setLocName(e.target.value)} placeholder="Location name (e.g. Starbucks, 12th Main)" className={inputCls} />
          <select value={withUser} onChange={(e) => setWithUser(e.target.value)} className={inputCls}>
            <option value="">Meeting someone? (optional)</option>
            {connected.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <div className="flex items-center justify-between rounded-lg border border-line-soft bg-night-900/60 px-3 py-2">
            <span className="flex items-center gap-2 text-xs font-semibold text-mute"><I.pin size={13} className="text-amber" /> Attach GPS coordinates</span>
            <Toggle on={includeLoc} onChange={setIncludeLoc} />
          </div>
        </div>

        <div className="mt-3">
          <p className="mb-1.5 font-mono text-[10px] uppercase tracking-widest text-dim">Meet near a Safe Zone</p>
          <div className="flex flex-wrap gap-1.5">
            {zones.map(({ z, km }) => (
              <button key={z.id} onClick={() => setLocName(z.name)}
                className={`btn-press chip ${locName === z.name ? 'border-safe/60 text-safe' : 'hover:border-amber/50 hover:text-amber'}`}>
                <I.pin size={10} /> {z.name} · {km.toFixed(1)}km
              </button>
            ))}
          </div>
        </div>

        <Btn tone="amber" size="lg" className="mt-4 w-full" onClick={() => engine.startTimer({ durationMinutes: duration, locationName: locName, meetWithUserId: withUser || undefined, includeLocation: includeLoc })}>
          <I.timer size={16} /> Start meeting timer
        </Btn>
        <p className="mt-2 text-center text-[10px] leading-snug text-dim">
          Reminder push at T-5m. If the clock hits zero without a check-in, the BullMQ job flips the timer to <span className="text-sos">expired</span> and fires SOS automatically.
        </p>
      </div>

      <History />
    </div>
  );
}

function History() {
  const state = useEngine();
  const past = state.timers.filter((t) => t.userId === state.personaId && !['active', 'extended'].includes(t.status));
  if (past.length === 0) return null;
  return (
    <div>
      <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-dim">Recent timers</p>
      <div className="space-y-1.5">
        {past.map((t) => (
          <div key={t.id} className="flex items-center justify-between rounded-xl border border-line-soft bg-night-800/50 px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold">{t.locationName}</p>
              <p className="font-mono text-[10px] text-dim">{t.durationMinutes}m planned</p>
            </div>
            <Badge tone={STATUS_TONE[t.status]}>{t.status}</Badge>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ================= SOS ================= */

function SosPane() {
  const state = useEngine();
  const active = engine.activeSosFor(state.personaId);
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
          void engine.triggerSos({ locationName: locName, includeLocation: includeLoc, source: 'manual' });
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
  useEffect(() => () => { if (holdRef.current) cancelAnimationFrame(holdRef.current); }, []);

  const history = state.sosEvents.filter((s) => s.userId === state.personaId).slice(0, 6);

  return (
    <div className="space-y-3">
      {active ? <ActiveSos id={active.id} /> : (
        <div className="rounded-2xl border border-line-soft bg-night-800/60 p-4 text-center">
          <p className="font-display text-[15px] font-bold">One-tap emergency SOS</p>
          <p className="mx-auto mt-1 max-w-[250px] text-[11px] leading-snug text-mute">
            Hold the beacon for 1.2s. Alerts your emergency contacts via Fast2SMS (+91) and Twilio (international), and pings the admin command center in realtime.
          </p>
          <div className="relative mx-auto mt-4 h-44 w-44">
            <span className="absolute inset-0 rounded-full bg-sos/20" style={{ animation: 'ping-soft 1.8s cubic-bezier(0,0,0.2,1) infinite' }} />
            <span className="absolute inset-0 rounded-full bg-sos/10" style={{ animation: 'ping-soft 1.8s cubic-bezier(0,0,0.2,1) infinite', animationDelay: '0.5s' }} />
            <button
              onPointerDown={startHold} onPointerUp={endHold} onPointerLeave={endHold} onContextMenu={(e) => e.preventDefault()}
              className="btn-press absolute inset-0 select-none rounded-full"
              style={{ touchAction: 'none' }}
              aria-label="Hold to trigger SOS"
            >
              <Ring progress={hold} size={176} stroke={10} color="#ff5d64">
                <span className="flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-b from-sos to-[#d63d49] font-display text-2xl font-extrabold tracking-wide text-night-950 shadow-[0_10px_40px_-8px_rgba(255,93,100,0.8)]"
                  style={{ animation: hold > 0 ? undefined : 'breathe 2.6s ease-in-out infinite' }}>
                  SOS
                </span>
              </Ring>
            </button>
          </div>
          <p className="mt-3 font-mono text-[9px] uppercase tracking-widest text-dim">{hold > 0 ? `arming… ${Math.round(hold * 100)}%` : 'hold to trigger · release to cancel'}</p>

          <div className="mt-4 space-y-2 text-left">
            <input value={locName} onChange={(e) => setLocName(e.target.value)} placeholder="Optional place name (e.g. Cubbon Park east gate)" className={inputCls} />
            <div className="flex items-center justify-between rounded-lg border border-line-soft bg-night-900/60 px-3 py-2">
              <span className="flex items-center gap-2 text-xs font-semibold text-mute"><I.pin size={13} className="text-sos" /> Include live GPS fix</span>
              <Toggle on={includeLoc} onChange={setIncludeLoc} />
            </div>
            <p className="text-[10px] leading-snug text-dim">
              Coordinates are validated server-side — either a full [lng, lat] pair or both null. Graceful when GPS is unavailable.
            </p>
          </div>
        </div>
      )}

      <div>
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-dim">SOS history</p>
        {history.length === 0 ? (
          <Empty icon={<I.shield size={24} />} title="No SOS events" sub="Hopefully it stays that way. Triggered events appear here with delivery outcomes." />
        ) : (
          <div className="space-y-1.5">
            {history.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-xl border border-line-soft bg-night-800/50 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold">{engine.user(s.userId).name} · {s.locationName}</p>
                  <p className="font-mono text-[10px] text-dim">{engine.vAgo(s.createdAtV)} · {s.source === 'timer_expired' ? 'auto (timer)' : 'manual'} · {s.contactsNotified} SMS</p>
                </div>
                <Badge tone={s.status === 'active' ? 'err' : s.status === 'resolved' ? 'ok' : 'warn'}>{s.status.replace('_', ' ')}</Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ActiveSos({ id }: { id: string }) {
  const state = useEngine();
  const ev = state.sosEvents.find((s) => s.id === id)!;
  const logs = state.deliveryLogs.filter((l) => l.sosId === id);
  const loc: GeoPoint | null = ev.location;
  return (
    <div className="anim-rise rounded-2xl border border-sos/60 bg-sos/10 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3"><span className="absolute h-full w-full rounded-full bg-sos" style={{ animation: 'ping-soft 1.4s infinite' }} /><span className="h-3 w-3 rounded-full bg-sos" /></span>
          <p className="font-display text-[15px] font-extrabold text-sos">SOS ACTIVE</p>
        </div>
        <span className="font-mono text-[10px] text-mute">{engine.vAgo(ev.createdAtV)}</span>
      </div>
      <div className="mt-2 space-y-1.5 text-xs text-mute">
        <p className="flex items-center gap-2"><I.pin size={12} className="text-sos" /> {loc ? <>GPS fix attached <span className="font-mono text-[10px] text-dim">{COORD_REDACTED}</span></> : ev.locationName} </p>
        <p className="flex items-center gap-2"><I.users size={12} className="text-sos" /> {ev.contactsNotified} contact(s) reached · admins {ev.adminNotified ? 'notified' : '…'}</p>
      </div>
      <div className="mt-3 space-y-1.5">
        {logs.length === 0 && <p className="shimmer rounded-lg px-3 py-2 font-mono text-[10px] text-dim">dispatch worker claiming delivery logs…</p>}
        {logs.map((l) => (
          <div key={l.id} className="flex items-center justify-between rounded-lg border border-line-soft bg-night-900/70 px-2.5 py-1.5">
            <div className="min-w-0">
              <p className="truncate text-[11px] font-semibold">{l.contactName}</p>
              <p className="font-mono text-[9px] text-dim">{l.gateway === 'fast2sms' ? 'Fast2SMS +91' : 'Twilio intl'} · try {l.attempts}{l.gatewayResponse ? ` · ${l.gatewayResponse.sid}` : ''}</p>
            </div>
            <Badge tone={l.status === 'sent' ? 'ok' : l.status === 'failed' ? 'err' : 'warn'}>
              {l.status === 'sending' && <span className="pulse-dot">●</span>} {l.status}
            </Badge>
          </div>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Btn tone="safe" onClick={() => engine.resolveSos(id, 'resolved', false)}><I.check size={14} /> I’m safe</Btn>
        <Btn tone="outline" onClick={() => engine.resolveSos(id, 'false_alarm', false)}>False alarm</Btn>
      </div>
    </div>
  );
}
