import { useSyncExternalStore } from 'react';
import type {
  AccountSuspension, AllowMessages, AppState, ConnStatus, FeedKind, GeoPoint,
  MeetingTimer, Message, ReportOutcome, Relationship, Role, SafeZone, SosEvent, SosStatus, SuspendType, User,
} from './types';
import { seedState } from './seed';
import {
  COORD_REDACTED, fmtCountdown, haversineKm, isIndianNumber, isValidPhone, latency,
  normalizePhone, pick, rand, scanSensitive, smsBody, uid,
} from './utils';

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const V_MIN = 60_000;

export interface DiscoverCard {
  user: User;
  distanceKm: number;
  conn: { id: string; status: ConnStatus; direction: 'in' | 'out' } | null;
}

const CANNED: Record<string, string[]> = {
  u_rohan: [
    'Haha deal. Do not be late tomorrow, the park gate closes at 7.',
    'I just checked the weather — perfect running weather. 6:30 sharp.',
    'By the way, I always keep my meeting timer on for first meetups. Safety habits die hard.',
    'See you at the statue circle. Loser buys the cold coffee.',
  ],
  u_priya: [
    'Okay that is a strong take. Adding it to the cafe spreadsheet immediately.',
    'I am writing a piece on "third places" in Bengaluru — you are basically my research subject now.',
    'Deal. Saturday works for me, the HSR side has a new roastery.',
    'You always reply at the best times. Okay, more soon!',
  ],
  u_meera: [
    'That helps a lot, thank you! The metro-side one looks great.',
    'I brought my sketchbook today — the cafe you suggested has great light.',
    'Okay! I will send you my notes from the study session later.',
  ],
  u_kabir: [
    'Saturday it is. I will book the court near MG Road.',
    'I sketched that building we discussed — the facade detailing is unreal.',
    'Bring the racket or I am defaulting the match, Rohan.',
  ],
};

class Engine {
  state: AppState;
  private listeners = new Set<() => void>();

