import { useEffect, useMemo, useRef, useState } from 'react';
import { engine, useEngine } from '../../lib/engine';
import { blurText, fmtTimeShort, relTime } from '../../lib/utils';
import { Avatar, Badge, Btn, Empty, I, Modal, Ticks, inputCls } from '../ui';

const SENSITIVE_SAMPLES: { label: string; text: string }[] = [
  { label: 'phone #', text: 'Call me on 98765 43210 after 6' },
  { label: 'UPI id', text: 'aisha.k@okhdfcbank works for splitting the bill' },
  { label: 'address', text: 'Come to my place — Flat 402, 12th Main, pincode 560038' },
];

export default function ChatScreen({ threadId, openThread }: { threadId: string | null; openThread: (id: string | null) => void }) {
  const state = useEngine();
  const [picker, setPicker] = useState(false);

  const myChats = useMemo(() =>
    state.chats
      .filter((c) => c.participants.includes(state.personaId))
      .sort((a, b) => b.lastMessageAt - a.lastMessageAt),
  [state.chats, state.personaId]);

  if (threadId) return <Thread chatId={threadId} back={() => openThread(null)} />;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 pt-3">
        <p className="font-display text-[15px] font-bold">Chats</p>
        <Btn size="sm" tone="outline" onClick={() => setPicker(true)}><I.plus size={13} /> New chat</Btn>
      </div>
      <p className="px-4 pt-0.5 text-[11px] text-dim">Direct messages unlock after a connection is accepted — or when both sides allow “everyone”.</p>

      <div className="mt-2 flex-1 space-y-1.5 overflow-y-auto px-3 pb-4">
        {myChats.length === 0 && (
          <div className="px-1 pt-4"><Empty icon={<I.chat size={26} />} title="No conversations yet" sub="Accept a connection request to unlock direct messaging." /></div>
        )}
        {myChats.map((chat) => {
          const otherId = chat.participants.find((p) => p !== state.personaId)!;
          const other = engine.user(otherId);
          const msgs = state.messages.filter((m) => m.chatId === chat.id);
          const last = msgs[msgs.length - 1];
          const typing = state.typing[chat.id] === otherId;
          return (
            <button key={chat.id} onClick={() => openThread(chat.id)}
              className="btn-press flex w-full items-center gap-3 rounded-xl border border-transparent px-2 py-2 text-left transition-colors hover:border-line-soft hover:bg-night-800/70">
              <Avatar user={other} size={42} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="flex items-center gap-1 truncate font-display text-sm font-bold">
                    {other.name}
                    {other.isVerified && <span className="text-sky"><I.logo size={11} strokeWidth={2.4} /></span>}
                  </span>
                  {last && <span className="shrink-0 font-mono text-[10px] text-dim">{relTime(last.sentAt)}</span>}
                </div>
                {typing ? (
                  <span className="flex items-center gap-1 text-[11px] font-medium text-safe">typing
                    <span className="pulse-dot">·</span><span className="pulse-dot" style={{ animationDelay: '0.2s' }}>·</span><span className="pulse-dot" style={{ animationDelay: '0.4s' }}>·</span>
                  </span>
                ) : last ? (
                  <span className="block truncate text-xs text-mute">
                    {last.senderId === state.personaId && <span className="text-dim">You: </span>}
                    {last.containsSensitive ? <span className="font-mono text-[11px] text-amber">⚠ {blurText(last.content)}</span> : last.content}
                  </span>
                ) : <span className="text-xs text-dim">Say hello 👋</span>}
              </div>
              <I.chevL size={14} className="rotate-180 text-dim" />
            </button>
          );
        })}
      </div>

      <Modal open={picker} onClose={() => setPicker(false)} title="Start a chat">
        <p className="mb-3 text-xs text-mute">The server re-checks the connection gate before opening a thread. Try a non-connection to see it refuse.</p>
        <div className="max-h-72 space-y-1 overflow-y-auto">
          {[...state.users]
            .filter((u) => u.id !== state.personaId && u.onboardingComplete && u.role === 'user' && !engine.activeSuspension(u.id))
            .map((u) => {
              const conn = engine.connBetween(state.personaId, u.id);
              const allowed = (conn?.status === 'accepted') || (engine.persona().allowMessages === 'everyone' && u.allowMessages === 'everyone');
              return (
                <button key={u.id}
                  onClick={() => { const id = engine.openChatWith(u.id); if (id) { openThread(id); setPicker(false); } }}
                  className="btn-press flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-night-750/70">
                  <Avatar user={u} size={32} />
                  <span className="flex-1 truncate text-sm font-semibold">{u.name}</span>
                  {allowed ? <Badge tone="ok">gate open</Badge> : <Badge tone="dim"><I.lock size={9} /> gated</Badge>}
                </button>
              );
            })}
        </div>
      </Modal>
    </div>
  );
}

