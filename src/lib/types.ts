/* Domain model — mirrors the Mongoose schemas in the platform spec. */

export type Role = 'user' | 'moderator' | 'super_admin';
export type AllowMessages = 'everyone' | 'connections' | 'none';
export type ConnStatus = 'pending' | 'accepted' | 'rejected' | 'blocked';
export type MsgType = 'text' | 'image' | 'location';
export type MsgStatus = 'sent' | 'delivered' | 'read';
export type TimerStatus = 'active' | 'safe' | 'extended' | 'expired' | 'cancelled';
export type SosStatus = 'active' | 'resolved' | 'false_alarm';
export type SosSource = 'manual' | 'timer_expired';
export type DeliveryStatus = 'pending' | 'sending' | 'sent' | 'failed';
export type VerifStatus = 'pending' | 'approved' | 'rejected';
export type ReportStatus = 'pending' | 'actioned' | 'dismissed';
export type ReportOutcome = 'user_suspended' | 'warning_issued' | 'false_report';
export type SuspendType = 'temporary' | 'permanent' | 'shadow_ban';
export type SafeZoneCategory = 'police_station' | 'cafe' | 'public_transit' | 'mall' | 'hospital';
export type Relationship = 'family' | 'friend' | 'partner' | 'colleague' | 'other';
export type SensitiveKind = 'phone' | 'upi' | 'address' | 'pii';

export interface GeoPoint {
  type: 'Point';
  coordinates: [number, number]; // [lng, lat] — never exposed by discovery APIs
}

export interface User {
  id: string;
  name: string;
  username: string;
  email: string;
  phone: string;
  age: number;
  bio: string;
  occupation: string;
  city: string;
  interests: string[];
  lookingFor: string;
  role: Role;
  isVerified: boolean;
  trustScore: number;
  showLocation: boolean;
  allowMessages: AllowMessages;
  onboardingComplete: boolean;
  expoPushToken: string;
  avatarHue: number;
  joinedDaysAgo: number;
}

export interface UserLocation {
  userId: string;
  location: GeoPoint;
  updatedAt: number;
}

export interface EmergencyContact {
  id: string;
  userId: string;
  name: string;
  phone: string;
  relationship: Relationship;
  notifyOnSos: boolean;
}

export interface Connection {
  id: string;
  requesterId: string;
  receiverId: string;
  status: ConnStatus;
  createdAt: number;
}

export interface Chat {
  id: string;
  type: 'direct' | 'group';
  participants: string[];
  lastMessageAt: number;
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  content: string;
  type: MsgType;
  containsSensitive: boolean;
  sensitiveKinds: SensitiveKind[];
  status: MsgStatus;
  sentAt: number;
  revealedBy?: string[];
}

export interface MeetingTimer {
  id: string;
  userId: string;
  meetWithUserId?: string;
  locationName: string;
  meetupLocation?: GeoPoint;
  durationMinutes: number;
  startedAtV: number; // virtual clock (ms)
  expiresAtV: number;
  checkSentAtV?: number;
  resolvedAtV?: number;
  status: TimerStatus;
}

export interface SosEvent {
  id: string;
  userId: string;
  source: SosSource;
  location: GeoPoint | null;
  locationName: string;
  status: SosStatus;
  smsSent: boolean;
  adminNotified: boolean;
  contactsNotified: number;
  lastDispatchAtV?: number;
  createdAtV: number;
  createdAtWall: number;
  resolvedAtWall?: number;
  triggeredTimerId?: string;
}

export interface SosDeliveryLog {
  id: string;
  sosId: string;
  contactId: string;
  contactName: string;
  contactPhone: string;
  gateway: 'fast2sms' | 'twilio';
  status: DeliveryStatus;
  attempts: number;
  gatewayResponse?: { sid: string; cost: string };
  lastError?: string;
  updatedAtWall: number;
}

export interface VerificationRequest {
  id: string;
  userId: string;
  selfieUrl: string;
  status: VerifStatus;
  reviewNote?: string;
  reviewedBy?: string;
  submittedAtWall: number;
  reviewedAtWall?: number;
}

export interface UserReport {
  id: string;
  reporterId: string;
  reportedUserId: string;
  reason: string;
  details: string;
  status: ReportStatus;
  actionNote?: string;
  outcome?: ReportOutcome;
  resolvedBy?: string;
  createdAtWall: number;
  resolvedAtWall?: number;
}

export interface AccountSuspension {
  id: string;
  userId: string;
  suspendedBy: string;
  type: SuspendType;
  reason: string;
  isActive: boolean;
  createdAtWall: number;
  expiresAtWall?: number;
}

export interface SafeZone {
  id: string;
  name: string;
  category: SafeZoneCategory;
  location: GeoPoint;
  area: string;
}

export interface DayStat {
  date: string;
  registrations: number;
  connections: number;
  messages: number;
  sos: number;
}

export type FeedKind = 'api' | 'socket' | 'job' | 'sms' | 'push' | 'admin' | 'auth' | 'geo' | 'alert';

export interface SysEvent {
  id: string;
  wall: number;
  kind: FeedKind;
  text: string;
  endpoint?: string;
  tone: 'ok' | 'warn' | 'err' | 'info';
}

export interface Toast {
  id: string;
  tone: 'ok' | 'warn' | 'err' | 'info';
  title: string;
  sub?: string;
}

export interface AppState {
  vnow: number; // virtual clock in ms (advances by dt × timeScale)
  timeScale: 1 | 60 | 600;
  personaId: string;
  adminId: string;
  users: User[];
  locations: UserLocation[];
  contacts: EmergencyContact[];
  connections: Connection[];
  chats: Chat[];
  messages: Message[];
  timers: MeetingTimer[];
  sosEvents: SosEvent[];
  deliveryLogs: SosDeliveryLog[];
  verifications: VerificationRequest[];
  reports: UserReport[];
  suspensions: AccountSuspension[];
  safeZones: SafeZone[];
  daily: DayStat[];
  feed: SysEvent[];
  toasts: Toast[];
  typing: Record<string, string | null>; // chatId -> userId typing
  bootAtWall: number;
}
