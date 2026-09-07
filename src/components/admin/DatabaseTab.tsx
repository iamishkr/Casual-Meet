import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../../lib/api';
import { I, Btn, Badge, Empty, Reveal } from '../ui';

type CollectionKey = 'users' | 'locations' | 'emergencyContacts' | 'safeZones' | 'connections' | 'messages' | 'timers';

export default function DatabaseTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCol, setActiveCol] = useState<CollectionKey>('users');
  const [search, setSearch] = useState('');

  const fetchDb = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.admin.inspectDb();
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to inspect database. Ensure admin privileges.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDb();
  }, []);

  const counts = data?.counts || {
    users: 0,
    locations: 0,
    emergencyContacts: 0,
    safeZones: 0,
    connections: 0,
    messages: 0,
    timers: 0,
  };

  const collections = data?.collections || {};
  const currentList = (collections[activeCol] || []) as any[];

  // Filter list by search term
  const filteredList = useMemo(() => {
    if (!search.trim()) return currentList;
    const s = search.toLowerCase();
    return currentList.filter((item) => {
      const str = JSON.stringify(item).toLowerCase();
      return str.includes(s);
    });
  }, [currentList, search]);

  const downloadJson = () => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `casualmeet-mongodb-dump-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Top Database Status Header */}
      <Reveal>
        <div className="panel flex flex-wrap items-center justify-between gap-3 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-sky/30 bg-sky/10 text-sky">
              <I.database size={20} />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-[16px] font-bold">MongoDB Database Inspector</h2>
                <span className="flex items-center gap-1 rounded-full border border-safe/40 bg-safe/10 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-safe">
                  <span className="h-1.5 w-1.5 rounded-full bg-safe pulse-dot" /> Live MongoDB
                </span>
              </div>
              <p className="font-mono text-[10px] text-dim">
                Database: <strong className="text-mute">{data?.database?.name || 'casualmeet'}</strong> · Host: <strong className="text-mute">{data?.database?.host || 'localhost'}</strong> · Role-Guarded
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Btn size="sm" tone="outline" onClick={downloadJson} disabled={!data}>
              <I.bolt size={13} /> Export Raw JSON
            </Btn>
            <Btn size="sm" tone="amber" onClick={fetchDb} disabled={loading}>
              <I.refresh size={13} className={loading ? 'animate-spin' : ''} /> {loading ? 'Syncing…' : 'Refresh'}
            </Btn>
          </div>
        </div>
      </Reveal>

      {/* KPI Cards */}
      <Reveal delay={60}>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-7">
          {([
            ['users', 'Users', counts.users, '#38bdf8', 'db.users'],
            ['locations', 'Locations', counts.locations, '#3ecf8e', '2dsphere'],
            ['emergencyContacts', 'Contacts', counts.emergencyContacts, '#f43f5e', 'db.emergencycontacts'],
            ['safeZones', 'Safe Zones', counts.safeZones, '#eab308', 'db.safezones'],
            ['connections', 'Connections', counts.connections, '#a855f7', 'db.connections'],
            ['messages', 'Messages', counts.messages, '#f97316', 'db.messages'],
            ['timers', 'Timers', counts.timers, '#06b6d4', 'db.meetingtimers'],
          ] as [CollectionKey, string, number, string, string][]).map(([key, label, val, color, note]) => (
            <button
              key={key}
              onClick={() => { setActiveCol(key); setSearch(''); }}
              className={`btn-press rounded-xl border p-3 text-left transition-all ${
                activeCol === key ? 'border-amber/60 bg-amber/10 shadow-[0_0_20px_-8px_rgba(255,178,36,0.4)]' : 'border-line-soft bg-night-850 hover:border-line'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[9px] uppercase tracking-wider text-dim">{label}</span>
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
              </div>
              <p className="mt-1 font-display text-[20px] font-black leading-none" style={{ color }}>
                {val}
              </p>
              <p className="mt-1 truncate font-mono text-[8px] text-dim">{note}</p>
            </button>
          ))}
        </div>
      </Reveal>

      {/* Search Bar & Sub-Tabs */}
      <Reveal delay={100}>
        <div className="panel space-y-3 rounded-xl p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft pb-3">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-amber">
                Collection: <span className="text-ink">db.{activeCol.toLowerCase()}</span>
              </span>
              <Badge tone="info">{filteredList.length} records</Badge>
            </div>

            <div className="relative min-w-[240px] max-w-sm flex-1">
              <span className="absolute left-2.5 top-2.5 text-dim"><I.search size={13} /></span>
              <input
                type="text"
                placeholder={`Search ${activeCol} records…`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-line-soft bg-night-900 py-1.5 pl-8 pr-3 text-xs text-ink placeholder-dim focus:border-amber/60 focus:outline-none"
              />
            </div>
          </div>

          {/* Collection Content */}
          {loading && !data ? (
            <div className="py-12 text-center">
              <I.refresh size={24} className="mx-auto animate-spin text-amber" />
              <p className="mt-2 font-mono text-xs text-dim">Querying MongoDB collections…</p>
            </div>
          ) : error ? (
            <div className="rounded-lg border border-sos/40 bg-sos/10 p-4 text-center">
              <p className="font-bold text-sos">Database Query Error</p>
              <p className="mt-1 text-xs text-mute">{error}</p>
              <Btn size="sm" tone="outline" className="mt-3" onClick={fetchDb}>Retry Query</Btn>
            </div>
          ) : filteredList.length === 0 ? (
            <Empty
              icon={<I.inbox size={28} />}
              title={`No records found in db.${activeCol}`}
              sub={search ? 'No documents matched your search filter.' : 'This collection currently has 0 documents in MongoDB.'}
            />
          ) : (
            <div className="overflow-x-auto">
              {activeCol === 'users' && <UsersTable items={filteredList} />}
              {activeCol === 'locations' && <LocationsTable items={filteredList} />}
              {activeCol === 'emergencyContacts' && <ContactsTable items={filteredList} />}
              {activeCol === 'safeZones' && <SafeZonesTable items={filteredList} />}
              {activeCol === 'connections' && <ConnectionsTable items={filteredList} />}
              {activeCol === 'messages' && <MessagesTable items={filteredList} />}
              {activeCol === 'timers' && <TimersTable items={filteredList} />}
            </div>
          )}
        </div>
      </Reveal>
    </div>
  );
}

