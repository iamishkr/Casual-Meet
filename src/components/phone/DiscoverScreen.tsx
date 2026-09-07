import { useEffect, useMemo, useState } from 'react';
import { engine, useEngine } from '../../lib/engine';
import { fmtDistance } from '../../lib/utils';
import { Avatar, Badge, Btn, Empty, I, Seg } from '../ui';

export default function DiscoverScreen({ goChat }: { goChat: (userId: string) => void }) {
  const state = useEngine();
  const [maxKm, setMaxKm] = useState(9);
  const [mode, setMode] = useState<'nearby' | 'requests'>('nearby');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => setLoading(false), 420);
    return () => clearTimeout(t);
  }, [maxKm, state.personaId]);

  const cards = useMemo(() => engine.discover(maxKm), [state, maxKm]); // eslint-disable-line react-hooks/exhaustive-deps
  const incoming = state.connections.filter((c) => c.receiverId === state.personaId && c.status === 'pending');
  const outgoing = state.connections.filter((c) => c.requesterId === state.personaId && c.status === 'pending');

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-3 px-4 pt-3">
        <div className="flex items-center justify-between">
          <Seg size="sm" value={mode} onChange={setMode} options={[
            { value: 'nearby', label: <span className="flex items-center gap-1.5"><I.radar size={13} /> Nearby</span> },
            { value: 'requests', label: <span className="flex items-center gap-1.5"><I.inbox size={13} /> Requests{incoming.length > 0 && <span className="rounded-full bg-sos px-1.5 text-[10px] font-bold text-night-950">{incoming.length}</span>}</span> },
          ]} />
          {mode === 'nearby' && (
            <span className="chip"><I.pin size={10} className="text-amber" /> $geoNear · 2dsphere</span>
          )}
        </div>

        {mode === 'nearby' && (
          <div className="rounded-xl border border-line-soft bg-night-800/50 p-3">
            <div className="mb-1 flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-dim">
              <span>Search radius</span>
              <span className="text-amber">{maxKm} km</span>
            </div>
            <input type="range" min={1} max={25} value={maxKm} onChange={(e) => setMaxKm(+e.target.value)}
              className="w-full accent-[#ffb224]" />
          </div>
        )}
      </div>

      <div className="mt-3 flex-1 space-y-2.5 overflow-y-auto px-4 pb-4">
        {mode === 'nearby' ? (
          loading ? (
            [0, 1, 2].map((i) => (
              <div key={i} className="shimmer h-[124px] rounded-2xl border border-line-soft" />
            ))
          ) : cards.length === 0 ? (
            <Empty icon={<I.radar size={26} />} title="No one in this radius"
              sub="Widen the radius, or note that hidden, suspended and onboarding users are excluded by the pipeline." />
          ) : (
            cards.map(({ user, distanceKm, conn }, i) => (
              <div key={user.id} className="anim-rise rounded-2xl border border-line-soft bg-night-800/60 p-3 transition-colors hover:border-amber/30"
                style={{ animationDelay: `${i * 55}ms` }}>
                <div className="flex gap-3">
                  <Avatar user={user} size={46} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate font-display text-[15px] font-bold">{user.name}, {user.age}</span>
                      {user.isVerified && <span title="Identity verified" className="text-sky"><I.logo size={13} strokeWidth={2.2} /></span>}
                    </div>
                    <p className="truncate text-xs text-mute">{user.occupation} · {user.city}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className="chip text-amber"><I.pin size={10} />{fmtDistance(distanceKm)}</span>
                      <span className="chip">trust {user.trustScore}</span>
                      {user.interests.slice(0, 2).map((t) => <span key={t} className="chip">{t}</span>)}
                    </div>
                  </div>
                </div>
                <div className="mt-2.5 flex items-center justify-between border-t border-line-soft pt-2.5">
                  <span className="font-mono text-[9px] uppercase tracking-widest text-dim">coords redacted</span>
                  {!conn ? (
                    <Btn size="sm" tone="amber" onClick={() => engine.requestConnection(user.id)}><I.plus size={13} /> Connect</Btn>
                  ) : conn.status === 'accepted' ? (
                    <div className="flex items-center gap-1.5">
                      <Badge tone="ok">connected</Badge>
                      <Btn size="sm" tone="outline" onClick={() => goChat(user.id)}><I.chat size={13} /> Message</Btn>
                    </div>
                  ) : conn.status === 'pending' ? (
                    conn.direction === 'out'
                      ? <Btn size="sm" tone="ghost" onClick={() => engine.cancelConnection(conn.id)} className="text-amber hover:text-amber">Requested · cancel</Btn>
                      : <Btn size="sm" tone="safe" onClick={() => engine.acceptConnection(conn.id)}><I.check size={13} /> Accept</Btn>
                  ) : <Badge tone="dim">{conn.status}</Badge>}
                </div>
              </div>
            ))
          )
        ) : (
          <div className="space-y-4">
            <div>
              <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-dim">Incoming · receiver decides</p>
              {incoming.length === 0 ? (
                <Empty icon={<I.inbox size={24} />} title="No incoming requests" sub="When someone sends you a request, accept or reject it here." />
              ) : incoming.map((c) => {
                const u = engine.user(c.requesterId);
                return (
                  <div key={c.id} className="anim-rise mb-2 rounded-2xl border border-line-soft bg-night-800/60 p-3">
                    <div className="flex items-center gap-3">
                      <Avatar user={u} size={40} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-display text-sm font-bold">{u.name}</p>
                        <p className="truncate text-[11px] text-mute">@{u.username} · wants to connect</p>
                      </div>
                    </div>
                    <div className="mt-2.5 flex gap-2">
                      <Btn size="sm" tone="safe" className="flex-1" onClick={() => engine.acceptConnection(c.id)}><I.check size={13} /> Accept</Btn>
                      <Btn size="sm" tone="outline" className="flex-1" onClick={() => engine.rejectConnection(c.id)}><I.x size={13} /> Reject</Btn>
                    </div>
                  </div>
                );
              })}
            </div>
            <div>
              <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-dim">Outgoing · you can cancel</p>
              {outgoing.length === 0 ? (
                <Empty icon={<I.send size={24} />} title="Nothing pending" sub="Requests you send appear here until accepted or cancelled." />
              ) : outgoing.map((c) => {
                const u = engine.user(c.receiverId);
                return (
                  <div key={c.id} className="mb-2 flex items-center gap-3 rounded-2xl border border-line-soft bg-night-800/60 p-3">
                    <Avatar user={u} size={36} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{u.name}</p>
                      <p className="text-[11px] text-dim">awaiting their decision</p>
                    </div>
                    <Btn size="sm" tone="ghost" onClick={() => engine.cancelConnection(c.id)}>Cancel</Btn>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 border-t border-line-soft px-4 py-2">
        <I.lock size={12} className="shrink-0 text-safe" />
        <p className="text-[10px] leading-snug text-dim">Exact coordinates never leave the API — only distance, city and public profile fields.</p>
      </div>
    </div>
  );
}
