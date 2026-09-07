import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useToast } from '../../context/ToastContext';
import { I, Btn, Badge, Empty, Reveal, Avatar, Modal, Field, inputCls } from '../ui';
import type { SuspendType } from '../../lib/types';

export default function SuspiciousTab() {
  const { toast } = useToast();
  const [data, setData] = useState<{
    flaggedMessages: any[];
    lowTrustUsers: any[];
    activeTimers: any[];
    recentSuspensions: any[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  // Moderation action modal state
  const [actionUser, setActionUser] = useState<any | null>(null);
  const [suspendType, setSuspendType] = useState<SuspendType>('temporary');
  const [reason, setReason] = useState('');
  const [reasonErr, setReasonErr] = useState('');

  const fetchSuspicious = async () => {
    setLoading(true);
    try {
      const res = await api.admin.getSuspiciousActivity();
      setData(res);
    } catch {
      setData({
        flaggedMessages: [],
        lowTrustUsers: [],
        activeTimers: [],
        recentSuspensions: [],
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuspicious();
  }, []);

  const handleApplyAction = async () => {
    if (reason.trim().length < 6) {
      setReasonErr('A detailed audit reason is required (≥ 6 characters)');
      return;
    }

    try {
      await api.admin.suspendUser(actionUser._id || actionUser.id, suspendType, reason.trim(), 7);
      toast('warn', `Action applied against @${actionUser.username}`, `${suspendType.replace('_', ' ')} enforced.`);
      setActionUser(null);
      setReason('');
      setReasonErr('');
      fetchSuspicious();
    } catch (err: any) {
      setReasonErr(err.message || 'Failed to apply suspension');
    }
  };

  const flagged = data?.flaggedMessages || [];
  const lowTrust = data?.lowTrustUsers || [];
  const activeTimers = data?.activeTimers || [];

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <Reveal>
        <div className="panel flex flex-wrap items-center justify-between gap-3 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber/30 bg-amber/10 text-amber">
              <I.alertTriangle size={20} />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-[16px] font-bold">Suspicious Activity & Security Watch</h2>
                <Badge tone="warn">{flagged.length + lowTrust.length} alerts flagged</Badge>
              </div>
              <p className="font-mono text-[10px] text-dim">
                Real-time AI scanner · PII/UPI financial leak detector · Rapid travel anomaly guard
              </p>
            </div>
          </div>

          <Btn size="sm" tone="amber" onClick={fetchSuspicious} disabled={loading}>
            <I.refresh size={13} className={loading ? 'animate-spin' : ''} /> {loading ? 'Scanning…' : 'Re-Scan'}
          </Btn>
        </div>
      </Reveal>

      {/* Grid of Monitors */}
      <div className="grid gap-4 xl:grid-cols-2">
        {/* Flagged Sensitive Chat Messages */}
        <Reveal delay={60}>
          <div className="panel flex h-full flex-col rounded-xl p-4">
            <div className="mb-3 flex items-center justify-between border-b border-line-soft pb-2.5">
              <div className="flex items-center gap-2">
                <span className="text-sos"><I.alertTriangle size={16} /></span>
                <div>
                  <h3 className="font-display text-[14px] font-bold">Flagged Chat Messages</h3>
                  <p className="font-mono text-[9px] text-dim">PII leaks, UPI handles, unapproved payment solicitations</p>
                </div>
              </div>
              <Badge tone={flagged.length > 0 ? 'err' : 'ok'}>{flagged.length} flagged</Badge>
            </div>

            <div className="flex-1 space-y-2.5 overflow-y-auto" style={{ maxHeight: 420 }}>
              {flagged.length === 0 ? (
                <Empty icon={<I.shield size={26} />} title="All chat streams clean" sub="No sensitive payment IDs or phone numbers detected in recent messages." />
              ) : (
                flagged.map((m) => {
                  const sender = m.senderId?.name ? m.senderId : { name: 'User', username: 'user' };
                  return (
                    <div key={m._id || m.id} className="rounded-lg border border-sos/30 bg-sos/5 p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Avatar user={sender} size={24} />
                          <div>
                            <span className="font-bold text-xs">{sender?.name || 'User'}</span>
                            <span className="ml-1 font-mono text-[10px] text-dim">@{sender?.username || 'user'}</span>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          {(m.sensitiveKinds || ['upi', 'phone']).map((k: string) => (
                            <span key={k} className="rounded bg-sos/20 px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase text-sos">
                              {k} leak
                            </span>
                          ))}
                        </div>
                      </div>

                      <p className="mt-2 rounded bg-night-900/80 p-2 font-mono text-xs text-ink">
                        “{m.content}”
                      </p>

                      <div className="mt-2.5 flex items-center justify-between border-t border-line-soft/40 pt-2 text-[10px]">
                        <span className="font-mono text-dim">{new Date(m.createdAt).toLocaleTimeString()}</span>
                        <div className="flex gap-1.5">
                          <Btn size="sm" tone="outline" onClick={() => { setActionUser(sender); setSuspendType('temporary'); }}>
                            <I.alert size={12} /> Issue Warning
                          </Btn>
                          <Btn size="sm" tone="danger" onClick={() => { setActionUser(sender); setSuspendType('temporary'); }}>
                            <I.ban size={12} /> Suspend 7D
                          </Btn>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </Reveal>

        {/* High Risk / Low Trust Score Profiles */}
        <Reveal delay={100}>
          <div className="panel flex h-full flex-col rounded-xl p-4">
            <div className="mb-3 flex items-center justify-between border-b border-line-soft pb-2.5">
              <div className="flex items-center gap-2">
                <span className="text-amber"><I.id size={16} /></span>
                <div>
                  <h3 className="font-display text-[14px] font-bold">Low Trust Watchlist</h3>
                  <p className="font-mono text-[9px] text-dim">Accounts with trust score &lt; 90 or multiple blockings</p>
                </div>
              </div>
              <Badge tone="warn">{lowTrust.length} profiles</Badge>
            </div>

            <div className="flex-1 space-y-2.5 overflow-y-auto" style={{ maxHeight: 420 }}>
              {lowTrust.length === 0 ? (
                <Empty icon={<I.check size={26} />} title="Network health optimal" sub="No active accounts currently below the minimum trust safety threshold." />
              ) : (
                lowTrust.map((u) => (
                  <div key={u._id || u.id} className="flex items-center justify-between rounded-lg border border-line-soft bg-night-850 p-3">
                    <div className="flex items-center gap-3">
                      <Avatar user={u} size={36} />
                      <div>
                        <p className="font-bold text-xs">{u.name} <span className="font-mono text-[10px] text-dim">@{u.username}</span></p>
                        <p className="font-mono text-[9px] text-mute">{u.phone} · {u.city || 'Bengaluru'}</p>
                        <div className="mt-1 flex items-center gap-2">
                          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-night-950">
                            <div className="h-full bg-sos" style={{ width: `${Math.min(100, u.trustScore || 60)}%` }} />
                          </div>
                          <span className="font-mono text-[10px] font-bold text-sos">{u.trustScore || 60} Trust</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-1.5">
                      <Btn size="sm" tone="outline" onClick={() => { setActionUser(u); setSuspendType('shadow_ban'); }}>
                        Shadow-Ban
                      </Btn>
                      <Btn size="sm" tone="danger" onClick={() => { setActionUser(u); setSuspendType('temporary'); }}>
                        Suspend
                      </Btn>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </Reveal>
      </div>

      {/* Active Monitored Meeting Timers Across City */}
      <Reveal delay={140}>
        <div className="panel rounded-xl p-4">
          <div className="mb-3 flex items-center justify-between border-b border-line-soft pb-2.5">
            <div className="flex items-center gap-2">
              <span className="text-sky"><I.timer size={16} /></span>
              <div>
                <h3 className="font-display text-[14px] font-bold">Active Live Meeting Timers</h3>
                <p className="font-mono text-[9px] text-dim">Monitored meetups currently underway — auto-escalates to SOS if check-in fails</p>
              </div>
            </div>
            <Badge tone="info">{activeTimers.length} active meetups</Badge>
          </div>

          {activeTimers.length === 0 ? (
            <p className="py-4 text-center font-mono text-xs text-dim">
              No active meeting timers running right now across the network.
            </p>
          ) : (
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {activeTimers.map((t) => (
                <div key={t._id || t.id} className="rounded-lg border border-sky/30 bg-sky/5 p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs">{t.locationName}</span>
                    <span className="rounded bg-sky/20 px-1.5 py-0.5 font-mono text-[9px] font-bold text-sky">
                      {t.durationMinutes} min timer
                    </span>
                  </div>
                  <p className="mt-1 font-mono text-[10px] text-dim">
                    User: <strong className="text-ink">{t.userId?.name || t.userId}</strong>
                    {t.meetWithUserId && ` with @${t.meetWithUserId.username || 'partner'}`}
                  </p>
                  <p className="mt-2 font-mono text-[9px] text-mute">
                    Started: {new Date(t.startedAt).toLocaleTimeString()} · Expires in: {Math.max(1, Math.round((new Date(t.expiresAt).getTime() - Date.now()) / 60000))}m
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </Reveal>

      {/* Moderation Enforcement Modal */}
      <Modal open={!!actionUser} onClose={() => setActionUser(null)} title={`Take Enforcement Action: ${actionUser?.name || ''}`}>
        <div className="space-y-4">
          <p className="text-xs text-mute">
            Select an action against <strong className="text-ink">@{actionUser?.username}</strong>. This applies immediately across the database and will revoke session tokens.
          </p>

          <Field label="Enforcement Action">
            <div className="space-y-1.5">
              {([
                ['temporary', '7-Day Temporary Suspension', 'Account rejected at auth middleware for 7 days', 'err'],
                ['shadow_ban', 'Shadow-Ban Account', 'User thinks they are active, but hidden from discovery', 'warn'],
                ['permanent', 'Permanent Account Ban', 'Irreversible removal from community network', 'err'],
              ] as [SuspendType, string, string, string][]).map(([val, label, desc, tone]) => (
                <button
                  key={val}
                  onClick={() => setSuspendType(val)}
                  className={`btn-press w-full rounded-lg border p-2.5 text-left transition-all ${
                    suspendType === val ? 'border-amber/60 bg-amber/10' : 'border-line-soft bg-night-900/60 hover:border-line'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold">{label}</p>
                    <Badge tone={tone}>{val}</Badge>
                  </div>
                  <p className="mt-0.5 text-[10px] text-dim">{desc}</p>
                </button>
              ))}
            </div>
          </Field>

          <Field label="Audit Reason (Mandatory)" error={reasonErr}>
            <textarea
              rows={3}
              className={inputCls}
              value={reason}
              onChange={(e) => { setReason(e.target.value); setReasonErr(''); }}
              placeholder="State the observed policy violation (e.g. Solicited off-platform UPI payments in direct chat)..."
            />
          </Field>

          <div className="flex justify-end gap-2">
            <Btn tone="ghost" onClick={() => setActionUser(null)}>Cancel</Btn>
            <Btn tone="amber" onClick={handleApplyAction}>Enforce Action</Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}
