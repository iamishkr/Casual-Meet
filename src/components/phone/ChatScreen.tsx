import { useEffect, useRef, useState, useCallback } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { getSocket, joinChatRoom, leaveChatRoom, emitTyping } from '../../lib/socket';
import { blurText, fmtTimeShort, relTime } from '../../lib/utils';
import { Avatar, Badge, Btn, Empty, I, Modal, Ticks, inputCls } from '../ui';

const SENSITIVE_SAMPLES: { label: string; text: string }[] = [
  { label: 'phone #', text: 'Call me on 98765 43210 after 6' },
  { label: 'UPI id', text: 'aisha.k@okhdfcbank works for splitting the bill' },
  { label: 'address', text: 'Come to my place — Flat 402, 12th Main, pincode 560038' },
];

export default function ChatScreen({
  threadId,
  openThread,
}: {
  threadId: string | null;
  openThread: (id: string | null) => void;
}) {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [chats, setChats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [picker, setPicker] = useState(false);
  const [connections, setConnections] = useState<any[]>([]);

  const fetchChats = useCallback(async () => {
    try {
      const res = await api.chats.list();
      setChats(Array.isArray(res) ? res : []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchConnections = useCallback(async () => {
    try {
      const res = await api.connections.list();
      setConnections(Array.isArray(res) ? res : []);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  // Listen for socket new_message to update conversations list timestamp
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleNewMessage = () => {
      fetchChats();
    };

    socket.on('new_message', handleNewMessage);
    return () => {
      socket.off('new_message', handleNewMessage);
    };
  }, [fetchChats]);

  const handleOpenPicker = () => {
    fetchConnections();
    setPicker(true);
  };

  if (threadId) return <Thread chatId={threadId} back={() => openThread(null)} />;

  const myId = currentUser?.id || '';

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 pt-3">
        <p className="font-display text-[15px] font-bold">Chats</p>
        <Btn size="sm" tone="outline" onClick={handleOpenPicker}>
          <I.plus size={13} /> New chat
        </Btn>
      </div>
      <p className="px-4 pt-0.5 text-[11px] text-dim">
        Direct messages unlock after a connection is accepted — backed by real-time WebSockets & MongoDB.
      </p>

      <div className="mt-2 flex-1 space-y-1.5 overflow-y-auto px-3 pb-4">
        {loading ? (
          <div className="space-y-2 pt-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="shimmer h-[64px] rounded-xl border border-line-soft" />
            ))}
          </div>
        ) : chats.length === 0 ? (
          <div className="px-1 pt-4">
            <Empty
              icon={<I.chat size={26} />}
              title="No conversations yet"
              sub="Accept a connection request or start a chat with one of your verified connections."
            />
          </div>
        ) : (
          chats.map((chat) => {
            const other =
              chat.participants?.find((p: any) => (p._id || p.id) !== myId) ||
              { name: 'Unknown', username: 'user' };
            const lastMessageAt = chat.lastMessageAt || chat.updatedAt || chat.createdAt;

            return (
              <button
                key={chat._id || chat.id}
                onClick={() => openThread(chat._id || chat.id)}
                className="btn-press flex w-full items-center gap-3 rounded-xl border border-transparent px-2 py-2 text-left transition-colors hover:border-line-soft hover:bg-night-800/70"
              >
                <Avatar user={other} size={42} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="flex items-center gap-1 truncate font-display text-sm font-bold">
                      {other.name}
                      {other.isVerified && (
                        <span className="text-sky">
                          <I.logo size={11} strokeWidth={2.4} />
                        </span>
                      )}
                    </span>
                    {lastMessageAt && (
                      <span className="shrink-0 font-mono text-[10px] text-dim">
                        {relTime(new Date(lastMessageAt).getTime())}
                      </span>
                    )}
                  </div>
                  <span className="block truncate text-xs text-mute">
                    Open conversation…
                  </span>
                </div>
                <I.chevL size={14} className="rotate-180 text-dim" />
              </button>
            );
          })
        )}
      </div>

      <Modal open={picker} onClose={() => setPicker(false)} title="Start a chat">
        <p className="mb-3 text-xs text-mute">
          Direct messaging is protected by backend connection authorization. Select an accepted connection:
        </p>
        <div className="max-h-72 space-y-1 overflow-y-auto">
          {connections
            .filter((c) => c.status === 'accepted')
            .map((conn) => {
              const other =
                (conn.requesterId?._id || conn.requesterId) === myId
                  ? conn.receiverId
                  : conn.requesterId;
              if (!other) return null;

              return (
                <button
                  key={conn._id || conn.id}
                  onClick={async () => {
                    // Accept/ensure chat exists
                    try {
                      const res = await api.connections.accept(conn._id || conn.id);
                      if (res?.chatId) {
                        openThread(res.chatId);
                        setPicker(false);
                      }
                    } catch (err: any) {
                      toast('err', 'Could not open chat', err.message);
                    }
                  }}
                  className="btn-press flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-night-750/70"
                >
                  <Avatar user={other} size={32} />
                  <span className="flex-1 truncate text-sm font-semibold">{other.name}</span>
                  <Badge tone="ok">connected</Badge>
                </button>
              );
            })}
          {connections.filter((c) => c.status === 'accepted').length === 0 && (
            <p className="py-4 text-center text-xs text-mute">
              No accepted connections yet. Go to Discover to connect with people first.
            </p>
          )}
        </div>
      </Modal>
    </div>
  );
}

function Thread({ chatId, back }: { chatId: string; back: () => void }) {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [otherUser, setOtherUser] = useState<any>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<any>(null);

  const myId = currentUser?.id || '';

  // Load message history from backend
  const fetchMessages = useCallback(async () => {
    try {
      const res = await api.chats.getMessages(chatId);
      setMessages(Array.isArray(res) ? res : []);
    } catch (err: any) {
      toast('err', 'Failed to load messages', err.message);
    } finally {
      setLoading(false);
    }
  }, [chatId, toast]);

  // Load chat details to find the conversation partner
  useEffect(() => {
    api.chats.list().then((chats) => {
      const found = chats.find((c) => (c._id || c.id) === chatId);
      if (found && found.participants) {
        const other = found.participants.find((p: any) => (p._id || p.id) !== myId);
        if (other) setOtherUser(other);
      }
    }).catch(() => {});
  }, [chatId, myId]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Socket.io real-time connection for this chat
  useEffect(() => {
    joinChatRoom(chatId);
    const socket = getSocket();

    const handleNewMessage = (payload: any) => {
      if (payload?.chatId === chatId && payload?.message) {
        const incoming = payload.message;
        setMessages((prev) => {
          // Deduplicate by message _id
          const exists = prev.some((m) => (m._id || m.id) === (incoming._id || incoming.id));
          if (exists) return prev;
          return [...prev, incoming];
        });
      }
    };

    const handleTyping = (data: any) => {
      if (data?.chatId === chatId && data?.userId !== myId) {
        setOtherTyping(data.typing);
      }
    };

    if (socket) {
      socket.on('new_message', handleNewMessage);
      socket.on('typing', handleTyping);
    }

    return () => {
      leaveChatRoom(chatId);
      if (socket) {
        socket.off('new_message', handleNewMessage);
        socket.off('typing', handleTyping);
      }
    };
  }, [chatId, myId]);

  // Auto-scroll on new messages
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, otherTyping]);

  const handleSend = async (contentToSend?: string) => {
    const body = (contentToSend ?? text).trim();
    if (!body || sending) return;

    setSending(true);
    try {
      const res = await api.chats.sendMessage(chatId, body);
      if (res?.message) {
        const savedMsg = res.message;
        setMessages((prev) => {
          const exists = prev.some((m) => (m._id || m.id) === (savedMsg._id || savedMsg.id));
          if (exists) return prev;
          return [...prev, savedMsg];
        });
        setText('');
        if (res.flagged) {
          toast('warn', 'Sensitive Data Flagged', 'Sensitive content scanned and protected.');
        }
      }
    } catch (err: any) {
      toast('err', 'Failed to Send', err.message);
    } finally {
      setSending(false);
      if (otherUser) {
        emitTyping(chatId, otherUser._id || otherUser.id, false);
      }
    }
  };

  const handleReveal = async (messageId: string) => {
    try {
      const updated = await api.chats.revealMessage(messageId);
      setMessages((prev) =>
        prev.map((m) => ((m._id || m.id) === (updated._id || updated.id) ? updated : m))
      );
      toast('info', 'Message Revealed', 'Audit logged for safety compliance.');
    } catch (err: any) {
      toast('err', 'Could Not Reveal', err.message);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setText(e.target.value);
    if (otherUser) {
      emitTyping(chatId, otherUser._id || otherUser.id, true);
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        emitTyping(chatId, otherUser._id || otherUser.id, false);
      }, 2000);
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-2.5 border-b border-line-soft px-3 py-2.5">
        <button
          onClick={back}
          className="btn-press rounded-md p-1 text-mute hover:bg-night-750 hover:text-ink"
        >
          <I.chevL size={16} />
        </button>
        {otherUser && <Avatar user={otherUser} size={34} />}
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-sm font-bold">
            {otherUser?.name || 'Chat'}
          </p>
          <p className="text-[10px] text-dim">
            @{otherUser?.username || 'user'} · encrypted in transit
          </p>
        </div>
        {otherTyping && <span className="chip text-safe">typing…</span>}
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
        <div className="mx-auto w-fit rounded-full border border-line-soft bg-night-800/60 px-3 py-1 text-center font-mono text-[9px] uppercase tracking-widest text-dim">
          server scans every message before persist
        </div>

        {loading ? (
          <div className="space-y-2 py-4">
            {[0, 1].map((i) => (
              <div key={i} className="shimmer h-[48px] rounded-xl border border-line-soft" />
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="py-8 text-center text-xs text-mute">
            Say hello to start the conversation! 👋
          </div>
        ) : (
          messages.map((m) => {
            const senderId = m.senderId?._id || m.senderId;
            const mine = senderId === myId;
            const revealed = m.revealedBy?.some((id: any) => (id?._id || id) === myId);
            const msgId = m._id || m.id;

            return (
              <div
                key={msgId}
                className={`anim-rise flex ${mine ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-3 py-2 text-[13px] leading-snug ${
                    mine
                      ? 'rounded-br-md bg-amber/90 text-night-950'
                      : 'rounded-bl-md border border-line-soft bg-night-800 text-ink'
                  }`}
                >
                  {m.containsSensitive && !revealed ? (
                    <button
                      onClick={() => handleReveal(msgId)}
                      className={`btn-press block w-full rounded-lg border border-dashed px-2 py-1 text-left ${
                        mine ? 'border-night-950/40' : 'border-amber/40'
                      }`}
                    >
                      <span
                        className={`mb-1 flex items-center gap-1 font-mono text-[9px] uppercase tracking-widest ${
                          mine ? 'text-night-950/70' : 'text-amber'
                        }`}
                      >
                        <I.shield size={10} /> sensitive · {m.sensitiveKinds?.join(' + ') || 'PII'} · tap to reveal
                      </span>
                      <span
                        className={`font-mono text-xs tracking-wider ${
                          mine ? 'text-night-950/50' : 'text-dim'
                        }`}
                      >
                        {blurText(m.content)}
                      </span>
                    </button>
                  ) : (
                    <>
                      {m.containsSensitive && (
                        <span className="mb-1 flex items-center gap-1 font-mono text-[9px] uppercase tracking-widest text-sos">
                          <I.alert size={10} /> contained {m.sensitiveKinds?.join(', ')} — revealed, audit logged
                        </span>
                      )}
                      {m.content}
                    </>
                  )}
                  <span
                    className={`mt-0.5 flex items-center justify-end gap-1 font-mono text-[9px] ${
                      mine ? 'text-night-950/60' : 'text-dim'
                    }`}
                  >
                    {fmtTimeShort(new Date(m.createdAt || m.sentAt || Date.now()).getTime())}{' '}
                    {mine && <Ticks status={m.status || 'sent'} />}
                  </span>
                </div>
              </div>
            );
          })
        )}
        {otherTyping && (
          <div className="flex justify-start">
            <div className="flex items-center gap-1 rounded-2xl rounded-bl-md border border-line-soft bg-night-800 px-3 py-2.5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="pulse-dot inline-block h-1.5 w-1.5 rounded-full bg-mute"
                  style={{ animationDelay: `${i * 0.18}s` }}
                />
              ))}
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="border-t border-line-soft p-2.5">
        <div className="mb-2 flex gap-1.5 overflow-x-auto">
          {SENSITIVE_SAMPLES.map((s) => (
            <button
              key={s.label}
              onClick={() => handleSend(s.text)}
              className="btn-press chip shrink-0 text-amber hover:border-amber/50"
            >
              try: {s.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            value={text}
            onChange={handleInputChange}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={otherUser ? `Message ${otherUser.name.split(' ')[0]}…` : 'Message…'}
            className={inputCls}
            disabled={sending}
          />
          <Btn
            tone="amber"
            size="md"
            className="shrink-0 !px-3"
            onClick={() => handleSend()}
            disabled={!text.trim() || sending}
            aria-label="Send"
          >
            <I.send size={15} />
          </Btn>
        </div>
      </div>
    </div>
  );
}
