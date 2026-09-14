import { useEffect, useRef, useState, useCallback } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { getSocket, joinChatRoom, leaveChatRoom, emitTyping, emitChatRead } from '../../lib/socket';
import { blurText, fmtTimeShort, relTime } from '../../lib/utils';
import { Avatar, Badge, Btn, Empty, I, Modal, Ticks, inputCls } from '../ui';
import { Shield, Flag, ShieldAlert, Search, UserCheck, Users, X, MessageSquare } from 'lucide-react';
import MeetupModal from '../social/MeetupModal';
import ReportModal from '../social/ReportModal';
import BlockModal from '../social/BlockModal';
import type { ConversationDTO, ChatMessageDTO } from '../../lib/types';

const SENSITIVE_SAMPLES: { label: string; text: string }[] = [
  { label: 'phone #', text: 'Call me on 98765 43210 after 6' },
  { label: 'UPI id', text: 'aisha.k@okhdfcbank works for splitting the bill' },
  { label: 'address', text: 'Come to my place — Flat 402, 12th Main, pincode 560038' },
];

export default function ChatScreen({
  threadId,
  openThread,
  isWide = false,
}: {
  threadId: string | null;
  openThread: (id: string | null) => void;
  isWide?: boolean;
}) {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [chats, setChats] = useState<ConversationDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [picker, setPicker] = useState(false);
  const [connections, setConnections] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const myId = currentUser?.id || '';

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

  // Listen for socket new_message & chat.read to update conversation list
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleNewMessage = () => {
      fetchChats();
    };

    const handleChatRead = () => {
      fetchChats();
    };

    socket.on('new_message', handleNewMessage);
    socket.on('chat.read', handleChatRead);

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('chat.read', handleChatRead);
    };
  }, [fetchChats]);

  const handleOpenPicker = () => {
    fetchConnections();
    setPicker(true);
  };

  const filteredChats = chats.filter((chat) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    if (chat.type === 'group') {
      return (chat.name || 'Group').toLowerCase().includes(q);
    }
    const name = chat.otherUser?.name || '';
    const username = chat.otherUser?.username || '';
    return name.toLowerCase().includes(q) || username.toLowerCase().includes(q);
  });

  const conversationListContent = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 pt-3">
        <p className="font-display text-[15px] font-bold text-ink flex items-center gap-2">
          <span>Conversations</span>
          {chats.length > 0 && (
            <span className="rounded-full bg-night-800 px-2 py-0.5 text-[11px] font-mono text-mute border border-line-soft">
              {chats.length}
            </span>
          )}
        </p>
        <Btn size="sm" tone="amber" onClick={handleOpenPicker} className="!px-2.5 !py-1 text-xs">
          <I.plus size={13} /> New chat
        </Btn>
      </div>

      <div className="px-3 pt-2">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-dim" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversations…"
            className="w-full rounded-xl border border-line-soft bg-night-800/80 py-1.5 pl-8 pr-3 text-xs text-ink placeholder-dim focus:border-amber/60 focus:outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-dim hover:text-ink"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      <div className="mt-2 flex-1 space-y-1 overflow-y-auto px-2 pb-4">
        {loading ? (
          <div className="space-y-2 pt-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="shimmer h-[64px] rounded-xl border border-line-soft" />
            ))}
          </div>
        ) : filteredChats.length === 0 ? (
          <div className="px-2 pt-6">
            <Empty
              icon={<MessageSquare size={26} className="text-dim" />}
              title={searchQuery ? 'No matching conversations' : 'No conversations yet'}
              sub={
                searchQuery
                  ? 'Try searching for another name or handle.'
                  : 'Start a direct chat with your accepted connections.'
              }
            />
          </div>
        ) : (
          filteredChats.map((chat) => {
            const isGroup = chat.type === 'group';
            const other =
              chat.otherUser ||
              (chat.participants as any[])?.find((p: any) => (p._id || p.id) !== myId) ||
              { name: isGroup ? chat.name || 'Group Chat' : 'Unknown', username: 'user' };

            const isSelected = threadId === chat._id;
            const lastMessageAt = chat.lastMessageAt || chat.updatedAt || chat.createdAt;
            const lastMsg = chat.lastMessage;
            const isSensitivePreview = lastMsg?.containsSensitive && lastMsg?.content === 'Sensitive Content';

            return (
              <button
                key={chat._id}
                onClick={() => openThread(chat._id)}
                className={`btn-press group flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all ${
                  isSelected
                    ? 'border-amber/50 bg-amber/10 shadow-sm'
                    : 'border-transparent hover:border-line-soft hover:bg-night-800/70'
                }`}
              >
                <div className="relative shrink-0">
                  <Avatar user={other} size={42} />
                  {isGroup && (
                    <span className="absolute -bottom-1 -right-1 rounded-full bg-night-800 p-0.5 border border-line-soft text-amber">
                      <Users size={11} />
                    </span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-1.5">
                    <span className="flex items-center gap-1.5 truncate font-display text-sm font-bold text-ink">
                      {other.name}
                      {other.isVerified && (
                        <span className="text-sky shrink-0">
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

                  <div className="mt-0.5 flex items-center justify-between gap-2">
                    <span className="truncate text-xs text-mute flex-1">
                      {isSensitivePreview ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber">
                          <I.shield size={11} /> Sensitive Content
                        </span>
                      ) : lastMsg?.content ? (
                        <span>{lastMsg.content}</span>
                      ) : (
                        <span className="italic text-dim">Conversation started</span>
                      )}
                    </span>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {chat.relationship?.connectionStatus === 'accepted' && (
                        <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.2 text-[9px] font-medium text-teal-400 bg-teal-500/10 border border-teal-500/20">
                          Connected
                        </span>
                      )}
                      {chat.unreadCount > 0 && (
                        <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-amber px-1 text-[10px] font-bold text-night-950">
                          {chat.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      <Modal open={picker} onClose={() => setPicker(false)} title="Start a conversation">
        <p className="mb-3 text-xs text-mute">
          Direct messaging is protected by connection authorization. Select one of your accepted connections:
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
                    try {
                      const res = await api.chats.getWithUser(other._id || other.id);
                      if (res?._id) {
                        openThread(res._id);
                        setPicker(false);
                        fetchChats();
                      }
                    } catch (err: any) {
                      toast('err', 'Could not open conversation', err.message);
                    }
                  }}
                  className="btn-press flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-night-750/70 transition-colors"
                >
                  <Avatar user={other} size={32} />
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">{other.name}</p>
                    <p className="truncate text-[10px] text-dim">@{other.username || 'user'}</p>
                  </div>
                  <Badge tone="ok">connected</Badge>
                </button>
              );
            })}
          {connections.filter((c) => c.status === 'accepted').length === 0 && (
            <p className="py-4 text-center text-xs text-mute">
              No accepted connections yet. Visit Discover to connect with members first.
            </p>
          )}
        </div>
      </Modal>
    </div>
  );

  // 2-Pane Responsive View for Desktop/Tablet when isWide is enabled
  if (isWide) {
    return (
      <div className="flex h-full w-full overflow-hidden">
        {/* Left Pane: Conversations List */}
        <div
          className={`${
            threadId ? 'hidden md:flex' : 'flex'
          } h-full w-full md:w-80 md:min-w-[280px] md:max-w-[340px] flex-col border-r border-line-soft/60 bg-night-900/60`}
        >
          {conversationListContent}
        </div>

        {/* Right Pane: Active Thread or Empty State */}
        <div className={`${threadId ? 'flex' : 'hidden md:flex'} h-full flex-1 flex-col`}>
          {threadId ? (
            <Thread
              chatId={threadId}
              back={() => openThread(null)}
              onConversationMutated={fetchChats}
            />
          ) : (
            <div className="flex h-full flex-1 flex-col items-center justify-center p-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-night-800 border border-line-soft/80 text-amber mb-3">
                <MessageSquare size={28} />
              </div>
              <h3 className="font-display text-base font-bold text-ink">Select a conversation</h3>
              <p className="text-xs text-mute max-w-xs mt-1">
                Choose a conversation from the left or click New Chat to message a connection.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Mobile 1-Pane view (default)
  if (threadId) {
    return (
      <Thread
        chatId={threadId}
        back={() => openThread(null)}
        onConversationMutated={fetchChats}
      />
    );
  }

  return conversationListContent;
}

function Thread({
  chatId,
  back,
  onConversationMutated,
}: {
  chatId: string;
  back: () => void;
  onConversationMutated?: () => void;
}) {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessageDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [otherUser, setOtherUser] = useState<any>(null);
  const [relationship, setRelationship] = useState<any>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const [meetupModalOpen, setMeetupModalOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [blockModalOpen, setBlockModalOpen] = useState(false);

  const endRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<any>(null);
  const myId = currentUser?.id || '';

  // Explicit mark as read helper (Mandatory Correction 2 & 6)
  const markAsRead = useCallback(async () => {
    try {
      await api.chats.markRead(chatId);
      emitChatRead(chatId);
    } catch {
      // ignore
    }
  }, [chatId]);

  // Load message history from backend (retrieval only)
  const fetchMessages = useCallback(async () => {
    try {
      const res = await api.chats.getMessages(chatId);
      setMessages(Array.isArray(res) ? res : []);
      // After retrieving, explicitly mark messages as read
      await markAsRead();
    } catch (err: any) {
      toast('err', 'Failed to load messages', err.message);
    } finally {
      setLoading(false);
    }
  }, [chatId, markAsRead, toast]);

  // Load chat details to find conversation partner & relationship state
  useEffect(() => {
    api.chats
      .list()
      .then((chats) => {
        const found = chats.find((c: any) => c._id === chatId);
        if (found) {
          if (found.otherUser) {
            setOtherUser(found.otherUser);
          } else if (found.participants) {
            const other = (found.participants as any[]).find(
              (p: any) => (p._id || p.id) !== myId
            );
            if (other) setOtherUser(other);
          }
          if (found.relationship) {
            setRelationship(found.relationship);
          }
        }
      })
      .catch(() => {});
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
          const exists = prev.some((m) => m._id === incoming._id);
          if (exists) return prev;
          return [...prev, incoming];
        });

        // If message is from partner, mark read
        if (incoming.senderId !== myId) {
          markAsRead();
        }
      }
    };

    const handleChatRead = (payload: any) => {
      if (payload?.chatId === chatId) {
        // Transition outgoing unread messages to 'read'
        setMessages((prev) =>
          prev.map((m) =>
            m.senderId === myId && m.status !== 'read' ? { ...m, status: 'read' } : m
          )
        );
      }
    };

    const handleTyping = (data: any) => {
      if (data?.chatId === chatId && data?.userId !== myId) {
        setOtherTyping(Boolean(data.typing));
      }
    };

    if (socket) {
      socket.on('new_message', handleNewMessage);
      socket.on('chat.read', handleChatRead);
      socket.on('typing', handleTyping);
    }

    return () => {
      leaveChatRoom(chatId);
      if (socket) {
        socket.off('new_message', handleNewMessage);
        socket.off('chat.read', handleChatRead);
        socket.off('typing', handleTyping);
      }
    };
  }, [chatId, myId, markAsRead]);

  // Auto-scroll on new messages
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, otherTyping]);

  const handleSend = async (contentToSend?: string) => {
    const body = (contentToSend ?? text).trim();
    if (!body || sending) return;

    if (body.length > 2000) {
      toast('warn', 'Character Limit Exceeded', 'Messages cannot exceed 2000 characters.');
      return;
    }

    setSending(true);
    try {
      const res = await api.chats.sendMessage(chatId, body);
      if (res?.message) {
        const savedMsg = res.message;
        setMessages((prev) => {
          const exists = prev.some((m) => m._id === savedMsg._id);
          if (exists) return prev;
          return [...prev, savedMsg];
        });
        setText('');
        if (res.flagged) {
          toast('warn', 'Sensitive Data Flagged', 'Sensitive contact info detected and protected.');
        }
        if (onConversationMutated) onConversationMutated();
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
        prev.map((m) => (m._id === updated._id ? updated : m))
      );
      toast('info', 'Message Revealed', 'Audit logged for safety compliance.');
    } catch (err: any) {
      toast('err', 'Could Not Reveal', err.message);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.slice(0, 2000);
    setText(val);
    if (otherUser) {
      emitTyping(chatId, otherUser._id || otherUser.id, true);
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        emitTyping(chatId, otherUser._id || otherUser.id, false);
      }, 2000);
    }
  };

  const isConnectedPartner = relationship?.canMeet || relationship?.connectionStatus === 'accepted';

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between gap-2.5 border-b border-line-soft/80 px-3.5 py-2.5 bg-night-900/40 backdrop-blur-md">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            onClick={back}
            className="btn-press rounded-lg p-1 text-mute hover:bg-night-750 hover:text-ink transition-colors"
            title="Back to conversations"
          >
            <I.chevL size={16} />
          </button>
          {otherUser && <Avatar user={otherUser} size={36} />}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 truncate">
              <span className="truncate font-display text-sm font-bold text-ink">
                {otherUser?.name || 'Chat'}
              </span>
              {otherUser?.isVerified && (
                <span className="text-sky shrink-0">
                  <I.logo size={11} strokeWidth={2.4} />
                </span>
              )}
              {isConnectedPartner && (
                <span className="hidden sm:inline-flex rounded px-1.5 py-0.2 text-[9px] font-medium text-teal-400 bg-teal-500/10 border border-teal-500/20">
                  Connected
                </span>
              )}
            </div>
            <p className="truncate text-[10px] text-dim">
              @{otherUser?.username || 'user'} · encrypted in transit
            </p>
          </div>
        </div>

        {/* Header Action Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          {otherTyping && (
            <span className="chip text-safe hidden sm:inline-block animate-pulse text-[10px]">
              typing…
            </span>
          )}

          {/* Meet Safely Action Button (Strictly enabled ONLY when connection accepted) */}
          {otherUser && (
            <button
              onClick={() => {
                if (isConnectedPartner) {
                  setMeetupModalOpen(true);
                } else {
                  toast('warn', 'Connection Required', 'You must be connected with this user to start a meetup.');
                }
              }}
              disabled={!isConnectedPartner}
              className={`btn-press flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-all ${
                isConnectedPartner
                  ? 'border border-teal-500/40 bg-teal-500/10 text-teal-400 hover:bg-teal-500/20'
                  : 'border border-line-soft bg-night-800/40 text-dim cursor-not-allowed opacity-60'
              }`}
              title={isConnectedPartner ? 'Start Safe Meetup' : 'Must be connected to meet safely'}
            >
              <Shield size={12} />
              <span className="hidden sm:inline">Meet Safely</span>
            </button>
          )}

          {/* Report Button */}
          {otherUser && (
            <button
              onClick={() => setReportModalOpen(true)}
              className="btn-press rounded-lg p-1.5 text-dim hover:bg-night-750 hover:text-amber transition-colors"
              title="Report user"
            >
              <Flag size={14} />
            </button>
          )}

          {/* Block Button */}
          {otherUser && (
            <button
              onClick={() => setBlockModalOpen(true)}
              className="btn-press rounded-lg p-1.5 text-dim hover:bg-rose-500/10 hover:text-rose-400 transition-colors"
              title="Block user"
            >
              <ShieldAlert size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Messages Thread */}
      <div className="flex-1 space-y-2.5 overflow-y-auto px-3.5 py-3">
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
          <div className="py-12 text-center text-xs text-mute">
            Say hello to start the conversation! 👋
          </div>
        ) : (
          messages.map((m) => {
            const senderId = (m as any).senderId?._id || m.senderId;
            const mine = senderId === myId;
            const revealed = m.revealedBy?.some((id: any) => (id?._id || id) === myId);
            const msgId = m._id;

            return (
              <div
                key={msgId}
                className={`anim-rise flex ${mine ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[82%] rounded-2xl px-3.5 py-2 text-[13px] leading-snug break-words ${
                    mine
                      ? 'rounded-br-md bg-amber text-night-950 font-medium'
                      : 'rounded-bl-md border border-line-soft/80 bg-night-800/90 text-ink'
                  }`}
                >
                  {m.containsSensitive && !revealed ? (
                    <button
                      onClick={() => handleReveal(msgId)}
                      className={`btn-press block w-full rounded-lg border border-dashed px-2.5 py-1.5 text-left transition-colors ${
                        mine ? 'border-night-950/40 hover:bg-night-950/10' : 'border-amber/40 hover:bg-amber/5'
                      }`}
                    >
                      <span
                        className={`mb-1 flex items-center gap-1 font-mono text-[9px] uppercase tracking-widest ${
                          mine ? 'text-night-950/80 font-bold' : 'text-amber font-semibold'
                        }`}
                      >
                        <I.shield size={10} /> sensitive · {m.sensitiveKinds?.join(' + ') || 'PII'} · tap to reveal
                      </span>
                      <span
                        className={`font-mono text-xs tracking-wider block ${
                          mine ? 'text-night-950/60' : 'text-dim'
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
                      {/* MANDATORY CORRECTION 3: React plain text rendering escapes HTML automatically */}
                      <p className="whitespace-pre-wrap">{m.content}</p>
                    </>
                  )}

                  <span
                    className={`mt-1 flex items-center justify-end gap-1 font-mono text-[9px] ${
                      mine ? 'text-night-950/70' : 'text-dim'
                    }`}
                  >
                    {fmtTimeShort(new Date(m.createdAt || Date.now()).getTime())}{' '}
                    {mine && <Ticks status={m.status || 'sent'} />}
                  </span>
                </div>
              </div>
            );
          })
        )}

        {otherTyping && (
          <div className="flex justify-start">
            <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md border border-line-soft bg-night-800 px-3 py-2">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="pulse-dot inline-block h-1.5 w-1.5 rounded-full bg-amber"
                  style={{ animationDelay: `${i * 0.18}s` }}
                />
              ))}
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input Composer */}
      <div className="border-t border-line-soft/80 bg-night-900/40 p-2.5 backdrop-blur-md">
        <div className="mb-2 flex gap-1.5 overflow-x-auto pb-0.5">
          {SENSITIVE_SAMPLES.map((s) => (
            <button
              key={s.label}
              onClick={() => handleSend(s.text)}
              className="btn-press chip shrink-0 text-amber hover:border-amber/50 text-[10px]"
            >
              try: {s.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              value={text}
              onChange={handleInputChange}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder={otherUser ? `Message ${otherUser.name.split(' ')[0]}…` : 'Message…'}
              maxLength={2000}
              className={`${inputCls} pr-16`}
              disabled={sending}
            />
            <span
              className={`absolute right-2.5 top-1/2 -translate-y-1/2 font-mono text-[9px] ${
                text.length >= 1900 ? 'text-sos font-bold' : 'text-dim'
              }`}
            >
              {text.length}/2000
            </span>
          </div>

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

      {/* Safety Modals */}
      {otherUser && (
        <>
          <MeetupModal
            open={meetupModalOpen}
            onClose={() => setMeetupModalOpen(false)}
            targetUser={{
              id: otherUser._id || otherUser.id,
              name: otherUser.name,
              username: otherUser.username,
              avatarHue: otherUser.avatarHue,
            }}
          />

          <ReportModal
            open={reportModalOpen}
            onClose={() => setReportModalOpen(false)}
            targetType="user"
            targetId={otherUser._id || otherUser.id}
            targetName={otherUser.name}
          />

          <BlockModal
            open={blockModalOpen}
            onClose={() => setBlockModalOpen(false)}
            targetUserId={otherUser._id || otherUser.id}
            targetName={otherUser.name}
            onBlocked={() => {
              back();
              if (onConversationMutated) onConversationMutated();
            }}
          />
        </>
      )}
    </div>
  );
}