/* ================= Custom Collection Renderers ================= */

function UsersTable({ items }: { items: any[] }) {
  return (
    <table className="w-full text-left font-sans text-xs">
      <thead>
        <tr className="border-b border-line-soft font-mono text-[9px] uppercase tracking-widest text-dim">
          <th className="pb-2 pr-3">MongoDB ObjectId</th>
          <th className="pb-2 pr-3">Profile</th>
          <th className="pb-2 pr-3">Role</th>
          <th className="pb-2 pr-3">Contact</th>
          <th className="pb-2 pr-3">City</th>
          <th className="pb-2 pr-3">Trust Score</th>
          <th className="pb-2 text-right">Verification</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line-soft/40">
        {items.map((u) => (
          <tr key={u._id} className="hover:bg-night-800/40 transition-colors">
            <td className="py-2.5 pr-3 font-mono text-[10px] text-dim">{u._id}</td>
            <td className="py-2.5 pr-3">
              <p className="font-bold text-ink">{u.name}</p>
              <p className="font-mono text-[10px] text-dim">@{u.username}</p>
            </td>
            <td className="py-2.5 pr-3">
              <Badge tone={u.role === 'super_admin' ? 'warn' : u.role === 'moderator' ? 'info' : 'ok'}>
                {u.role}
              </Badge>
            </td>
            <td className="py-2.5 pr-3">
              <p className="text-mute">{u.email}</p>
              <p className="font-mono text-[10px] text-dim">{u.phone}</p>
            </td>
            <td className="py-2.5 pr-3 text-dim">{u.city || 'Bengaluru'}</td>
            <td className="py-2.5 pr-3">
              <strong className="font-mono text-sky">{u.trustScore || 100}</strong>
            </td>
            <td className="py-2.5 text-right">
              {u.isVerified ? (
                <span className="rounded bg-safe/10 px-1.5 py-0.5 font-mono text-[9px] font-bold text-safe">✓ Verified</span>
              ) : (
                <span className="rounded bg-night-800 px-1.5 py-0.5 font-mono text-[9px] text-dim">Unverified</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function LocationsTable({ items }: { items: any[] }) {
  return (
    <table className="w-full text-left font-sans text-xs">
      <thead>
        <tr className="border-b border-line-soft font-mono text-[9px] uppercase tracking-widest text-dim">
          <th className="pb-2 pr-3">User Reference</th>
          <th className="pb-2 pr-3">GeoJSON Type</th>
          <th className="pb-2 pr-3">Coordinates [Longitude, Latitude]</th>
          <th className="pb-2 pr-3">Index</th>
          <th className="pb-2 text-right">Last Ping</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line-soft/40">
        {items.map((l) => (
          <tr key={l._id} className="hover:bg-night-800/40 transition-colors">
            <td className="py-2.5 pr-3 font-mono text-[10px] text-sky">{l.userId}</td>
            <td className="py-2.5 pr-3 font-mono text-[10px] text-dim">{l.location?.type || 'Point'}</td>
            <td className="py-2.5 pr-3 font-mono text-xs font-bold text-safe">
              [{l.location?.coordinates?.join(', ') || 'N/A'}]
            </td>
            <td className="py-2.5 pr-3">
              <Badge tone="info">2dsphere indexed</Badge>
            </td>
            <td className="py-2.5 text-right font-mono text-[10px] text-dim">
              {new Date(l.updatedAt || Date.now()).toLocaleTimeString()}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ContactsTable({ items }: { items: any[] }) {
  return (
    <table className="w-full text-left font-sans text-xs">
      <thead>
        <tr className="border-b border-line-soft font-mono text-[9px] uppercase tracking-widest text-dim">
          <th className="pb-2 pr-3">User ID</th>
          <th className="pb-2 pr-3">Contact Name</th>
          <th className="pb-2 pr-3">Phone</th>
          <th className="pb-2 pr-3">Relationship</th>
          <th className="pb-2 text-right">Auto-SOS Dispatch</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line-soft/40">
        {items.map((c) => (
          <tr key={c._id} className="hover:bg-night-800/40 transition-colors">
            <td className="py-2.5 pr-3 font-mono text-[10px] text-dim">{c.userId}</td>
            <td className="py-2.5 pr-3 font-bold text-ink">{c.name}</td>
            <td className="py-2.5 pr-3 font-mono text-mute">{c.phone}</td>
            <td className="py-2.5 pr-3">
              <Badge tone="warn">{c.relationship}</Badge>
            </td>
            <td className="py-2.5 text-right">
              {c.notifyOnSos ? (
                <span className="rounded bg-safe/10 px-1.5 py-0.5 font-mono text-[9px] font-bold text-safe">ACTIVE</span>
              ) : (
                <span className="rounded bg-night-800 px-1.5 py-0.5 font-mono text-[9px] text-dim">DISABLED</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SafeZonesTable({ items }: { items: any[] }) {
  return (
    <table className="w-full text-left font-sans text-xs">
      <thead>
        <tr className="border-b border-line-soft font-mono text-[9px] uppercase tracking-widest text-dim">
          <th className="pb-2 pr-3">Name</th>
          <th className="pb-2 pr-3">Category</th>
          <th className="pb-2 pr-3">Area / Neighborhood</th>
          <th className="pb-2 pr-3">Coordinates</th>
          <th className="pb-2 text-right">Status</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line-soft/40">
        {items.map((s) => (
          <tr key={s._id} className="hover:bg-night-800/40 transition-colors">
            <td className="py-2.5 pr-3 font-bold text-ink">{s.name}</td>
            <td className="py-2.5 pr-3">
              <Badge tone={s.category === 'police_station' ? 'info' : s.category === 'hospital' ? 'err' : 'ok'}>
                {s.category.replace('_', ' ')}
              </Badge>
            </td>
            <td className="py-2.5 pr-3 text-mute">{s.area || s.address || 'Bengaluru'}</td>
            <td className="py-2.5 pr-3 font-mono text-[10px] text-dim">
              [{s.location?.coordinates?.join(', ') || 'N/A'}]
            </td>
            <td className="py-2.5 text-right">
              <span className="rounded bg-safe/10 px-1.5 py-0.5 font-mono text-[9px] font-bold text-safe">VERIFIED</span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ConnectionsTable({ items }: { items: any[] }) {
  return (
    <table className="w-full text-left font-sans text-xs">
      <thead>
        <tr className="border-b border-line-soft font-mono text-[9px] uppercase tracking-widest text-dim">
          <th className="pb-2 pr-3">Connection ID</th>
          <th className="pb-2 pr-3">Requester ID</th>
          <th className="pb-2 pr-3">Receiver ID</th>
          <th className="pb-2 pr-3">Status</th>
          <th className="pb-2 text-right">Handshake Date</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line-soft/40">
        {items.map((c) => (
          <tr key={c._id} className="hover:bg-night-800/40 transition-colors">
            <td className="py-2.5 pr-3 font-mono text-[10px] text-dim">{c._id}</td>
            <td className="py-2.5 pr-3 font-mono text-sky">{c.requesterId}</td>
            <td className="py-2.5 pr-3 font-mono text-mute">{c.receiverId}</td>
            <td className="py-2.5 pr-3">
              <Badge tone={c.status === 'accepted' ? 'ok' : c.status === 'pending' ? 'warn' : 'err'}>
                {c.status}
              </Badge>
            </td>
            <td className="py-2.5 text-right font-mono text-[10px] text-dim">
              {new Date(c.createdAt || Date.now()).toLocaleDateString()}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function MessagesTable({ items }: { items: any[] }) {
  return (
    <table className="w-full text-left font-sans text-xs">
      <thead>
        <tr className="border-b border-line-soft font-mono text-[9px] uppercase tracking-widest text-dim">
          <th className="pb-2 pr-3">Sender</th>
          <th className="pb-2 pr-3">Content Preview</th>
          <th className="pb-2 pr-3">Type</th>
          <th className="pb-2 pr-3">Safety Flags</th>
          <th className="pb-2 text-right">Status</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line-soft/40">
        {items.map((m) => (
          <tr key={m._id} className="hover:bg-night-800/40 transition-colors">
            <td className="py-2.5 pr-3 font-mono text-[10px] text-sky">{m.senderId}</td>
            <td className="py-2.5 pr-3 max-w-xs truncate font-medium text-ink">“{m.content}”</td>
            <td className="py-2.5 pr-3">
              <Badge tone="dim">{m.type || 'text'}</Badge>
            </td>
            <td className="py-2.5 pr-3">
              {m.containsSensitive ? (
                <span className="rounded bg-sos/15 px-1.5 py-0.5 font-mono text-[9px] font-bold text-sos">
                  ⚠️ PII/UPI Flagged
                </span>
              ) : (
                <span className="font-mono text-[9px] text-safe">Clean</span>
              )}
            </td>
            <td className="py-2.5 text-right font-mono text-[10px] text-dim">{m.status || 'sent'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TimersTable({ items }: { items: any[] }) {
  return (
    <table className="w-full text-left font-sans text-xs">
      <thead>
        <tr className="border-b border-line-soft font-mono text-[9px] uppercase tracking-widest text-dim">
          <th className="pb-2 pr-3">User</th>
          <th className="pb-2 pr-3">Location Name</th>
          <th className="pb-2 pr-3">Duration</th>
          <th className="pb-2 pr-3">Status</th>
          <th className="pb-2 text-right">Started At</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line-soft/40">
        {items.map((t) => (
          <tr key={t._id} className="hover:bg-night-800/40 transition-colors">
            <td className="py-2.5 pr-3 font-mono text-[10px] text-sky">{t.userId}</td>
            <td className="py-2.5 pr-3 font-bold text-ink">{t.locationName}</td>
            <td className="py-2.5 pr-3 font-mono text-mute">{t.durationMinutes} min</td>
            <td className="py-2.5 pr-3">
              <Badge tone={t.status === 'active' ? 'warn' : t.status === 'safe' ? 'ok' : 'err'}>
                {t.status}
              </Badge>
            </td>
            <td className="py-2.5 text-right font-mono text-[10px] text-dim">
              {new Date(t.startedAt || Date.now()).toLocaleTimeString()}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
