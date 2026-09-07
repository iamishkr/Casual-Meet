import { useMemo, useState, type ReactNode } from 'react';
import { engine, useEngine } from '../../lib/engine';
import { api } from '../../lib/api';
import type { ReportOutcome, SafeZoneCategory, SuspendType, VerificationRequest } from '../../lib/types';
import { COORD_REDACTED, fmtClock, relTime } from '../../lib/utils';
import { Avatar, Badge, Btn, Empty, Field, I, Modal, Reveal, SectionHead, Seg, inputCls, MiniBars } from '../ui';
import DatabaseTab from './DatabaseTab';
import SuspiciousTab from './SuspiciousTab';

type AdminTab = 'overview' | 'sos' | 'moderation' | 'suspicious' | 'users' | 'database';

export default function AdminConsole() {
  const state = useEngine();
  const [tab, setTab] = useState<AdminTab>('overview');
  const pendingSos = state.sosEvents.filter((s) => s.status === 'active').length;
  const pendingReports = state.reports.filter((r) => r.status === 'pending').length;
  const pendingVerifs = state.verifications.filter((v) => v.status === 'pending').length;

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      {/* route guard strip */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line-soft bg-night-850 px-3.5 py-2.5">
        <div className="flex items-center gap-2.5">
          <span className="text-amber"><I.lock size={15} /></span>
          <div>
            <p className="font-mono text-[11px] font-bold tracking-wide text-ink">/admin/* <span className="text-dim">— route guard active</span></p>
            <p className="text-[10px] text-dim">requires role ∈ {'{ moderator, super_admin }'} · JWT re-scoped on every request</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="err">{pendingSos} live SOS</Badge>
          <Badge tone="warn">{pendingReports} reports</Badge>
          <Badge tone="info">{pendingVerifs} verifications</Badge>
          <div className="ml-1 flex items-center gap-2 rounded-lg border border-line-soft bg-night-900 py-1 pl-1 pr-2.5">
            <Avatar user={engine.user(state.adminId)} size={22} />
            <div className="leading-tight">
              <p className="text-[11px] font-bold">Kavita Rao</p>
              <p className="font-mono text-[8px] uppercase tracking-widest text-amber">super_admin</p>
            </div>
          </div>
        </div>
      </div>

      {/* tabs */}
      <div className="mb-4 flex gap-1 overflow-x-auto">
        {([
          ['overview', 'Overview', <I.chart size={14} />],
          ['sos', 'SOS Board', <I.sos size={14} />],
          ['moderation', 'Moderation', <I.gavel size={14} />],
          ['suspicious', 'Suspicious Activity', <I.alertTriangle size={14} />],
          ['users', 'Users & Suspensions', <I.users size={14} />],
          ['database', 'Database Inspector', <I.database size={14} />],
        ] as [AdminTab, string, ReactNode][]).map(([id, label, ic]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`btn-press flex shrink-0 items-center gap-1.5 rounded-lg border px-3.5 py-2 text-[12px] font-bold transition-colors ${tab === id ? 'border-amber/50 bg-amber/10 text-amber' : 'border-line-soft bg-night-850 text-mute hover:text-ink'}`}>
            {ic} {label}
            {id === 'sos' && pendingSos > 0 && <span className="rounded-full bg-sos px-1.5 font-mono text-[10px] text-night-950 pulse-dot">{pendingSos}</span>}
            {id === 'moderation' && pendingReports + pendingVerifs > 0 && <span className="rounded-full bg-amber px-1.5 font-mono text-[10px] text-night-950">{pendingReports + pendingVerifs}</span>}
            {id === 'database' && <span className="rounded-full bg-sky/20 px-1.5 font-mono text-[9px] text-sky font-bold">MongoDB</span>}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1">
        {tab === 'overview' && <Overview />}
        {tab === 'sos' && <SosBoard />}
        {tab === 'moderation' && <Moderation />}
        {tab === 'suspicious' && <SuspiciousTab />}
        {tab === 'users' && <UsersTab />}
        {tab === 'database' && <DatabaseTab />}
      </div>
    </div>
  );
}

/* ================= overview ================= */

function Overview() {
  const state = useEngine();
  const [showAddZone, setShowAddZone] = useState(false);
  const [zoneName, setZoneName] = useState('');
  const [zoneCategory, setZoneCategory] = useState<SafeZoneCategory>('police_station');
  const [zoneArea, setZoneArea] = useState('');
  const [zoneLng, setZoneLng] = useState('77.6245');
  const [zoneLat, setZoneLat] = useState('12.9352');
  const [zoneErr, setZoneErr] = useState('');
  const [savingZone, setSavingZone] = useState(false);

  const handleCreateSafeZone = async () => {
    if (!zoneName.trim() || !zoneArea.trim()) {
      setZoneErr('Zone name and area are required');
      return;
    }
    setSavingZone(true);
    try {
      const lng = parseFloat(zoneLng) || 77.6245;
      const lat = parseFloat(zoneLat) || 12.9352;
      await api.admin.addSafeZone({
        name: zoneName.trim(),
        category: zoneCategory,
        area: zoneArea.trim(),
        coordinates: [lng, lat],
      });
      engine.addSafeZone({
        name: zoneName.trim(),
        category: zoneCategory,
        area: zoneArea.trim(),
        location: { type: 'Point', coordinates: [lng, lat] },
      });
      setShowAddZone(false);
      setZoneName('');
      setZoneArea('');
      setZoneErr('');
    } catch (err: any) {
      setZoneErr(err.message || 'Failed to register safe zone');
    } finally {
      setSavingZone(false);
    }
  };

  const today = state.daily[state.daily.length - 1];
  const series = (k: 'registrations' | 'connections' | 'messages' | 'sos') => state.daily.map((d) => d[k]);
  const kpis: { label: string; value: number; color: string; note: string }[] = [
    { label: 'Registrations', value: today.registrations, color: '#56c8f5', note: 'onboarding complete' },
    { label: 'Connections', value: today.connections, color: '#3ecf8e', note: 'accepted today' },
    { label: 'Messages', value: today.messages, color: '#ffb224', note: 'persisted · scanned' },
    { label: 'SOS events', value: today.sos, color: '#ff5d64', note: 'triggered today' },
  ];
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
      <div className="space-y-4">
        <Reveal>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {kpis.map((k, i) => (
              <div key={k.label} className="panel rounded-xl p-3.5" style={{ animationDelay: `${i * 60}ms` }}>
                <div className="flex items-center justify-between">
                  <p className="font-mono text-[9px] uppercase tracking-widest text-dim">{k.label}</p>
                  <span className="h-1.5 w-1.5 rounded-full pulse-dot" style={{ background: k.color }} />
                </div>
                <p key={k.value} className="anim-fade tick-num mt-1 font-display text-[26px] font-extrabold leading-none" style={{ color: k.color }}>{k.value}</p>
                <p className="mt-1 text-[10px] text-dim">{k.note} · live</p>
              </div>
            ))}
          </div>
        </Reveal>

        <Reveal delay={80}>
          <div className="panel rounded-xl p-4">
            <SectionHead icon={<I.chart size={16} />} title="14-day trends" sub="MongoDB aggregation pipeline · daily buckets · updates as events stream in" />
            <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
              {([
                ['New registrations', 'registrations', '#56c8f5'],
                ['Connections accepted', 'connections', '#3ecf8e'],
                ['Messages sent', 'messages', '#ffb224'],
                ['SOS triggered', 'sos', '#ff5d64'],
              ] as const).map(([label, key, color]) => (
                <div key={key}>
                  <div className="mb-1.5 flex items-center justify-between">
                    <p className="text-[11px] font-bold text-mute">{label}</p>
                    <p className="tick-num font-mono text-[10px]" style={{ color }}>{series(key).reduce((a, b) => a + b, 0).toLocaleString()} total</p>
                  </div>
                  <MiniBars data={series(key)} color={color} height={56} />
                  <div className="mt-1 flex justify-between font-mono text-[8px] text-dim">
                    <span>{state.daily[0].date}</span><span>{today.date}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        <Reveal delay={140}>
          <div className="panel rounded-xl p-4">
            <SectionHead
              icon={<I.pin size={16} />}
              title="Safe Zones directory"
              sub="Curated public spots suggested inside the meet-timer flow"
              right={
                <Btn size="sm" tone="outline" onClick={() => setShowAddZone(true)}>
                  <I.plus size={12} /> Add Safe Zone
                </Btn>
              }
            />
            <div className="grid gap-2 sm:grid-cols-2">
              {state.safeZones.map((z) => (
                <div key={z.id} className="flex items-center gap-2.5 rounded-lg border border-line-soft bg-night-900/60 px-3 py-2 transition-colors hover:border-amber/30">
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${z.category === 'police_station' ? 'bg-sky/15 text-sky' : z.category === 'hospital' ? 'bg-sos/15 text-sos' : 'bg-safe/15 text-safe'}`}>
                    {z.category === 'police_station' ? <I.shield size={15} /> : z.category === 'hospital' ? <I.plus size={15} /> : z.category === 'public_transit' ? <I.bolt size={15} /> : <I.pin size={15} />}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold">{z.name}</p>
                    <p className="font-mono text-[9px] uppercase tracking-wide text-dim">{z.category.replace('_', ' ')} · {z.area}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>

      {/* Modal for adding a safe zone */}
      <Modal open={showAddZone} onClose={() => setShowAddZone(false)} title="Add Verified Safe Meeting Zone">
        <div className="space-y-3.5">
          <Field label="Zone Name" error={zoneErr}>
            <input
              className={inputCls}
              placeholder="e.g. Koramangala Police Station"
              value={zoneName}
              onChange={(e) => { setZoneName(e.target.value); setZoneErr(''); }}
            />
          </Field>
          <Field label="Category">
            <select
              className={inputCls}
              value={zoneCategory}
              onChange={(e) => setZoneCategory(e.target.value as SafeZoneCategory)}
            >
              <option value="police_station">Police Station</option>
              <option value="hospital">Hospital</option>
              <option value="public_transit">Public Transit / Metro</option>
              <option value="cafe">Verified 24/7 Cafe</option>
              <option value="mall">Shopping Mall</option>
            </select>
          </Field>
          <Field label="Area / Neighborhood">
            <input
              className={inputCls}
              placeholder="e.g. Koramangala 5th Block, Bengaluru"
              value={zoneArea}
              onChange={(e) => { setZoneArea(e.target.value); setZoneErr(''); }}
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Longitude">
              <input className={inputCls} value={zoneLng} onChange={(e) => setZoneLng(e.target.value)} />
            </Field>
            <Field label="Latitude">
              <input className={inputCls} value={zoneLat} onChange={(e) => setZoneLat(e.target.value)} />
            </Field>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Btn tone="ghost" onClick={() => setShowAddZone(false)}>Cancel</Btn>
            <Btn tone="amber" onClick={handleCreateSafeZone} disabled={savingZone}>
              {savingZone ? 'Registering…' : 'Register Safe Zone'}
            </Btn>
          </div>
        </div>
      </Modal>

      <Reveal delay={100} className="min-w-0">
        <div className="panel flex h-full min-h-[420px] flex-col rounded-xl p-4">
          <SectionHead icon={<I.bolt size={16} />} title="Live system feed" sub="socket.io + BullMQ event stream" right={<span className="flex items-center gap-1.5 font-mono text-[9px] text-safe"><span className="h-1.5 w-1.5 rounded-full bg-safe pulse-dot" />LIVE</span>} />
          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1" style={{ maxHeight: 640 }}>
            {state.feed.slice(0, 34).map((e) => (
              <div key={e.id} className="anim-slide-r rounded-lg border border-line-soft/60 bg-night-900/50 px-2.5 py-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className={`font-mono text-[9px] font-bold uppercase tracking-wider ${e.tone === 'err' ? 'text-sos' : e.tone === 'warn' ? 'text-amber' : e.tone === 'ok' ? 'text-safe' : 'text-sky'}`}>{e.kind}</span>
                  <span className="tick-num font-mono text-[9px] text-dim">{fmtClock(e.wall)}</span>
                </div>
                <p className="mt-0.5 break-words text-[11px] leading-snug text-mute">{e.text}</p>
                {e.endpoint && <p className="mt-0.5 font-mono text-[9px] text-dim">{e.endpoint}</p>}
              </div>
            ))}
          </div>
        </div>
      </Reveal>
    </div>
  );
}

/* ================= SOS board ================= */

function SosBoard() {
  const state = useEngine();
  const [expanded, setExpanded] = useState<string | null>(null);
  const active = state.sosEvents.filter((s) => s.status === 'active');
  const history = state.sosEvents.filter((s) => s.status !== 'active');

  return (
    <div className="space-y-4">
      <Reveal>
        <SectionHead icon={<I.sos size={16} />} title="Live SOS board" sub="Realtime alerts with per-contact SMS delivery state · dispatch is rate-limited (30s) and idempotent" />
        {active.length === 0 ? (
          <Empty icon={<I.shield size={28} />} title="No active emergencies"
            sub="Trigger an SOS from the device — it lands here instantly over the socket feed, with SMS dispatch logs streaming in." />
        ) : (
          <div className="space-y-3">
            {active.map((s) => {
              const u = engine.user(s.userId);
              const logs = state.deliveryLogs.filter((l) => l.sosId === s.id);
              const open = expanded === s.id || logs.length <= 3;
              return (
                <div key={s.id} className="anim-rise rounded-xl border border-sos/50 bg-sos/5 p-4" style={{ boxShadow: '0 0 40px -18px rgba(255,93,100,0.5)' }}>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="relative flex h-2.5 w-2.5"><span className="absolute h-full w-full rounded-full bg-sos" style={{ animation: 'ping-soft 1.4s infinite' }} /><span className="h-2.5 w-2.5 rounded-full bg-sos" /></span>
                    <Avatar user={u} size={38} />
                    <div className="min-w-0 flex-1">
                      <p className="font-display text-[15px] font-extrabold">{u.name} <span className="font-mono text-[10px] font-normal text-dim">@{u.username}</span></p>
                      <p className="font-mono text-[10px] text-mute">
                        {engine.vAgo(s.createdAtV)} · src: {s.source === 'timer_expired' ? <span className="text-sos">timer_expired (auto-escalation)</span> : 'manual'} · {u.phone}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone={s.location ? 'err' : 'dim'}>{s.location ? <>GPS <span className="text-dim">{COORD_REDACTED}</span></> : 'no coords'}</Badge>
                      <Badge tone="warn">{s.contactsNotified}/{logs.length || engine_contacts(s.userId)} SMS</Badge>
                    </div>
                  </div>
                  {s.locationName && <p className="mt-2 flex items-center gap-1.5 text-xs text-mute"><I.pin size={12} className="text-sos" /> “{s.locationName}”{s.location && <a className="font-mono text-[10px] text-sky underline decoration-sky/40 hover:text-sky" href={`https://maps.google.com/?q=${s.location.coordinates[1]},${s.location.coordinates[0]}`} target="_blank" rel="noreferrer">open in maps ↗</a>}</p>}

                  <div className="mt-3 overflow-hidden rounded-lg border border-line-soft bg-night-900/70">
                    <div className="flex items-center justify-between border-b border-line-soft px-3 py-1.5">
                      <p className="font-mono text-[9px] uppercase tracking-widest text-dim">SosDeliveryLog · atomic per-contact records</p>
                      <button className="btn-press font-mono text-[9px] uppercase tracking-widest text-sky hover:text-ink" onClick={() => setExpanded(open && logs.length > 3 ? s.id : open ? null : s.id)}>{open ? 'collapse' : 'expand'}</button>
                    </div>
                    {logs.length === 0 ? (
                      <p className="shimmer px-3 py-2.5 font-mono text-[10px] text-dim">worker claiming contact logs…</p>
                    ) : (
                      <table className="w-full text-left">
                        <tbody>
                          {logs.map((l) => (
                            <tr key={l.id} className="border-b border-line-soft/50 last:border-0 hover:bg-night-850/70">
                              <td className="px-3 py-1.5">
                                <p className="text-[11px] font-semibold">{l.contactName}</p>
                                <p className="font-mono text-[9px] text-dim">{l.contactPhone}</p>
                              </td>
                              <td className="px-2 py-1.5"><Badge tone={l.gateway === 'fast2sms' ? 'warn' : 'info'}>{l.gateway === 'fast2sms' ? 'Fast2SMS' : 'Twilio'}</Badge></td>
                              <td className="px-2 py-1.5 font-mono text-[9px] text-dim">try {l.attempts}{l.gatewayResponse && <span className="text-safe"> · {l.gatewayResponse.sid} · {l.gatewayResponse.cost}</span>}{l.lastError && <span className="text-sos"> · {l.lastError}</span>}</td>
                              <td className="px-3 py-1.5 text-right">
                                <Badge tone={l.status === 'sent' ? 'ok' : l.status === 'failed' ? 'err' : 'warn'}>{l.status === 'sending' && <span className="pulse-dot">●</span>}{l.status}</Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Btn size="sm" tone="outline" onClick={() => engine.dispatchSos(s.id, true)}><I.refresh size={13} /> Re-dispatch (retry failed)</Btn>
                    <span className="flex-1" />
                    <Btn size="sm" tone="safe" onClick={() => engine.resolveSos(s.id, 'resolved', true)}><I.check size={13} /> Mark resolved</Btn>
                    <Btn size="sm" tone="ghost" onClick={() => engine.resolveSos(s.id, 'false_alarm', true)}>False alarm</Btn>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Reveal>

      <Reveal delay={80}>
        <SectionHead icon={<I.timer size={15} />} title="Resolved history" sub="Audit trail — every event keeps its dispatch log" />
        <div className="space-y-1.5">
          {history.length === 0 && <p className="text-xs text-dim">Nothing resolved yet.</p>}
          {history.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-line-soft bg-night-850 px-3 py-2">
              <Badge tone={s.status === 'resolved' ? 'ok' : 'warn'}>{s.status.replace('_', ' ')}</Badge>
              <p className="text-xs font-semibold">{engine.user(s.userId).name}</p>
              <p className="font-mono text-[10px] text-dim">{s.locationName} · {s.contactsNotified} SMS · {s.createdAtWall ? relTime(s.createdAtWall) : engine.vAgo(s.createdAtV)}{s.resolvedAtWall ? ` · resolved ${relTime(s.resolvedAtWall)}` : ''}</p>
            </div>
          ))}
        </div>
      </Reveal>
    </div>
  );
}
const engine_contacts = (userId: string) => engine.getSnapshot().contacts.filter((c) => c.userId === userId && c.notifyOnSos).length;

/* ================= moderation ================= */

function Moderation() {
  const state = useEngine();
  const [report, setReport] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<ReportOutcome>('warning_issued');
  const [note, setNote] = useState('');
  const [noteErr, setNoteErr] = useState('');
  const [verif, setVerif] = useState<VerificationRequest | null>(null);
  const [vNote, setVNote] = useState('');
  const [vErr, setVErr] = useState('');

  const pending = state.reports.filter((r) => r.status === 'pending');
  const resolved = state.reports.filter((r) => r.status !== 'pending');
  const pendingV = state.verifications.filter((v) => v.status === 'pending');

  const submitReport = () => {
    if (note.trim().length < 8) { setNoteErr('An auditable action note (≥ 8 chars) is mandatory'); return; }
    engine.resolveReport(report!, outcome, note.trim());
    setReport(null); setNote(''); setNoteErr('');
  };
  const submitVerif = (approve: boolean) => {
    if (!approve && vNote.trim().length < 5) { setVErr('A rejection note is required so the user can resubmit'); return; }
    engine.reviewVerification(verif!.id, approve, vNote.trim() || 'Face matches profile photo. Liveness check passed.');
    setVerif(null); setVNote(''); setVErr('');
  };

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Reveal>
        <div className="panel rounded-xl p-4">
          <SectionHead icon={<I.gavel size={16} />} title="User reports" sub="Resolution requires a structured outcome + auditable note" />
          <div className="space-y-2.5">
            {pending.length === 0 && <Empty icon={<I.inbox size={26} />} title="Queue clear" sub="New reports filed from the mobile client will appear here for triage." />}
            {pending.map((r) => (
              <div key={r.id} className="anim-rise rounded-lg border border-amber/30 bg-amber/5 p-3">
                <div className="flex items-center gap-2.5">
                  <Avatar user={engine.user(r.reportedUserId)} size={34} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-bold">{engine.user(r.reportedUserId).name} <span className="font-mono text-[9px] font-normal text-dim">reported by {engine.user(r.reporterId).username}</span></p>
                    <p className="font-mono text-[9px] uppercase tracking-wide text-amber">{r.reason} · {relTime(r.createdAtWall)}</p>
                  </div>
                </div>
                <p className="mt-2 rounded-md border border-line-soft bg-night-900/60 px-2.5 py-1.5 text-[11px] leading-snug text-mute">“{r.details}”</p>
                <div className="mt-2 flex justify-end">
                  <Btn size="sm" tone="amber" onClick={() => { setReport(r.id); setOutcome('warning_issued'); }}><I.gavel size={13} /> Review & resolve</Btn>
                </div>
              </div>
            ))}
            {resolved.length > 0 && (
              <div className="pt-1">
                <p className="mb-1.5 font-mono text-[9px] uppercase tracking-widest text-dim">Audit trail</p>
                {resolved.map((r) => (
                  <div key={r.id} className="mb-1.5 rounded-lg border border-line-soft bg-night-900/50 px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={r.outcome === 'user_suspended' ? 'err' : r.outcome === 'warning_issued' ? 'warn' : 'ok'}>{r.outcome?.replace('_', ' ')}</Badge>
                      <p className="text-[11px] font-semibold">{engine.user(r.reportedUserId).name}</p>
                      <p className="font-mono text-[9px] text-dim">by {engine.user(r.resolvedBy!).username}</p>
                    </div>
                    <p className="mt-1 text-[10px] italic leading-snug text-dim">“{r.actionNote}”</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Reveal>

      <Reveal delay={90}>
        <div className="panel rounded-xl p-4">
          <SectionHead icon={<I.id size={16} />} title="Identity verification" sub="Live-selfie review · approval sets is_verified and boosts trust +20" />
          <div className="space-y-2.5">
            {pendingV.length === 0 && <Empty icon={<I.camera size={26} />} title="No selfies in queue" sub="Submissions from the device's front camera land here. Only one pending per user is allowed." />}
            {pendingV.map((v) => {
              const u = engine.user(v.userId);
              return (
                <div key={v.id} className="anim-rise rounded-lg border border-sky/30 bg-sky/5 p-3">
                  <div className="flex gap-3">
                    <div className="relative h-24 w-20 shrink-0 overflow-hidden rounded-lg border border-line bg-night-950">
                      <svg viewBox="0 0 80 96" className="h-full w-full">
                        <defs>
                          <linearGradient id={`vg-${v.id}`} x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" stopColor={`hsl(${u.avatarHue} 60% 40%)`} />
                            <stop offset="100%" stopColor={`hsl(${(u.avatarHue + 40) % 360} 60% 26%)`} />
                          </linearGradient>
                        </defs>
                        <rect width="80" height="96" fill={`url(#vg-${v.id})`} />
                        <ellipse cx="40" cy="40" rx="17" ry="21" fill="rgba(10,16,29,0.5)" />
                        <path d="M12 96c5-20 15-28 28-28s23 8 28 28Z" fill="rgba(10,16,29,0.5)" />
                        <line x1="6" y1="12" x2="74" y2="12" stroke="rgba(62,207,142,0.5)" strokeDasharray="3 4" />
                      </svg>
                      <span className="absolute bottom-1 left-1 chip !text-[7px] text-safe">LIVE CAPTURE</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-bold">{u.name}</p>
                      <p className="font-mono text-[9px] text-dim">@{u.username} · submitted {relTime(v.submittedAtWall)} · jpeg 2.1MB</p>
                      <p className="mt-1 text-[10px] leading-snug text-mute">Profile trust {u.trustScore} → {u.trustScore + 20} on approval. Gallery-upload guard passed; MIME image/jpeg.</p>
                      <div className="mt-2 flex gap-2">
                        <Btn size="sm" tone="safe" onClick={() => { setVerif(v); setVNote(''); }}><I.check size={13} /> Approve</Btn>
                        <Btn size="sm" tone="outline" onClick={() => { setVerif(v); setVNote(''); }}><I.x size={13} /> Reject…</Btn>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            <p className="rounded-lg border border-line-soft bg-night-900/50 px-3 py-2 font-mono text-[9px] leading-relaxed text-dim">
              partial unique index · {'{ userId: 1, status: "pending" }'} where status="pending" — repeat submissions allowed only after rejection
            </p>
          </div>
        </div>
      </Reveal>

      {/* report resolve modal */}
      <Modal open={!!report} onClose={() => setReport(null)} title="Resolve report">
        <div className="space-y-3.5">
          <Field label="Structured outcome">
            <div className="space-y-1.5">
              {([
                ['user_suspended', 'Suspend reported user', 'Creates a 7-day temporary suspension · auth rejects immediately', 'err'],
                ['warning_issued', 'Issue warning', 'Formal strike recorded on the account', 'warn'],
                ['false_report', 'Dismiss as false report', 'No action against the reported user', 'ok'],
              ] as [ReportOutcome, string, string, string][]).map(([val, label, desc, tone]) => (
                <button key={val} onClick={() => setOutcome(val)}
                  className={`btn-press w-full rounded-lg border px-3 py-2 text-left transition-colors ${outcome === val ? 'border-amber/60 bg-amber/10' : 'border-line-soft bg-night-900/60 hover:border-line'}`}>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold">{label}</p>
                    <Badge tone={tone}>{val.replace('_', ' ')}</Badge>
                  </div>
                  <p className="mt-0.5 text-[10px] text-dim">{desc}</p>
                </button>
              ))}
            </div>
          </Field>
          <Field label="Action note (auditable, mandatory)" error={noteErr}>
            <textarea rows={3} className={inputCls} value={note} onChange={(e) => { setNote(e.target.value); setNoteErr(''); }} placeholder="What did you observe, and why this outcome…" />
          </Field>
          <div className="flex justify-end gap-2">
            <Btn tone="ghost" onClick={() => setReport(null)}>Cancel</Btn>
            <Btn tone="amber" onClick={submitReport}><I.gavel size={14} /> Record resolution</Btn>
          </div>
        </div>
      </Modal>

      {/* verification modal */}
      <Modal open={!!verif} onClose={() => setVerif(null)} title={`Review ${verif ? engine.user(verif.userId).name : ''}`}>
        <div className="space-y-3.5">
          <p className="text-xs leading-relaxed text-mute">Compare the live capture against the profile photos. Approving flips <span className="font-mono text-safe">is_verified=true</span> and adds +20 trust. Rejecting requires a note — the user may resubmit.</p>
          <Field label="Review note (required for rejection)" error={vErr}>
            <textarea rows={3} className={inputCls} value={vNote} onChange={(e) => { setVNote(e.target.value); setVErr(''); }} placeholder="e.g. Face does not match profile photo — resubmit in better lighting" />
          </Field>
          <div className="flex justify-end gap-2">
            <Btn tone="outline" onClick={() => submitVerif(false)}><I.x size={14} /> Reject</Btn>
            <Btn tone="safe" onClick={() => submitVerif(true)}><I.check size={14} /> Approve & verify</Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ================= users & suspensions ================= */

function UsersTab() {
  const state = useEngine();
  const [target, setTarget] = useState<string | null>(null);
  const [type, setType] = useState<SuspendType>('temporary');
  const [reason, setReason] = useState('');
  const [rErr, setRErr] = useState('');

  const rows = useMemo(() => state.users.filter((u) => u.role === 'user'), [state.users]);

  const submit = () => {
    if (reason.trim().length < 6) { setRErr('Reason is required (≥ 6 chars)'); return; }
    engine.suspendUser(target!, type, reason.trim());
    setTarget(null); setReason(''); setRErr('');
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
      <Reveal>
        <div className="panel rounded-xl p-4">
          <SectionHead icon={<I.users size={16} />} title="User directory" sub="Suspended accounts are rejected at the auth middleware and vanish from discovery" />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left">
              <thead>
                <tr className="border-b border-line-soft font-mono text-[9px] uppercase tracking-widest text-dim">
                  <th className="pb-2 pr-3 font-medium">User</th>
                  <th className="pb-2 pr-3 font-medium">Trust</th>
                  <th className="pb-2 pr-3 font-medium">Messages</th>
                  <th className="pb-2 pr-3 font-medium">Discoverable</th>
                  <th className="pb-2 pr-3 font-medium">Status</th>
                  <th className="pb-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => {
                  const susp = engine.activeSuspension(u.id);
                  return (
                    <tr key={u.id} className="group border-b border-line-soft/50 transition-colors last:border-0 hover:bg-night-800/50">
                      <td className="py-2 pr-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar user={u} size={30} />
                          <div>
                            <p className="flex items-center gap-1 text-xs font-bold">{u.name}{u.isVerified && <span className="text-sky"><I.logo size={11} strokeWidth={2.4} /></span>}</p>
                            <p className="font-mono text-[9px] text-dim">@{u.username} · joined {u.joinedDaysAgo}d ago</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-2 pr-3">
                        <span className={`tick-num font-mono text-[11px] font-bold ${u.trustScore < 80 ? 'text-sos' : u.trustScore >= 115 ? 'text-safe' : 'text-ink'}`}>{u.trustScore}</span>
                      </td>
                      <td className="py-2 pr-3"><span className="chip">{u.allowMessages}</span></td>
                      <td className="py-2 pr-3">
                        {u.showLocation && !susp && u.onboardingComplete ? <Badge tone="ok">yes</Badge> : <Badge tone="dim">{susp ? 'suspended' : !u.onboardingComplete ? 'onboarding' : 'hidden'}</Badge>}
                      </td>
                      <td className="py-2 pr-3">
                        {susp ? <Badge tone="err">{susp.type.replace('_', ' ')}</Badge> : <Badge tone="ok">active</Badge>}
                      </td>
                      <td className="py-2 text-right">
                        {!susp && u.id !== state.personaId && (
                          <Btn size="sm" tone="ghost" className="text-mute hover:text-sos" onClick={() => { setTarget(u.id); setType('temporary'); setReason(''); }}>
                            <I.ban size={13} /> Suspend
                          </Btn>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </Reveal>

      <Reveal delay={90}>
        <div className="panel rounded-xl p-4">
          <SectionHead icon={<I.ban size={16} />} title="Active suspensions" sub="Durable — survive restarts, enforced everywhere" />
          <div className="space-y-2">
            {state.suspensions.filter((s) => s.isActive).length === 0 && <Empty icon={<I.check size={24} />} title="None active" sub="Suspensions you apply from the directory or report outcomes appear here." />}
            {state.suspensions.filter((s) => s.isActive).map((s) => (
              <div key={s.id} className="rounded-lg border border-sos/30 bg-sos/5 p-3">
                <div className="flex items-center gap-2.5">
                  <Avatar user={engine.user(s.userId)} size={30} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold">{engine.user(s.userId).name}</p>
                    <p className="font-mono text-[9px] text-dim">by {engine.user(s.suspendedBy).username} · {relTime(s.createdAtWall)}{s.expiresAtWall ? ` · lifts in ${Math.max(0, Math.ceil((s.expiresAtWall - Date.now()) / 86400000))}d` : ''}</p>
                  </div>
                  <Badge tone="err">{s.type.replace('_', ' ')}</Badge>
                </div>
                <p className="mt-1.5 text-[10px] italic text-mute">“{s.reason}”</p>
                <div className="mt-2 flex justify-end">
                  <Btn size="sm" tone="outline" onClick={() => engine.reinstate(s.id)}><I.refresh size={12} /> Reinstate</Btn>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Reveal>

      <Modal open={!!target} onClose={() => setTarget(null)} title={`Suspend ${target ? engine.user(target).name : ''}`}>
        <div className="space-y-3.5">
          <Field label="Suspension type">
            <div className="grid grid-cols-3 gap-1.5">
              {(['temporary', 'permanent', 'shadow_ban'] as SuspendType[]).map((t) => (
                <button key={t} onClick={() => setType(t)}
                  className={`btn-press rounded-lg border px-2 py-2 font-mono text-[10px] font-bold uppercase tracking-wide ${type === t ? 'border-sos/60 bg-sos/10 text-sos' : 'border-line-soft bg-night-900/60 text-mute hover:text-ink'}`}>
                  {t.replace('_', ' ')}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Reason (auditable)" error={rErr}>
            <textarea rows={3} className={inputCls} value={reason} onChange={(e) => { setReason(e.target.value); setRErr(''); }} placeholder="Reference the report or observed behaviour…" />
          </Field>
          <p className="text-[10px] leading-relaxed text-dim">Effect is immediate: auth middleware rejects the token, discovery excludes the profile, messaging gates close. Shadow-banned users stay invisible to everyone else but see a normal feed.</p>
          <div className="flex justify-end gap-2">
            <Btn tone="ghost" onClick={() => setTarget(null)}>Cancel</Btn>
            <Btn tone="danger" onClick={submit}><I.ban size={14} /> Apply suspension</Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}