  constructor() {
    this.state = {
      ...seedState,
      vnow: 0,
      feed: [],
      toasts: [],
      typing: {},
    };
    this.log('auth', `JWT issued · access 15m · refresh 30d (HttpOnly)`, 'POST /api/auth/login', 'ok');
    this.log('geo', `UserLocation upsert · GeoJSON Point · 2dsphere index hit`, 'PUT /api/location', 'info');
    this.log('socket', `socket.io connected · room user:u_aisha · transport websocket`, undefined, 'ok');
    setInterval(() => this.tick(), 200);
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getSnapshot = () => this.state;

  private commit(patch?: Partial<AppState>) {
    this.state = { ...this.state, ...(patch ?? {}) };
    this.listeners.forEach((fn) => fn());
  }

  /* ---------------- telemetry & toasts ---------------- */

  log(kind: FeedKind, text: string, endpoint?: string, tone: 'ok' | 'warn' | 'err' | 'info' = 'info') {
    const feed = [{ id: uid('ev'), wall: Date.now(), kind, text, endpoint, tone }, ...this.state.feed].slice(0, 90);
    this.commit({ feed });
  }
  toast(tone: 'ok' | 'warn' | 'err' | 'info', title: string, sub?: string) {
    const t = { id: uid('t'), tone, title, sub };
    this.commit({ toasts: [...this.state.toasts, t] });
    setTimeout(() => this.commit({ toasts: this.state.toasts.filter((x) => x.id !== t.id) }), 4600);
  }

  /* ---------------- selectors ---------------- */

  user(id: string): User {
    const found = this.state.users.find((u) => u.id === id);
    if (found) return found;
    return {
      id: id || 'u-fallback',
      name: 'User',
      username: 'user',
      email: 'user@casualmeet.internal',
      phone: '+91 99999 00000',
      age: 25,
      bio: 'CasualMeet explorer',
      occupation: 'Member',
      city: 'Bengaluru',
      interests: ['Meetups'],
      lookingFor: 'Friendship',
      role: 'user',
      isVerified: false,
      trustScore: 100,
      showLocation: true,
      allowMessages: 'connections',
      onboardingComplete: true,
      expoPushToken: `ExponentPushToken[${id || 'unknown'}]`,
      avatarHue: 200,
      joinedDaysAgo: 0,
    };
  }
  persona() { return this.user(this.state.personaId); }
  loc(id: string) { return this.state.locations.find((l) => l.userId === id); }
  activeSuspension(id: string) {
    return this.state.suspensions.find((s) => s.userId === id && s.isActive && (s.type !== 'temporary' || !s.expiresAtWall || s.expiresAtWall > Date.now()));
  }
  connBetween(a: string, b: string) {
    return this.state.connections.find(
      (c) => (c.requesterId === a && c.receiverId === b) || (c.requesterId === b && c.receiverId === a),
    );
  }
  vAgo(vts: number) {
    const d = Math.max(0, this.state.vnow - vts);
    if (d < V_MIN) return `${Math.floor(d / 1000)}s ago`;
    if (d < 60 * V_MIN) return `${Math.floor(d / V_MIN)}m ago`;
    return `${Math.floor(d / (60 * V_MIN))}h ${Math.floor((d % (60 * V_MIN)) / V_MIN)}m ago`;
  }

  setPersona(id: string) {
    const targetUser = this.user(id);
    this.commit({ personaId: id });
    this.log('auth', `Session switched → ${targetUser.name} · token re-scoped`, 'POST /api/auth/switch', 'info');
    // simulate the new persona opening their inbox: mark inbound messages read
    const messages = this.state.messages.map((m) => {
      const chat = this.state.chats.find((c) => c.id === m.chatId);
      return chat && chat.participants.includes(id) && m.senderId !== id && m.status !== 'read' ? { ...m, status: 'read' as const } : m;
    });
    this.commit({ messages });
  }
  setScale(s: 1 | 60 | 600) {
    this.commit({ timeScale: s });
    this.toast('info', `Demo clock ×${s}`, s === 1 ? 'Real-time. A 15 min timer takes 15 minutes.' : `1 real second = ${s} simulated seconds. Timers & escalations accelerated.`);
  }

  registerUser(u: Partial<User> & Pick<User, 'name' | 'username' | 'email' | 'phone'> & { role?: Role }) {
    const existing = this.state.users.find(
      (x) => (u.id && x.id === u.id) || x.username.toLowerCase() === u.username.toLowerCase()
    );
    if (existing) {
      return existing;
    }
    const id = u.id || uid('u');
    const newUser: User = {
      id,
      name: u.name,
      username: u.username,
      email: u.email,
      phone: u.phone,
      age: u.age || 25,
      bio: u.bio || 'CasualMeet explorer',
      occupation: u.occupation || 'Professional',
      city: u.city || 'Bengaluru',
      interests: u.interests?.length ? u.interests : ['Coffee', 'Meetups'],
      lookingFor: u.lookingFor || 'Friendship',
      role: u.role || 'user',
      isVerified: false,
      trustScore: 100,
      showLocation: u.showLocation ?? true,
      allowMessages: u.allowMessages ?? 'connections',
      onboardingComplete: true,
      expoPushToken: `ExponentPushToken[${u.username}-live]`,
      avatarHue: Math.floor(Math.random() * 360),
      joinedDaysAgo: 0,
    };
    this.commit({
      users: [...this.state.users, newUser],
      locations: [
        ...this.state.locations,
        {
          userId: id,
          location: { type: 'Point', coordinates: [77.6245 + (Math.random() - 0.5) * 0.05, 12.9352 + (Math.random() - 0.5) * 0.05] },
          updatedAt: Date.now(),
        },
      ],
    });
    this.bump('registrations');
    this.log('auth', `User registered: @${newUser.username} · ${newUser.role}`, 'POST /api/auth/register', 'ok');
    return newUser;
  }

  /* ---------------- discovery ($geoNear simulation, coordinates redacted) ---------------- */

  discover(maxKm: number): DiscoverCard[] {
    const me = this.state.personaId;
    const myLoc = this.loc(me);
    if (!myLoc) return [];
    const out: DiscoverCard[] = [];
    for (const u of this.state.users) {
      if (u.id === me) continue;
      if (!u.onboardingComplete) continue;
      if (!u.showLocation) continue;
      if (this.activeSuspension(u.id)) continue;
      if (u.role !== 'user') continue;
      const conn = this.connBetween(me, u.id);
      if (conn && conn.status === 'blocked') continue;
      const ul = this.loc(u.id);
      if (!ul) continue;
      const km = haversineKm(myLoc.location, ul.location); // raw coords never leave this function
      if (km > maxKm) continue;
      out.push({
        user: u,
        distanceKm: km,
        conn: conn ? { id: conn.id, status: conn.status, direction: conn.requesterId === me ? 'out' : 'in' } : null,
      });
    }
    return out.sort((a, b) => a.distanceKm - b.distanceKm);
  }

  /* ---------------- connections ---------------- */

  requestConnection(targetId: string) {
    const me = this.state.personaId;
    if (targetId === me) return this.toast('err', 'Self-connection rejected', 'requesterId !== receiverId enforced server-side');
    if (this.connBetween(me, targetId)) return this.toast('warn', 'A connection record already exists for this pair');
    if (this.activeSuspension(targetId)) return this.toast('err', 'User unavailable', 'Suspended accounts cannot receive requests');
    const c = { id: uid('cn'), requesterId: me, receiverId: targetId, status: 'pending' as ConnStatus, createdAt: Date.now() };
    this.commit({ connections: [...this.state.connections, c] });
    this.log('api', `Connection request ${this.user(me).username} → ${this.user(targetId).username} · status pending`, `POST /api/connections/request → 201 · ${latency()}ms`, 'ok');
    this.log('push', `Expo push → ${this.user(targetId).expoPushToken} · "New connection request"`, undefined, 'info');
    this.toast('ok', 'Request sent', `${this.user(targetId).name} can now accept or reject`);
  }
  cancelConnection(id: string) {
    const c = this.state.connections.find((x) => x.id === id);
    if (!c || c.requesterId !== this.state.personaId) return this.toast('err', 'Only the requester can cancel an outgoing request');
    this.commit({ connections: this.state.connections.filter((x) => x.id !== id) });
    this.log('api', `Outgoing request cancelled · ${this.user(c.receiverId).username}`, `DELETE /api/connections/${c.id} → 204`, 'warn');
  }
  acceptConnection(id: string) {
    const c = this.state.connections.find((x) => x.id === id);
    if (!c) return;
    if (c.receiverId !== this.state.personaId) return this.toast('err', 'Receiver-only rule', 'Only the receiving user may accept this request');
    this.commit({ connections: this.state.connections.map((x) => (x.id === id ? { ...x, status: 'accepted' as const } : x)) });
    this.openChatWith(c.requesterId, true);
    this.bump('connections');
    this.log('api', `${this.persona().username} accepted ${this.user(c.requesterId).username} · chat unlocked`, `PUT /api/connections/${id}/accept → 200 · ${latency()}ms`, 'ok');
    this.log('socket', `chat.open emitted to both rooms`, undefined, 'info');
    this.toast('ok', 'Connection accepted', `You can now message ${this.user(c.requesterId).name}`);
  }
  rejectConnection(id: string) {
    const c = this.state.connections.find((x) => x.id === id);
    if (!c || c.receiverId !== this.state.personaId) return this.toast('err', 'Receiver-only rule', 'Only the receiving user may reject this request');
    this.commit({ connections: this.state.connections.map((x) => (x.id === id ? { ...x, status: 'rejected' as const } : x)) });
    this.log('api', `Request rejected by receiver`, `PUT /api/connections/${id}/reject → 200`, 'warn');
    this.toast('info', 'Request rejected');
  }

  /* ---------------- chat ---------------- */

  openChatWith(otherId: string, silent = false): string | null {
    const me = this.state.personaId;
    const existing = this.state.chats.find((c) => c.type === 'direct' && c.participants.includes(me) && c.participants.includes(otherId));
    if (existing) return existing.id;
    const conn = this.connBetween(me, otherId);
    const meU = this.persona();
    const otherU = this.user(otherId);
    const allowed = (conn && conn.status === 'accepted') || (meU.allowMessages === 'everyone' && otherU.allowMessages === 'everyone');
    if (!allowed) {
      if (!silent) this.toast('err', 'Message gate closed', otherU.allowMessages === 'none' ? `${otherU.name} accepts messages from no one` : 'You must be connected first (or both allow "everyone")');
      this.log('api', `Gate check failed ${meU.username} → ${otherU.username} · allowMessages=${otherU.allowMessages}`, 'GET /api/chats/open → 403', 'err');
      return null;
    }
    const chat = { id: uid('c'), type: 'direct' as const, participants: [me, otherId], lastMessageAt: Date.now() };
    this.commit({ chats: [chat, ...this.state.chats] });
    return chat.id;
  }

  sendMessage(chatId: string, content: string) {
    const me = this.state.personaId;
    const chat = this.state.chats.find((c) => c.id === chatId);
    if (!chat || !content.trim()) return;
    const other = chat.participants.find((p) => p !== me)!;
    if (this.activeSuspension(me)) return this.toast('err', 'Account suspended', 'Suspended accounts cannot send messages');
    if (this.activeSuspension(other)) return this.toast('err', 'Recipient suspended', 'Deliveries to suspended accounts are blocked');

    const hits = scanSensitive(content); // server-authoritative scan, pre-persist
    const msg: Message = {
      id: uid('m'), chatId, senderId: me, content: content.trim(), type: 'text',
      containsSensitive: hits.length > 0, sensitiveKinds: hits.map((h) => h.kind),
      status: 'sent', sentAt: Date.now(),
    };
    this.commit({
      messages: [...this.state.messages, msg],
      chats: this.state.chats.map((c) => (c.id === chatId ? { ...c, lastMessageAt: Date.now() } : c)),
    });
    this.bump('messages');
    this.log('api', `msg.persist chat=${chatId.slice(0, 10)} len=${content.length}${hits.length ? ` · SENSITIVE:[${hits.map((h) => h.kind).join(',')}]` : ''}`, `POST /api/chats/${chatId}/messages → 201 · ${latency()}ms`, hits.length ? 'warn' : 'ok');
    if (hits.length) {
      this.log('alert', `containsSensitive=true · kinds: ${hits.map((h) => h.label).join(' · ')} · delivery held behind redaction`, undefined, 'warn');
      this.toast('warn', 'Sensitive data detected', hits.map((h) => h.label).join(' · ') + ' — shown redacted');
    }
    this.log('socket', `message.new → room user:${other}`, undefined, 'info');
    setTimeout(() => this.patchMsg(msg.id, { status: 'delivered' }), 650);
    if (CANNED[other]) {
      const replyDelay = rand(2400, 4200);
      setTimeout(() => this.commit({ typing: { ...this.state.typing, [chatId]: other } }), replyDelay - 1400);
      setTimeout(() => {
        this.commit({ typing: { ...this.state.typing, [chatId]: null } });
        const reply: Message = {
          id: uid('m'), chatId, senderId: other, content: pick(CANNED[other]), type: 'text',
          containsSensitive: false, sensitiveKinds: [], status: 'read', sentAt: Date.now(),
        };
        this.state.messages.forEach((m) => { if (m.chatId === chatId && m.senderId === me) m.status = 'read'; });
        this.commit({
          messages: [...this.state.messages.map((m) => (m.chatId === chatId && m.senderId === me ? { ...m, status: 'read' as const } : m)), reply],
          chats: this.state.chats.map((c) => (c.id === chatId ? { ...c, lastMessageAt: Date.now() } : c)),
        });
        this.log('socket', `message.new from ${this.user(other).username} · read receipts emitted`, undefined, 'info');
      }, replyDelay);
    } else {
      setTimeout(() => this.patchMsg(msg.id, { status: 'read' }), 2600);
    }
  }

  private patchMsg(id: string, patch: Partial<Message>) {
    this.commit({ messages: this.state.messages.map((m) => (m.id === id ? { ...m, ...patch } : m)) });
  }
  revealMessage(id: string) {
    const me = this.state.personaId;
    this.commit({ messages: this.state.messages.map((m) => (m.id === id ? { ...m, revealedBy: [...(m.revealedBy ?? []), me] } : m)) });
    this.log('alert', `Recipient revealed redacted content · audit entry written`, undefined, 'warn');
  }

  /* ---------------- meeting timers ---------------- */

  startTimer(opts: { durationMinutes: number; locationName: string; meetWithUserId?: string; includeLocation: boolean }) {
    const me = this.state.personaId;
    const active = this.state.timers.find((t) => t.userId === me && t.status === 'active');
    if (active) return this.toast('warn', 'A timer is already running', `Cancel or resolve timer ${active.id.slice(-4)} first`);
    if (opts.durationMinutes < 15 || opts.durationMinutes > 480) return this.toast('err', 'Duration must be 15–480 minutes');
    const loc = opts.includeLocation ? this.loc(me)?.location : undefined;
    const t: MeetingTimer = {
      id: uid('tm'), userId: me, meetWithUserId: opts.meetWithUserId || undefined,
      locationName: opts.locationName || 'Unnamed meetup', meetupLocation: loc,
      durationMinutes: opts.durationMinutes, startedAtV: this.state.vnow,
      expiresAtV: this.state.vnow + opts.durationMinutes * V_MIN, status: 'active',
    };
    this.commit({ timers: [t, ...this.state.timers] });
    this.log('api', `Timer armed · ${opts.durationMinutes}m · expires in ${fmtCountdown(t.expiresAtV - this.state.vnow)}${loc ? '' : ' · coordinates withheld by user'}`, `POST /api/timers/start → 201 · ${latency()}ms`, 'ok');
    this.log('job', `BullMQ delayed job queued · key timer:${t.id} · delay ${opts.durationMinutes}m (×${this.state.timeScale} clock)`, undefined, 'info');
    this.log('job', `Reminder job queued · T-5m check-in push`, undefined, 'info');
    this.toast('ok', 'Meeting timer armed', `Check in before the countdown ends or SOS escalates automatically`);
    return t;
  }
  markSafe(id: string) {
    this.commit({ timers: this.state.timers.map((t) => (t.id === id ? { ...t, status: 'safe', resolvedAtV: this.state.vnow } : t)) });
    this.log('api', `Check-in received · timer marked safe`, `PUT /api/timers/${id}/safe → 200`, 'ok');
    this.log('job', `Escalation job cancelled · no dispatch needed`, undefined, 'ok');
    this.toast('ok', 'Marked safe', 'Escalation pipeline stood down');
  }
  extendTimer(id: string, extraMin: number) {
    const t = this.state.timers.find((x) => x.id === id);
    if (!t) return;
    const total = t.durationMinutes + extraMin;
    if (total > 480) return this.toast('err', 'Total duration cannot exceed 480 minutes');
    this.commit({ timers: this.state.timers.map((x) => (x.id === id ? { ...x, status: 'extended', durationMinutes: total, expiresAtV: x.expiresAtV + extraMin * V_MIN } : x)) });
    this.log('api', `Timer extended +${extraMin}m · new total ${total}m`, `PUT /api/timers/${id}/extend → 200`, 'ok');
    this.toast('ok', `Extended by ${extraMin} minutes`);
  }
  cancelTimer(id: string) {
    this.commit({ timers: this.state.timers.map((t) => (t.id === id ? { ...t, status: 'cancelled', resolvedAtV: this.state.vnow } : t)) });
    this.log('api', `Timer cancelled by owner · jobs dropped`, `PUT /api/timers/${id} → 204`, 'warn');
  }

  /* ---------------- SOS pipeline ---------------- */

  activeSosFor(userId: string) {
    return this.state.sosEvents.find((s) => s.userId === userId && s.status === 'active');
  }

  async triggerSos(opts: { locationName: string; includeLocation: boolean; source: 'manual' | 'timer_expired'; timerId?: string; asUserId?: string }) {
    const me = opts.asUserId ?? this.state.personaId;
    if (this.activeSosFor(me)) return this.toast('warn', 'An SOS is already active', 'Resolve it first to trigger a new one');
    const loc: GeoPoint | null = opts.includeLocation ? this.loc(me)?.location ?? null : null;
    const ev: SosEvent = {
      id: uid('sos'), userId: me, source: opts.source, location: loc,
      locationName: opts.locationName || 'Unknown area', status: 'active',
      smsSent: false, adminNotified: false, contactsNotified: 0,
      createdAtV: this.state.vnow, createdAtWall: Date.now(), triggeredTimerId: opts.timerId,
    };
    this.commit({ sosEvents: [ev, ...this.state.sosEvents] });
    this.bump('sos');
    this.log('api', `SOS created · src=${opts.source} · coords=${loc ? 'GPS fix' : 'null (GPS unavailable)'}`, `POST /api/sos/trigger → 201 · ${latency()}ms`, 'err');
    this.log('socket', `sos.created broadcast → room admins · dashboard alerted in realtime`, undefined, 'err');
    this.log('push', `Expo push → admin devices · "ACTIVE SOS — ${this.user(me).name}"`, undefined, 'err');
    this.commit({ sosEvents: this.state.sosEvents.map((s) => (s.id === ev.id ? { ...s, adminNotified: true } : s)) });
    this.toast('err', 'SOS TRIGGERED', loc ? `Location attached · ${COORD_REDACTED}` : 'Coordinates unavailable — sent without location');
    await this.dispatchSos(ev.id);
  }

  /* Authoritative dispatch: re-reads the event from the "DB", enforces ownership,
     rate-limits (max 1 dispatch / 30 sim-seconds per event) and is idempotent
     per contact — already-sent recipients are skipped on retry. */
  async dispatchSos(sosId: string, retry = false) {
    const ev = this.state.sosEvents.find((s) => s.id === sosId);
    if (!ev) return;
    if (ev.status !== 'active') { this.log('job', `Dispatch aborted · event ${sosId.slice(-4)} no longer active (authoritative re-read)`, undefined, 'warn'); return; }
    if (ev.lastDispatchAtV !== undefined && this.state.vnow - ev.lastDispatchAtV < 30_000) {
      this.log('job', `Dispatch rate-limited · last run ${Math.round((this.state.vnow - ev.lastDispatchAtV) / 1000)}s ago · window 30s`, 'POST /api/sos/dispatch → 429', 'warn');
      if (retry) this.toast('warn', 'Dispatch rate-limited', 'Max 1 dispatch per 30s per SOS event');
      return;
    }
    const owner = this.user(ev.userId);
    const all = this.state.contacts.filter((c) => c.userId === ev.userId && c.notifyOnSos).slice(0, 5);
    this.commit({ sosEvents: this.state.sosEvents.map((s) => (s.id === sosId ? { ...s, lastDispatchAtV: this.state.vnow } : s)) });
    this.log('job', `Dispatch started · ${all.length} contact(s) · owner-verified · anti-tamper check passed`, 'POST /api/sos/dispatch → 202', 'info');

    for (const c of all) {
      const fresh = this.state.sosEvents.find((s) => s.id === sosId)!;
      if (fresh.status !== 'active') { this.log('job', `Dispatch halted mid-run · event resolved`, undefined, 'warn'); return; }
      const alreadySent = this.state.deliveryLogs.find((l) => l.sosId === sosId && l.contactId === c.id && l.status === 'sent');
      if (alreadySent) { this.log('sms', `skip ${c.name} · already sent (idempotency guard)`, undefined, 'info'); continue; }
      const gateway = isIndianNumber(c.phone) ? 'fast2sms' : 'twilio';
      const existing = this.state.deliveryLogs.find((l) => l.sosId === sosId && l.contactId === c.id);
      const logId = existing?.id ?? uid('dl');
      const base = {
        id: logId, sosId, contactId: c.id, contactName: c.name, contactPhone: normalizePhone(c.phone),
        gateway: gateway as 'fast2sms' | 'twilio', status: 'sending' as const,
        attempts: (existing?.attempts ?? 0) + 1, updatedAtWall: Date.now(),
      };
      this.upsertLog(existing ? { ...existing, ...base } : base);
      this.log('sms', `→ ${gateway.toUpperCase()} · ${c.name} · ${normalizePhone(c.phone).slice(0, 6)}··· · body: "${smsBody(owner.name, ev.location, ev.locationName).slice(0, 48)}…"`, undefined, 'info');
      await sleep(rand(550, 950));
      const failFirst = !existing && Math.random() < 0.3;
      if (failFirst) {
        this.upsertLog({ ...base, status: 'failed', lastError: gateway === 'fast2sms' ? 'F2S_ERR 408: gateway timeout' : 'Twilio 30007: carrier unreachable' });
        this.log('sms', `✗ ${gateway} delivery failed (${base.attempts === 1 ? 'attempt 1' : 'retry'}) · queued for retry`, undefined, 'err');
        await sleep(rand(600, 1000));
        const sid = gateway === 'fast2sms' ? `F2S_${Math.random().toString(36).slice(2, 8).toUpperCase()}` : `SM${Math.random().toString(36).slice(2, 12)}`;
        this.upsertLog({ ...base, status: 'sent', attempts: base.attempts + 1, gatewayResponse: { sid, cost: gateway === 'fast2sms' ? '₹0.16' : '$0.0079' }, lastError: undefined });
        this.log('sms', `✓ retry succeeded · sid ${sid} · delivery logged atomically`, undefined, 'ok');
      } else {
        const sid = gateway === 'fast2sms' ? `F2S_${Math.random().toString(36).slice(2, 8).toUpperCase()}` : `SM${Math.random().toString(36).slice(2, 12)}`;
        this.upsertLog({ ...base, status: 'sent', gatewayResponse: { sid, cost: gateway === 'fast2sms' ? '₹0.16' : '$0.0079' } });
        this.log('sms', `✓ ${gateway} delivered · sid ${sid}`, undefined, 'ok');
      }
      const notified = this.state.deliveryLogs.filter((l) => l.sosId === sosId && l.status === 'sent').length;
      this.commit({ sosEvents: this.state.sosEvents.map((s) => (s.id === sosId ? { ...s, contactsNotified: notified, smsSent: notified > 0 } : s)) });
    }
    this.log('job', `Dispatch run complete · ${this.state.sosEvents.find((s) => s.id === sosId)?.contactsNotified ?? 0}/${all.length} contacts reached`, undefined, 'ok');
  }

  private upsertLog(log: AppState['deliveryLogs'][number]) {
    const exists = this.state.deliveryLogs.some((l) => l.id === log.id);
    this.commit({ deliveryLogs: exists ? this.state.deliveryLogs.map((l) => (l.id === log.id ? { ...log, updatedAtWall: Date.now() } : l)) : [...this.state.deliveryLogs, { ...log, updatedAtWall: Date.now() }] });
  }

  resolveSos(id: string, status: Exclude<SosStatus, 'active'>, byAdmin: boolean) {
    const linkedTimer = this.state.sosEvents.find((s) => s.id === id)?.triggeredTimerId;
    this.commit({ sosEvents: this.state.sosEvents.map((s) => (s.id === id ? { ...s, status, resolvedAtWall: Date.now() } : s)) });
    if (linkedTimer) {
      // the escalation is stood down — release the expired timer so a new one can be armed
      this.commit({ timers: this.state.timers.map((t) => (t.id === linkedTimer ? { ...t, status: 'safe', resolvedAtV: this.state.vnow } : t)) });
    }
    this.log(byAdmin ? 'admin' : 'api', `SOS ${id.slice(-4)} → ${status} · by ${byAdmin ? 'admin:kavita.ops' : 'owner'}`, `POST /api/sos/${id}/resolve → 200`, status === 'false_alarm' ? 'warn' : 'ok');
    this.toast(status === 'resolved' ? 'ok' : 'info', `SOS marked ${status === 'resolved' ? 'resolved' : 'false alarm'}`, byAdmin ? 'Action recorded in admin audit log' : 'Contacts will see the stand-down on next check');
  }

  /* ---------------- emergency contacts & settings ---------------- */

  addContact(d: { name: string; phone: string; relationship: Relationship }) {
    const me = this.state.personaId;
    const mine = this.state.contacts.filter((c) => c.userId === me);
    if (mine.length >= 5) return this.toast('err', 'Contact limit reached', 'Maximum 5 emergency contacts per account');
    if (!isValidPhone(d.phone)) return this.toast('err', 'Invalid phone', 'Use E.164 (+91…) or a 10-digit Indian number');
    this.commit({ contacts: [...this.state.contacts, { id: uid('ec'), userId: me, name: d.name, phone: normalizePhone(d.phone), relationship: d.relationship, notifyOnSos: true }] });
    this.log('api', `Emergency contact added · ${d.name} · ${isIndianNumber(d.phone) ? 'route Fast2SMS' : 'route Twilio'}`, 'POST /api/contacts → 201', 'ok');
    this.toast('ok', 'Contact saved', isIndianNumber(d.phone) ? 'Will be reached via Fast2SMS (+91)' : 'International — routed via Twilio');
  }
  removeContact(id: string) {
    this.commit({ contacts: this.state.contacts.filter((c) => c.id !== id) });
    this.log('api', `Emergency contact removed`, `DELETE /api/contacts/${id} → 204`, 'warn');
  }
  toggleShowLocation(v: boolean) {
    this.commit({ users: this.state.users.map((u) => (u.id === this.state.personaId ? { ...u, showLocation: v } : u)) });
    this.log('geo', `showLocation=${v} · ${v ? 'included in $geoNear discovery' : 'excluded from all discovery feeds'}`, 'PATCH /api/me → 200', v ? 'ok' : 'warn');
    this.toast(v ? 'ok' : 'warn', v ? 'You are discoverable' : 'Hidden from discovery', v ? undefined : 'Exact coordinates are never shared either way');
  }
  setAllowMessages(v: AllowMessages) {
    this.commit({ users: this.state.users.map((u) => (u.id === this.state.personaId ? { ...u, allowMessages: v } : u)) });
    this.log('api', `allowMessages=${v}`, 'PATCH /api/me → 200', 'info');
  }

  /* ---------------- verification ---------------- */

  submitVerification() {
    const me = this.state.personaId;
    if (this.state.verifications.some((v) => v.userId === me && v.status === 'pending'))
      return this.toast('warn', 'One pending request at a time', 'A review is already in queue — partial unique index on (userId, status=pending)');
    if (this.persona().isVerified) return this.toast('info', 'Already verified');
    this.commit({ verifications: [{ id: uid('vr'), userId: me, selfieUrl: `selfie://capture/${this.persona().username}_live`, status: 'pending', submittedAtWall: Date.now() }, ...this.state.verifications] });
    this.log('api', `Selfie uploaded · front camera only · ${(rand(0.8, 3.4)).toFixed(1)}MB · image/jpeg`, `POST /api/verification/submit → 201 · ${latency()}ms`, 'ok');
    this.toast('ok', 'Verification submitted', 'Now visible in the admin moderation queue');
  }
  reviewVerification(id: string, approve: boolean, note: string) {
    const v = this.state.verifications.find((x) => x.id === id);
    if (!v) return;
    this.commit({
      verifications: this.state.verifications.map((x) => (x.id === id ? { ...x, status: approve ? 'approved' : 'rejected', reviewNote: note, reviewedBy: this.state.adminId, reviewedAtWall: Date.now() } : x)),
      users: approve ? this.state.users.map((u) => (u.id === v.userId ? { ...u, isVerified: true, trustScore: u.trustScore + 20 } : u)) : this.state.users,
    });
    this.log('admin', `Verification ${approve ? 'APPROVED' : 'REJECTED'} · ${this.user(v.userId).username}${approve ? ' · is_verified=true · trustScore +20' : ` · note: "${note}"`}`, `POST /api/admin/verification/${id} → 200`, approve ? 'ok' : 'warn');
    this.log('push', `Expo push → ${this.user(v.userId).expoPushToken} · verification ${approve ? 'approved' : 'rejected — resubmission allowed'}`, undefined, 'info');
    this.toast(approve ? 'ok' : 'info', `Verification ${approve ? 'approved' : 'rejected'}`, `${this.user(v.userId).name}${approve ? ' is now verified (+20 trust)' : ' can submit a new selfie'}`);
  }

  /* ---------------- admin: reports & suspensions ---------------- */

  resolveReport(id: string, outcome: ReportOutcome, note: string) {
    const r = this.state.reports.find((x) => x.id === id);
    if (!r) return;
    const status = outcome === 'false_report' ? 'dismissed' : 'actioned';
    this.commit({
      reports: this.state.reports.map((x) => (x.id === id ? { ...x, status, outcome, actionNote: note, resolvedBy: this.state.adminId, resolvedAtWall: Date.now() } : x)),
      suspensions: outcome === 'user_suspended'
        ? [{ id: uid('sus'), userId: r.reportedUserId, suspendedBy: this.state.adminId, type: 'temporary' as SuspendType, reason: `${r.reason} (report ${id.slice(-4)})`, isActive: true, createdAtWall: Date.now(), expiresAtWall: Date.now() + 7 * 86_400_000 }, ...this.state.suspensions]
        : this.state.suspensions,
    });
    this.log('admin', `Report ${id.slice(-4)} → ${outcome} · auditable note stored`, `POST /api/admin/reports/${id}/resolve → 200`, outcome === 'user_suspended' ? 'err' : 'ok');
    if (outcome === 'user_suspended') {
      this.log('auth', `${this.user(r.reportedUserId).username} suspended 7d · rejected by auth middleware · removed from discovery`, undefined, 'err');
      this.toast('err', 'User suspended', `${this.user(r.reportedUserId).name} is now invisible to discovery and blocked at auth`);
    } else {
      this.toast('ok', 'Report resolved', `Outcome: ${outcome}`);
    }
  }
  suspendUser(userId: string, type: SuspendType, reason: string) {
    this.commit({
      suspensions: [
        { id: uid('sus'), userId, suspendedBy: this.state.adminId, type, reason, isActive: true, createdAtWall: Date.now(), expiresAtWall: type === 'temporary' ? Date.now() + 7 * 86_400_000 : undefined },
        ...this.state.suspensions.map((s) => (s.userId === userId ? { ...s, isActive: false } : s)),
      ],
    });
    this.log('admin', `${this.user(userId).username} · suspension=${type} · "${reason}"`, `POST /api/admin/users/${userId}/suspend → 201`, 'err');
    this.log('auth', `Auth middleware now rejects this account · discovery & messaging excluded`, undefined, 'err');
    this.toast('err', 'Suspension applied', `${this.user(userId).name} · ${type.replace('_', ' ')}`);
  }
  reinstate(suspId: string) {
    const s = this.state.suspensions.find((x) => x.id === suspId);
    if (!s) return;
    this.commit({ suspensions: this.state.suspensions.map((x) => (x.id === suspId ? { ...x, isActive: false } : x)) });
    this.log('admin', `${this.user(s.userId).username} reinstated · suspension lifted`, `DELETE /api/admin/suspensions/${suspId} → 204`, 'ok');
    this.toast('ok', 'User reinstated', this.user(s.userId).name);
  }

  addSafeZone(z: Omit<SafeZone, 'id'>) {
    const newZone: SafeZone = {
      id: uid('sz'),
      ...z,
    };
    this.commit({ safeZones: [newZone, ...this.state.safeZones] });
    this.log('admin', `Safe zone added · ${newZone.name} (${newZone.category})`, 'POST /api/admin/safe-zones', 'ok');
    this.toast('ok', 'Verified safe zone added', `${newZone.name} is now available in meet-timers.`);
    return newZone;
  }

  /* ---------------- analytics ---------------- */

  private bump(metric: 'registrations' | 'connections' | 'messages' | 'sos') {
    const daily = [...this.state.daily];
    daily[daily.length - 1] = { ...daily[daily.length - 1], [metric]: daily[daily.length - 1][metric] + 1 };
    this.commit({ daily });
  }

  /* ---------------- virtual clock & scheduled jobs ---------------- */

  private tick() {
    const dt = 200 * this.state.timeScale;
    const vnow = this.state.vnow + dt;
    this.commit({ vnow });
    for (const t of this.state.timers) {
      if (t.status !== 'active' && t.status !== 'extended') continue;
      if (!t.checkSentAtV && t.expiresAtV - vnow <= 5 * V_MIN) {
        this.commit({ timers: this.state.timers.map((x) => (x.id === t.id ? { ...x, checkSentAtV: vnow } : x)) });
        this.log('push', `Expo push → ${this.persona().expoPushToken} · "Check in — your meeting timer ends in 5 minutes"`, undefined, 'warn');
        this.toast('warn', 'Check-in reminder', 'Your meeting timer expires in 5 minutes — mark yourself safe');
      }
      if (vnow >= t.expiresAtV) {
        this.commit({ timers: this.state.timers.map((x) => (x.id === t.id ? { ...x, status: 'expired', resolvedAtV: vnow } : x)) });
        this.log('job', `timer:${t.id} expired with no check-in · auto-escalation engaged`, 'BullMQ → POST /api/sos/trigger', 'err');
        this.toast('err', 'Timer expired', 'No check-in received — SOS escalation pipeline triggered');
        void this.triggerSos({ locationName: t.locationName, includeLocation: !!t.meetupLocation, source: 'timer_expired', timerId: t.id, asUserId: t.userId });
      }
    }
  }
}

export const engine = new Engine();

export function useEngine(): AppState {
  return useSyncExternalStore(engine.subscribe, engine.getSnapshot);
}
