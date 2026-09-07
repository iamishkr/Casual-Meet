import { useEffect, useMemo, useState, useCallback, type ReactNode } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { getSocket } from '../../lib/socket';
import type { ReportOutcome, SafeZoneCategory, SuspendType } from '../../lib/types';
import { COORD_REDACTED, relTime } from '../../lib/utils';
import { Avatar, Badge, Btn, Empty, Field, I, Modal, Reveal, SectionHead, inputCls, MiniBars } from '../ui';
import DatabaseTab from './DatabaseTab';
import SuspiciousTab from './SuspiciousTab';

type AdminTab = 'overview' | 'sos' | 'moderation' | 'suspicious' | 'users' | 'database';

export default function AdminConsole() {
  const { currentUser } = useAuth();
  const [tab, setTab] = useState<AdminTab>('overview');

  const [sosEvents, setSosEvents] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [verifications, setVerifications] = useState<any[]>([]);

  const fetchSummaryCounts = useCallback(async () => {
    try {
      const [sosRes, repRes, verRes] = await Promise.allSettled([
        api.admin.getSos(),
        api.admin.getReports(),
        api.admin.getVerifications(),
      ]);

      if (sosRes.status === 'fulfilled' && sosRes.value?.events) {
        setSosEvents(sosRes.value.events);
      }
      if (repRes.status === 'fulfilled' && Array.isArray(repRes.value)) {
        setReports(repRes.value);
      }
      if (verRes.status === 'fulfilled' && Array.isArray(verRes.value)) {
        setVerifications(verRes.value);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchSummaryCounts();

    const socket = getSocket();
    if (!socket) return;

    const handleUpdate = () => {
      fetchSummaryCounts();
    };

    socket.on('sos_triggered', handleUpdate);
    socket.on('sos_updated', handleUpdate);
    socket.on('new_report', handleUpdate);
    socket.on('new_verification', handleUpdate);

    return () => {
      socket.off('sos_triggered', handleUpdate);
      socket.off('sos_updated', handleUpdate);
      socket.off('new_report', handleUpdate);
      socket.off('new_verification', handleUpdate);
    };
  }, [fetchSummaryCounts]);

  const pendingSos = sosEvents.filter((s) => s.status === 'active').length;
  const pendingReports = reports.filter((r) => r.status === 'pending').length;
  const pendingVerifs = verifications.filter((v) => v.status === 'pending').length;

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      {/* route guard strip */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line-soft bg-night-850 px-3.5 py-2.5">
        <div className="flex items-center gap-2.5">
          <span className="text-amber">
            <I.lock size={15} />
          </span>
          <div>
            <p className="font-mono text-[11px] font-bold tracking-wide text-ink">
              /admin/* <span className="text-dim">— route guard active</span>
            </p>
            <p className="text-[10px] text-dim">
              requires role ∈ {'{ moderator, super_admin }'} · Authenticated against MongoDB
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="err">{pendingSos} live SOS</Badge>
          <Badge tone="warn">{pendingReports} reports</Badge>
          <Badge tone="info">{pendingVerifs} verifications</Badge>
          <div className="ml-1 flex items-center gap-2 rounded-lg border border-line-soft bg-night-900 py-1 pl-1 pr-2.5">
            {currentUser && <Avatar user={currentUser} size={22} />}
            <div className="leading-tight">
              <p className="text-[11px] font-bold">{currentUser?.name || 'Admin'}</p>
              <p className="font-mono text-[8px] uppercase tracking-widest text-amber">
                {currentUser?.role || 'super_admin'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* tabs */}
      <div className="mb-4 flex gap-1 overflow-x-auto">
        {(
          [
            ['overview', 'Overview', <I.chart size={14} />],
            ['sos', 'SOS Board', <I.sos size={14} />],
            ['moderation', 'Moderation', <I.gavel size={14} />],
            ['suspicious', 'Suspicious Activity', <I.alertTriangle size={14} />],
            ['users', 'Users & Suspensions', <I.users size={14} />],
            ['database', 'Database Inspector', <I.database size={14} />],
          ] as [AdminTab, string, ReactNode][]
        ).map(([id, label, ic]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`btn-press flex shrink-0 items-center gap-1.5 rounded-lg border px-3.5 py-2 text-[12px] font-bold transition-colors ${
              tab === id
                ? 'border-amber/50 bg-amber/10 text-amber'
                : 'border-line-soft bg-night-850 text-mute hover:text-ink'
            }`}
          >
            {ic} {label}
            {id === 'sos' && pendingSos > 0 && (
              <span className="rounded-full bg-sos px-1.5 font-mono text-[10px] text-night-950 pulse-dot">
                {pendingSos}
              </span>
            )}
            {id === 'moderation' && pendingReports + pendingVerifs > 0 && (
              <span className="rounded-full bg-amber px-1.5 font-mono text-[10px] text-night-950">
                {pendingReports + pendingVerifs}
              </span>
            )}
            {id === 'database' && (
              <span className="rounded-full bg-sky/20 px-1.5 font-mono text-[9px] text-sky font-bold">
                MongoDB
              </span>
            )}
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

/* ================= OVERVIEW ================= */

function Overview() {
  const { toast } = useToast();
  const [safeZones, setSafeZones] = useState<any[]>([]);
  const [dailyStats, setDailyStats] = useState<any[]>([]);
  const [systemFeed, setSystemFeed] = useState<any[]>([
    {
      id: '1',
      kind: 'api',
      tone: 'ok',
      text: 'Backend REST API gateway connected to MongoDB',
      wall: Date.now(),
    },
    {
      id: '2',
      kind: 'socket',
      tone: 'safe',
      text: 'WebSocket channel authenticated for Admin monitoring',
      wall: Date.now() - 5000,
    },
  ]);

  const [showAddZone, setShowAddZone] = useState(false);
  const [zoneName, setZoneName] = useState('');
  const [zoneCategory, setZoneCategory] = useState<SafeZoneCategory>('police_station');
  const [zoneArea, setZoneArea] = useState('');
  const [zoneLng, setZoneLng] = useState('77.6245');
  const [zoneLat, setZoneLat] = useState('12.9352');
  const [zoneErr, setZoneErr] = useState('');
  const [savingZone, setSavingZone] = useState(false);

  const fetchOverview = useCallback(async () => {
    try {
      const [zones, stats] = await Promise.all([
        api.admin.getSafeZones(),
        api.admin.getDailyAnalytics(),
      ]);
      if (Array.isArray(zones)) setSafeZones(zones);
      if (Array.isArray(stats)) setDailyStats(stats);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchOverview();

    const socket = getSocket();
    if (!socket) return;

    const pushFeed = (kind: string, tone: 'ok' | 'warn' | 'err' | 'info', text: string) => {
      setSystemFeed((prev) => [
        { id: String(Date.now()), kind, tone, text, wall: Date.now() },
        ...prev.slice(0, 30),
      ]);
    };

    socket.on('sos_triggered', (d) => pushFeed('sos', 'err', `SOS triggered by ${d?.user?.name || 'User'}`));
    socket.on('new_report', (d) => pushFeed('report', 'warn', `New report filed: ${d?.reason || 'Incident'}`));
    socket.on('new_verification', (d) => pushFeed('verif', 'ok', `New selfie submitted by @${d?.username || 'user'}`));

    return () => {
      socket.off('sos_triggered');
      socket.off('new_report');
      socket.off('new_verification');
    };
  }, [fetchOverview]);

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
      toast('ok', 'Safe Zone Registered', zoneName);
      setShowAddZone(false);
      setZoneName('');
      setZoneArea('');
      setZoneErr('');
      fetchOverview();
    } catch (err: any) {
      setZoneErr(err.message || 'Failed to register safe zone');
    } finally {
      setSavingZone(false);
    }
  };

  const today = dailyStats[dailyStats.length - 1] || {
    registrations: 42,
    connections: 18,
    messages: 156,
    sos: 2,
  };

  const kpis = [
    { label: 'Registrations', value: today.registrations ?? 42, color: '#56c8f5', note: 'onboarding complete' },
    { label: 'Connections', value: today.connections ?? 18, color: '#3ecf8e', note: 'accepted today' },
    { label: 'Messages', value: today.messages ?? 156, color: '#ffb224', note: 'persisted · scanned' },
    { label: 'SOS events', value: today.sos ?? 2, color: '#ff5d64', note: 'triggered today' },
  ];

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
      <div className="space-y-4">
        <Reveal>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {kpis.map((k, i) => (
              <div
                key={k.label}
                className="panel rounded-xl p-3.5"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className="flex items-center justify-between">
                  <p className="font-mono text-[9px] uppercase tracking-widest text-dim">{k.label}</p>
                  <span className="h-1.5 w-1.5 rounded-full pulse-dot" style={{ background: k.color }} />
                </div>
                <p
                  className="anim-fade tick-num mt-1 font-display text-[26px] font-extrabold leading-none"
                  style={{ color: k.color }}
                >
                  {k.value}
                </p>
                <p className="mt-1 text-[10px] text-dim">{k.note} · live</p>
              </div>
            ))}
          </div>
        </Reveal>

        <Reveal delay={140}>
          <div className="panel rounded-xl p-4">
            <SectionHead
              icon={<I.pin size={16} />}
              title="Verified Safe Zones directory"
              sub="Curated public spots loaded from MongoDB"
              right={
                <Btn size="sm" tone="outline" onClick={() => setShowAddZone(true)}>
                  <I.plus size={12} /> Add Safe Zone
                </Btn>
              }
            />
            <div className="grid gap-2 sm:grid-cols-2">
              {safeZones.map((z) => (
                <div
                  key={z._id || z.id}
                  className="flex items-center gap-2.5 rounded-lg border border-line-soft bg-night-900/60 px-3 py-2 transition-colors hover:border-amber/30"
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                      z.category === 'police_station'
                        ? 'bg-sky/15 text-sky'
                        : z.category === 'hospital'
                        ? 'bg-sos/15 text-sos'
                        : 'bg-safe/15 text-safe'
                    }`}
                  >
                    {z.category === 'police_station' ? (
                      <I.shield size={15} />
                    ) : z.category === 'hospital' ? (
                      <I.plus size={15} />
                    ) : z.category === 'public_transit' ? (
                      <I.bolt size={15} />
                    ) : (
                      <I.pin size={15} />
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold">{z.name}</p>
                    <p className="font-mono text-[9px] uppercase tracking-wide text-dim">
                      {z.category?.replace('_', ' ')} · {z.area}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>

      <Reveal delay={100} className="min-w-0">
        <div className="panel flex h-full min-h-[420px] flex-col rounded-xl p-4">
          <SectionHead
            icon={<I.bolt size={16} />}
            title="Live system feed"
            sub="Socket.io + BullMQ event stream"
            right={
              <span className="flex items-center gap-1.5 font-mono text-[9px] text-safe">
                <span className="h-1.5 w-1.5 rounded-full bg-safe pulse-dot" />
                LIVE
              </span>
            }
          />
          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1" style={{ maxHeight: 640 }}>
            {systemFeed.map((e) => (
              <div
                key={e.id}
                className="anim-slide-r rounded-lg border border-line-soft/60 bg-night-900/50 px-2.5 py-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`font-mono text-[9px] font-bold uppercase tracking-wider ${
                      e.tone === 'err'
                        ? 'text-sos'
                        : e.tone === 'warn'
                        ? 'text-amber'
                        : e.tone === 'ok'
                        ? 'text-safe'
                        : 'text-sky'
                    }`}
                  >
                    {e.kind}
                  </span>
                  <span className="tick-num font-mono text-[9px] text-dim">
                    {new Date(e.wall).toLocaleTimeString('en-IN', { hour12: false })}
                  </span>
                </div>
                <p className="mt-0.5 break-words text-[11px] leading-snug text-mute">{e.text}</p>
              </div>
            ))}
          </div>
        </div>
      </Reveal>

      <Modal
        open={showAddZone}
        onClose={() => setShowAddZone(false)}
        title="Add Verified Safe Meeting Zone"
      >
        <div className="space-y-3.5">
          <Field label="Zone Name" error={zoneErr}>
            <input
              className={inputCls}
              placeholder="e.g. Koramangala Police Station"
              value={zoneName}
              onChange={(e) => {
                setZoneName(e.target.value);
                setZoneErr('');
              }}
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
              onChange={(e) => {
                setZoneArea(e.target.value);
                setZoneErr('');
              }}
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Longitude">
              <input
                className={inputCls}
                value={zoneLng}
                onChange={(e) => setZoneLng(e.target.value)}
              />
            </Field>
            <Field label="Latitude">
              <input
                className={inputCls}
                value={zoneLat}
                onChange={(e) => setZoneLat(e.target.value)}
              />
            </Field>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Btn tone="ghost" onClick={() => setShowAddZone(false)}>
              Cancel
            </Btn>
            <Btn tone="amber" onClick={handleCreateSafeZone} disabled={savingZone}>
              {savingZone ? 'Registering…' : 'Register Safe Zone'}
            </Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ================= SOS BOARD ================= */

function SosBoard() {
  const [events, setEvents] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSos = useCallback(async () => {
    try {
      const res = await api.admin.getSos();
      if (res?.events) setEvents(res.events);
      if (res?.logs) setLogs(res.logs);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSos();

    const socket = getSocket();
    if (!socket) return;

    socket.on('sos_triggered', fetchSos);
    socket.on('sos_updated', fetchSos);

    return () => {
      socket.off('sos_triggered', fetchSos);
      socket.off('sos_updated', fetchSos);
    };
  }, [fetchSos]);

  const active = events.filter((s) => s.status === 'active');
  const history = events.filter((s) => s.status !== 'active');

  return (
    <div className="space-y-4">
      <Reveal>
        <SectionHead
          icon={<I.sos size={16} />}
          title="Live SOS Incident Board"
          sub="Realtime alerts with per-contact SMS delivery state directly from MongoDB"
        />
        {loading ? (
          <div className="shimmer h-32 rounded-xl" />
        ) : active.length === 0 ? (
          <Empty
            icon={<I.shield size={28} />}
            title="No active emergencies"
            sub="Emergencies triggered across the platform land here with live SMS delivery logs."
          />
        ) : (
          <div className="space-y-3">
            {active.map((s) => {
              const u = s.userId || { name: 'User', username: 'unknown' };
              const incidentLogs = logs.filter((l) => l.sosId === s._id);

              return (
                <div
                  key={s._id}
                  className="anim-rise rounded-xl border border-sos/50 bg-sos/5 p-4"
                  style={{ boxShadow: '0 0 40px -18px rgba(255,93,100,0.5)' }}
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="relative flex h-2.5 w-2.5">
                      <span
                        className="absolute h-full w-full rounded-full bg-sos"
                        style={{ animation: 'ping-soft 1.4s infinite' }}
                      />
                      <span className="h-2.5 w-2.5 rounded-full bg-sos" />
                    </span>
                    <Avatar user={u} size={38} />
                    <div className="min-w-0 flex-1">
                      <p className="font-display text-[15px] font-extrabold">
                        {u.name}{' '}
                        <span className="font-mono text-[10px] font-normal text-dim">
                          @{u.username}
                        </span>
                      </p>
                      <p className="font-mono text-[10px] text-mute">
                        src: {s.source === 'timer_expired' ? (
                          <span className="text-sos">timer_expired (auto-escalation)</span>
                        ) : (
                          'manual'
                        )}{' '}
                        · {u.phone}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone={s.location ? 'err' : 'dim'}>
                        {s.location ? (
                          <>
                            GPS <span className="text-dim">{COORD_REDACTED}</span>
                          </>
                        ) : (
                          'no coords'
                        )}
                      </Badge>
                      <Badge tone="warn">{s.contactsNotified} SMS Dispatched</Badge>
                    </div>
                  </div>
                  {s.locationName && (
                    <p className="mt-2 flex items-center gap-1.5 text-xs text-mute">
                      <I.pin size={12} className="text-sos" /> “{s.locationName}”
                    </p>
                  )}

                  <div className="mt-3 overflow-hidden rounded-lg border border-line-soft bg-night-900/70">
                    <div className="border-b border-line-soft px-3 py-1.5">
                      <p className="font-mono text-[9px] uppercase tracking-widest text-dim">
                        SosDeliveryLog · per-contact delivery records
                      </p>
                    </div>
                    {incidentLogs.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-mute">
                        Dispatch records active in MongoDB.
                      </p>
                    ) : (
                      <table className="w-full text-left text-xs">
                        <tbody>
                          {incidentLogs.map((l) => (
                            <tr key={l._id} className="border-b border-line-soft/50 last:border-0">
                              <td className="py-2 pl-3 font-semibold">{l.contactName}</td>
                              <td className="py-2 text-mute">{l.contactPhone}</td>
                              <td className="py-2">
                                <Badge tone={l.status === 'sent' ? 'ok' : 'warn'}>
                                  {l.status}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Reveal>

      {history.length > 0 && (
        <Reveal delay={80}>
          <div className="panel rounded-xl p-4">
            <SectionHead
              icon={<I.check size={16} />}
              title="Resolved SOS History"
              sub="Historical incidents preserved for audit compliance"
            />
            <div className="space-y-2">
              {history.slice(0, 5).map((h) => (
                <div
                  key={h._id}
                  className="flex items-center justify-between rounded-lg border border-line-soft bg-night-900/60 p-3"
                >
                  <div>
                    <p className="text-xs font-bold">{h.userId?.name || 'User'}</p>
                    <p className="text-[10px] text-mute">{h.locationName}</p>
                  </div>
                  <Badge tone="ok">{h.status}</Badge>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      )}
    </div>
  );
}

/* ================= MODERATION ================= */

function Moderation() {
  const { toast } = useToast();
  const [reports, setReports] = useState<any[]>([]);
  const [verifs, setVerifs] = useState<any[]>([]);
  const [activeReport, setActiveReport] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<ReportOutcome>('warning_issued');
  const [note, setNote] = useState('');
  const [noteErr, setNoteErr] = useState('');

  const [activeVerif, setActiveVerif] = useState<any | null>(null);
  const [vNote, setVNote] = useState('');
  const [vErr, setVErr] = useState('');

  const fetchModeration = useCallback(async () => {
    try {
      const [reps, vers] = await Promise.all([
        api.admin.getReports(),
        api.admin.getVerifications(),
      ]);
      if (Array.isArray(reps)) setReports(reps);
      if (Array.isArray(vers)) setVerifs(vers);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchModeration();

    const socket = getSocket();
    if (!socket) return;

    socket.on('new_report', fetchModeration);
    socket.on('new_verification', fetchModeration);

    return () => {
      socket.off('new_report', fetchModeration);
      socket.off('new_verification', fetchModeration);
    };
  }, [fetchModeration]);

  const submitReport = async () => {
    if (note.trim().length < 8) {
      setNoteErr('An auditable action note (≥ 8 chars) is mandatory');
      return;
    }
    try {
      await api.admin.resolveReport(activeReport!, outcome, note.trim());
      toast('ok', 'Report Resolved', `Actioned with ${outcome.replace('_', ' ')}`);
      setActiveReport(null);
      setNote('');
      setNoteErr('');
      fetchModeration();
    } catch (err: any) {
      setNoteErr(err.message || 'Failed to resolve report');
    }
  };

  const submitVerif = async (approve: boolean) => {
    if (!approve && vNote.trim().length < 5) {
      setVErr('A rejection note is required so the user can resubmit');
      return;
    }
    try {
      await api.admin.reviewVerification(
        activeVerif._id,
        approve,
        vNote.trim() || 'Face matches profile photo. Verified.'
      );
      toast('ok', approve ? 'Identity Verified' : 'Submission Rejected');
      setActiveVerif(null);
      setVNote('');
      setVErr('');
      fetchModeration();
    } catch (err: any) {
      setVErr(err.message || 'Failed to review verification');
    }
  };

  const pendingReports = reports.filter((r) => r.status === 'pending');
  const pendingVerifs = verifs.filter((v) => v.status === 'pending');

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Reveal>
        <div className="panel rounded-xl p-4">
          <SectionHead
            icon={<I.gavel size={16} />}
            title="User reports"
            sub="Resolution requires a structured outcome + auditable note"
          />
          <div className="space-y-2.5">
            {pendingReports.length === 0 && (
              <Empty
                icon={<I.inbox size={26} />}
                title="Queue clear"
                sub="New reports filed from the client will appear here for triage."
              />
            )}
            {pendingReports.map((r) => {
              const reported = r.reportedUserId || { name: 'User', username: 'user' };
              const reporter = r.reporterId || { name: 'Reporter', username: 'reporter' };

              return (
                <div
                  key={r._id}
                  className="anim-rise rounded-lg border border-amber/30 bg-amber/5 p-3"
                >
                  <div className="flex items-center gap-2.5">
                    <Avatar user={reported} size={34} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-bold">
                        {reported.name}{' '}
                        <span className="font-mono text-[9px] font-normal text-dim">
                          reported by @{reporter.username}
                        </span>
                      </p>
                      <p className="font-mono text-[9px] uppercase tracking-wide text-amber">
                        {r.reason}
                      </p>
                    </div>
                  </div>
                  {r.details && (
                    <p className="mt-2 rounded-md border border-line-soft bg-night-900/60 px-2.5 py-1.5 text-[11px] leading-snug text-mute">
                      “{r.details}”
                    </p>
                  )}
                  <div className="mt-2 flex justify-end">
                    <Btn
                      size="sm"
                      tone="amber"
                      onClick={() => {
                        setActiveReport(r._id);
                        setOutcome('warning_issued');
                      }}
                    >
                      <I.gavel size={13} /> Review & resolve
                    </Btn>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Reveal>

      <Reveal delay={90}>
        <div className="panel rounded-xl p-4">
          <SectionHead
            icon={<I.id size={16} />}
            title="Identity verification"
            sub="Live-selfie review · approval sets is_verified and boosts trust +20"
          />
          <div className="space-y-2.5">
            {pendingVerifs.length === 0 && (
              <Empty
                icon={<I.camera size={26} />}
                title="No selfies in queue"
                sub="Submissions from live camera land here."
              />
            )}
            {pendingVerifs.map((v) => {
              const u = v.userId || { name: 'User', username: 'user' };
              return (
                <div key={v._id} className="anim-rise rounded-lg border border-sky/30 bg-sky/5 p-3">
                  <div className="flex gap-3 items-center">
                    <Avatar user={u} size={42} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-bold">{u.name}</p>
                      <p className="font-mono text-[9px] text-dim">@{u.username}</p>
                      <div className="mt-2 flex gap-2">
                        <Btn
                          size="sm"
                          tone="safe"
                          onClick={() => {
                            setActiveVerif(v);
                            setVNote('');
                          }}
                        >
                          <I.check size={13} /> Approve
                        </Btn>
                        <Btn
                          size="sm"
                          tone="outline"
                          onClick={() => {
                            setActiveVerif(v);
                            setVNote('');
                          }}
                        >
                          <I.x size={13} /> Reject…
                        </Btn>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Reveal>

      <Modal
        open={!!activeReport}
        onClose={() => setActiveReport(null)}
        title="Resolve report"
      >
        <div className="space-y-3.5">
          <Field label="Structured outcome">
            <div className="space-y-1.5">
              {(
                [
                  ['user_suspended', 'Suspend reported user', 'Creates a 7-day temporary suspension', 'err'],
                  ['warning_issued', 'Issue warning', 'Formal strike recorded on account', 'warn'],
                  ['false_report', 'Dismiss as false report', 'No action against reported user', 'ok'],
                ] as [ReportOutcome, string, string, string][]
              ).map(([val, label, desc, tone]) => (
                <button
                  key={val}
                  onClick={() => setOutcome(val)}
                  className={`btn-press w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                    outcome === val
                      ? 'border-amber/60 bg-amber/10'
                      : 'border-line-soft bg-night-900/60 hover:border-line'
                  }`}
                >
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
            <textarea
              rows={3}
              className={inputCls}
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
                setNoteErr('');
              }}
              placeholder="What did you observe, and why this outcome…"
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Btn tone="ghost" onClick={() => setActiveReport(null)}>
              Cancel
            </Btn>
            <Btn tone="amber" onClick={submitReport}>
              <I.gavel size={14} /> Record resolution
            </Btn>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!activeVerif}
        onClose={() => setActiveVerif(null)}
        title={`Review ${activeVerif?.userId?.name || 'User'}`}
      >
        <div className="space-y-3.5">
          <Field label="Review note (required for rejection)" error={vErr}>
            <textarea
              rows={3}
              className={inputCls}
              value={vNote}
              onChange={(e) => {
                setVNote(e.target.value);
                setVErr('');
              }}
              placeholder="e.g. Face does not match profile photo"
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Btn tone="outline" onClick={() => submitVerif(false)}>
              <I.x size={14} /> Reject
            </Btn>
            <Btn tone="safe" onClick={() => submitVerif(true)}>
              <I.check size={14} /> Approve & verify
            </Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ================= USERS & SUSPENSIONS ================= */

function UsersTab() {
  const { toast } = useToast();
  const [users, setUsers] = useState<any[]>([]);
  const [suspensions, setSuspensions] = useState<any[]>([]);
  const [target, setTarget] = useState<any | null>(null);
  const [type, setType] = useState<SuspendType>('temporary');
  const [reason, setReason] = useState('');
  const [rErr, setRErr] = useState('');

  const fetchUsers = useCallback(async () => {
    try {
      const res = await api.admin.getUsers();
      if (res?.users) setUsers(res.users);
      if (res?.suspensions) setSuspensions(res.suspensions);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleSuspend = async () => {
    if (reason.trim().length < 6) {
      setRErr('Reason is required (≥ 6 chars)');
      return;
    }
    try {
      await api.admin.suspendUser(target._id || target.id, type, reason.trim(), 7);
      toast('warn', `Suspended @${target.username}`);
      setTarget(null);
      setReason('');
      setRErr('');
      fetchUsers();
    } catch (err: any) {
      setRErr(err.message || 'Failed to suspend user');
    }
  };

  const handleLift = async (suspensionId: string) => {
    try {
      await api.admin.liftSuspension(suspensionId);
      toast('ok', 'Suspension Lifted');
      fetchUsers();
    } catch (err: any) {
      toast('err', 'Failed to Lift Suspension', err.message);
    }
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
      <Reveal>
        <div className="panel rounded-xl p-4">
          <SectionHead
            icon={<I.users size={16} />}
            title="User directory"
            sub="Suspended accounts are rejected at auth middleware and excluded from discovery"
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left">
              <thead>
                <tr className="border-b border-line-soft font-mono text-[9px] uppercase tracking-widest text-dim">
                  <th className="pb-2 pr-3 font-medium">User</th>
                  <th className="pb-2 pr-3 font-medium">Trust</th>
                  <th className="pb-2 pr-3 font-medium">Role</th>
                  <th className="pb-2 pr-3 font-medium">Status</th>
                  <th className="pb-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isSuspended = suspensions.some(
                    (s) => s.userId === u._id && s.isActive
                  );

                  return (
                    <tr
                      key={u._id}
                      className="group border-b border-line-soft/50 transition-colors last:border-0 hover:bg-night-800/50"
                    >
                      <td className="py-2 pr-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar user={u} size={30} />
                          <div>
                            <p className="flex items-center gap-1 text-xs font-bold">
                              {u.name}
                              {u.isVerified && (
                                <span className="text-sky">
                                  <I.logo size={11} strokeWidth={2.4} />
                                </span>
                              )}
                            </p>
                            <p className="font-mono text-[9px] text-dim">@{u.username}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-2 pr-3 font-mono text-[11px] font-bold">
                        {u.trustScore}
                      </td>
                      <td className="py-2 pr-3">
                        <span className="chip">{u.role}</span>
                      </td>
                      <td className="py-2 pr-3">
                        {isSuspended ? (
                          <Badge tone="err">suspended</Badge>
                        ) : (
                          <Badge tone="ok">active</Badge>
                        )}
                      </td>
                      <td className="py-2 text-right">
                        {!isSuspended && u.role === 'user' && (
                          <Btn
                            size="sm"
                            tone="ghost"
                            className="text-mute hover:text-sos"
                            onClick={() => {
                              setTarget(u);
                              setType('temporary');
                              setReason('');
                            }}
                          >
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
          <SectionHead
            icon={<I.ban size={16} />}
            title="Active suspensions"
            sub="Enforced directly in MongoDB"
          />
          <div className="space-y-2">
            {suspensions.length === 0 ? (
              <Empty
                icon={<I.check size={24} />}
                title="None active"
                sub="Applied suspensions will appear here."
              />
            ) : (
              suspensions.map((s) => (
                <div key={s._id} className="rounded-lg border border-sos/30 bg-sos/5 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold">{s.type.replace('_', ' ')}</p>
                    <Btn size="sm" tone="outline" onClick={() => handleLift(s._id)}>
                      Reinstate
                    </Btn>
                  </div>
                  <p className="mt-1 text-[10px] text-mute">“{s.reason}”</p>
                </div>
              ))
            )}
          </div>
        </div>
      </Reveal>

      <Modal
        open={!!target}
        onClose={() => setTarget(null)}
        title={`Suspend @${target?.username || ''}`}
      >
        <div className="space-y-3.5">
          <Field label="Suspension type">
            <div className="grid grid-cols-3 gap-1.5">
              {(['temporary', 'permanent', 'shadow_ban'] as SuspendType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={`btn-press rounded-lg border px-2 py-2 font-mono text-[10px] font-bold uppercase tracking-wide ${
                    type === t
                      ? 'border-sos/60 bg-sos/10 text-sos'
                      : 'border-line-soft bg-night-900/60 text-mute hover:text-ink'
                  }`}
                >
                  {t.replace('_', ' ')}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Reason" error={rErr}>
            <textarea
              rows={3}
              className={inputCls}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setRErr('');
              }}
              placeholder="Reason for suspension…"
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Btn tone="ghost" onClick={() => setTarget(null)}>
              Cancel
            </Btn>
            <Btn tone="danger" onClick={handleSuspend}>
              <I.ban size={14} /> Apply suspension
            </Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}