function Thread({ chatId, back }: { chatId: string; back: () => void }) {
  const state = useEngine();
  const chat = state.chats.find((c) => c.id === chatId)!;
  const otherId = chat.participants.find((p) => p !== state.personaId)!;
  const other = engine.user(otherId);
  const [text, setText] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const msgs = state.messages.filter((m) => m.chatId === chatId);
  const typing = state.typing[chatId] === otherId;

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs.length, typing]);

  const conn = engine.connBetween(state.personaId, otherId);
  const gate = conn?.status === 'accepted' ? 'connected' : 'both allow everyone';

  const send = (t?: string) => {
    const body = t ?? text;
    if (!body.trim()) return;
    engine.sendMessage(chatId, body);
    setText('');
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 border-b border-line-soft px-3 py-2.5">
        <button onClick={back} className="btn-press rounded-md p-1 text-mute hover:bg-night-750 hover:text-ink"><I.chevL size={16} /></button>
        <Avatar user={other} size={34} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-sm font-bold">{other.name}</p>
          <p className="text-[10px] text-dim">@{other.username} · gate: {gate}</p>
        </div>
        {typing && <span className="chip text-safe">typing…</span>}
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
        <div className="mx-auto w-fit rounded-full border border-line-soft bg-night-800/60 px-3 py-1 text-center font-mono text-[9px] uppercase tracking-widest text-dim">
          server scans every message before persist
        </div>
        {msgs.map((m) => {
          const mine = m.senderId === state.personaId;
          const revealed = m.revealedBy?.includes(state.personaId);
          return (
            <div key={m.id} className={`anim-rise flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-[13px] leading-snug ${mine ? 'rounded-br-md bg-amber/90 text-night-950' : 'rounded-bl-md border border-line-soft bg-night-800 text-ink'}`}>
                {m.containsSensitive && !revealed ? (
                  <button onClick={() => engine.revealMessage(m.id)}
                    className={`btn-press block w-full rounded-lg border border-dashed px-2 py-1 text-left ${mine ? 'border-night-950/40' : 'border-amber/40'}`}>
                    <span className={`mb-1 flex items-center gap-1 font-mono text-[9px] uppercase tracking-widest ${mine ? 'text-night-950/70' : 'text-amber'}`}>
                      <I.shield size={10} /> sensitive · {m.sensitiveKinds.join(' + ')} · tap to reveal
                    </span>
                    <span className={`font-mono text-xs tracking-wider ${mine ? 'text-night-950/50' : 'text-dim'}`}>{blurText(m.content)}</span>
                  </button>
                ) : (
                  <>
                    {m.containsSensitive && (
                      <span className="mb-1 flex items-center gap-1 font-mono text-[9px] uppercase tracking-widest text-sos">
                        <I.alert size={10} /> contained {m.sensitiveKinds.join(', ')} — revealed, audit logged
                      </span>
                    )}
                    {m.content}
                  </>
                )}
                <span className={`mt-0.5 flex items-center justify-end gap-1 font-mono text-[9px] ${mine ? 'text-night-950/60' : 'text-dim'}`}>
                  {fmtTimeShort(m.sentAt)} {mine && <Ticks status={m.status} />}
                </span>
              </div>
            </div>
          );
        })}
        {typing && (
          <div className="flex justify-start">
            <div className="flex items-center gap-1 rounded-2xl rounded-bl-md border border-line-soft bg-night-800 px-3 py-2.5">
              {[0, 1, 2].map((i) => <span key={i} className="pulse-dot inline-block h-1.5 w-1.5 rounded-full bg-mute" style={{ animationDelay: `${i * 0.18}s` }} />)}
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="border-t border-line-soft p-2.5">
        <div className="mb-2 flex gap-1.5 overflow-x-auto">
          {SENSITIVE_SAMPLES.map((s) => (
            <button key={s.label} onClick={() => send(s.text)}
              className="btn-press chip shrink-0 text-amber hover:border-amber/50">try: {s.label}</button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input value={text} onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder={`Message ${other.name.split(' ')[0]}…`} className={inputCls} />
          <Btn tone="amber" size="md" className="shrink-0 !px-3" onClick={() => send()} disabled={!text.trim()} aria-label="Send">
            <I.send size={15} />
          </Btn>
        </div>
      </div>
    </div>
  );
}
