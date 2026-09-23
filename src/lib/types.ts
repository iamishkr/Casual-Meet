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

export interface DiscoverUser {
  id: string;
  name: string;
  username: string;
  bio?: string;
  city?: string;
  occupation?: string;
  interests: string[];
  avatarHue: number;
  isVerified: boolean;
  age?: number;
}

export interface DiscoverPersonDTO {
  id: string;
  name: string;
  username: string;
  bio?: string;
  city?: string;
  occupation?: string;
  interests: string[];
  avatarHue: number;
  isVerified: boolean;
  sharedInterests: string[];
  mutualConnectionsCount: number;
  explanations: string[];
  relationship: {
    isFollowing: boolean;
    isFollower: boolean;
    connectionStatus: 'none' | 'pending' | 'connected';
  };
}

export interface MutualConnectionDTO {
  id: string;
  name: string;
  username: string;
  avatarHue: number;
  isVerified: boolean;
  city?: string;
}

export interface SearchResultDTO {
  query: string;
  people: {
    id: string;
    name: string;
    username: string;
    bio?: string;
    city?: string;
    occupation?: string;
    interests: string[];
    avatarHue: number;
    isVerified: boolean;
  }[];
  posts: {
    id: string;
    caption: string;
    media: PostMediaDTO[];
    locationName?: string;

    likeCount: number;
    commentCount: number;
    createdAt: string;
    author: {
      id: string;
      name: string;
      username: string;
      avatarHue: number;
      isVerified: boolean;
    } | null;
  }[];
}

export interface DiscoverItem {
  user: DiscoverUser;
  distanceKm: number;
  coordinatesRedacted: string;
  conn: {
    id: string;
    status: ConnStatus;
    direction: 'in' | 'out';
  } | null;
}


export interface SafeZoneDTO {
  id: string;
  name: string;
  category: SafeZoneCategory;
  area: string;
  verificationLevel: string;
  amenities: string[];
  venueCoordinates: [number, number];
  isPublicVenue: boolean;
}

export interface EmergencyContactDTO {
  _id: string;
  userId: string;
  name: string;
  phone: string;
  relationship: Relationship;
  notifyOnSos: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface VerificationMineDTO {
  isVerified: boolean;
  trustScore: number;
  latestRequest: {
    _id: string;
    userId: string;
    status: VerifStatus;
    reviewNote?: string;
    reviewedBy?: string;
    createdAt?: string;
    updatedAt?: string;
  } | null;
}

export interface UserReportDTO {
  _id: string;
  reporterId: string;
  reportedUserId: any;
  reason: string;
  details?: string;
  status: ReportStatus;
  actionNote?: string;
  outcome?: ReportOutcome;
  createdAt?: string;
}

export interface MeetingTimerDTO {
  _id: string;
  userId: string;
  meetWithUserId?: any;
  locationName: string;
  durationMinutes: number;
  startedAt: string;
  expiresAt: string;
  resolvedAt?: string;
  status: TimerStatus;
}

export interface SosIncidentDTO {
  _id: string;
  userId: string;
  source: SosSource;
  location?: GeoPoint;
  locationName: string;
  status: SosStatus;
  smsSent: boolean;
  adminNotified: boolean;
  contactsNotified: number;
  lastDispatchAt?: string;
  createdAt: string;
  resolvedAt?: string;
  triggeredTimerId?: string;
}

/* ===================================================
   PHASE 3B — SOCIAL MEDIA CORE BACKEND DTO CONTRACTS
   =================================================== */

export type PostVisibility = 'public' | 'followers' | 'connections' | 'private';
export type ModerationStatus = 'visible' | 'flagged' | 'hidden';
export type StoryVisibility = 'public' | 'followers' | 'connections';

export interface PostMediaDTO {
  url: string;
  storageKey: string;
  mediaType: 'image' | 'video';
  width?: number;
  height?: number;
  duration?: number;
  thumbnail?: string;
}

export interface PostDTO {
  id: string;
  communityId?: string;
  author: {
    _id: string;
    name: string;
    username: string;
    avatarHue: number;
    isVerified: boolean;
    trustScore: number;
    city?: string;
    bio?: string;
    occupation?: string;
  };
  caption: string;
  media: PostMediaDTO[];
  visibility: PostVisibility;
  locationName?: string;
  likeCount: number;
  commentCount: number;
  isLiked: boolean;
  isEdited: boolean;
  editedAt?: string;
  moderationStatus: ModerationStatus;
  createdAt: string;
}

export interface PostCommentDTO {
  id: string;
  postId: string;
  author: {
    _id: string;
    name: string;
    username: string;
    avatarHue: number;
    isVerified: boolean;
    trustScore: number;
  };
  text: string;
  isEdited: boolean;
  editedAt?: string;
  createdAt: string;
}

export interface StoryDTO {
  id: string;
  author: {
    _id: string;
    name: string;
    username: string;
    avatarHue: number;
    isVerified: boolean;
    trustScore: number;
  };
  media: PostMediaDTO;
  caption?: string;
  visibility: StoryVisibility;
  expiresAt: string;
  createdAt: string;
}

export interface StoryGroupDTO {
  user: {
    _id: string;
    name: string;
    username: string;
    avatarHue: number;
    isVerified: boolean;
    trustScore: number;
  };
  stories: StoryDTO[];
}

export interface StoryViewDTO {
  viewer: {
    _id: string;
    name: string;
    username: string;
    avatarHue: number;
    isVerified: boolean;
    trustScore: number;
  };
  viewedAt: string;
}

export interface FollowDTO {
  user: {
    _id: string;
    name: string;
    username: string;
    avatarHue: number;
    isVerified: boolean;
    trustScore: number;
  };
  followedAt: string;
}

export interface RelationshipDTO {
  userId?: string;
  isFollowing: boolean;
  isFollowedBy: boolean;
  connectionStatus: ConnStatus | 'none' | 'connected';
  isBlocked: boolean;
  canMessage?: boolean;
  canMeet?: boolean;
}

export interface UserProfileDTO {
  _id: string;
  id?: string;
  name: string;
  username: string;
  avatarHue?: number;
  isVerified: boolean;
  city?: string;
  bio?: string;
  occupation?: string;
  interests?: string[];
  lookingFor?: string[] | string;
  createdAt?: string;
  postsCount: number;
  followersCount: number;
  followingCount: number;
  mutualConnectionsCount: number;
  relationship: RelationshipDTO;
}

export interface FeedResponseDTO {
  items: PostDTO[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface SocialNotificationDTO {
  id: string;
  type: string;
  actor?: {
    id: string;
    name: string;
    username: string;
  } | null;
  targetType?: string;
  targetId?: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface MediaUploadResponseDTO {
  storageKey: string;
  url: string;
  mediaType: 'image' | 'video';
  mimeType: string;
  sizeBytes: number;
}

export interface ChatMessageDTO {
  _id: string;
  chatId: string;
  senderId: string;
  content: string;
  type: 'text' | 'image' | 'location';
  containsSensitive: boolean;
  sensitiveKinds?: string[];
  revealedBy?: string[];
  status: 'sent' | 'delivered' | 'read';
  createdAt: string;
  updatedAt: string;
}

export interface ConversationParticipantDTO {
  _id: string;
  name: string;
  username: string;
  avatarHue?: number;
  isVerified?: boolean;
  city?: string;
}

export interface ConversationDTO {
  _id: string;
  type: 'direct' | 'group';
  name?: string;
  participants: (string | ConversationParticipantDTO)[];
  otherUser?: ConversationParticipantDTO | null;
  lastMessage?: {
    _id: string;
    chatId: string;
    senderId: string;
    content: string;
    type: 'text' | 'image' | 'location';
    containsSensitive: boolean;
    status: 'sent' | 'delivered' | 'read';
    createdAt: string;
    updatedAt: string;
  } | null;
  lastMessageAt: string;
  unreadCount: number;
  relationship?: {
    connectionStatus: 'none' | 'pending' | 'accepted';
    canMeet: boolean;
    isFollowing: boolean;
    isFollower: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

export interface ChatReadResponseDTO {
  success: boolean;
  chatId: string;
  readCount: number;
}

export interface SafeUserDTO {
  id: string;
  name: string;
  username: string;
  avatarHue?: number;
  isVerified?: boolean;
  city?: string;
  bio?: string;
  occupation?: string;
}

export interface CommunityDTO {
  id: string;
  name: string;
  slug: string;
  description: string;
  avatar?: string;
  coverImage?: string;
  ownerId: string;
  privacy: 'public' | 'private';
  status: 'active' | 'suspended';
  memberCount: number;
  postCount: number;
  createdAt: string;
  updatedAt: string;
  isMember: boolean;
  userRole?: 'owner' | 'admin' | 'member';
  membershipStatus: 'active' | 'pending' | 'none';
}

export interface CommunityMemberDTO {
  id: string;
  user: SafeUserDTO;
  role: 'owner' | 'admin' | 'member';
  joinedAt: string;
}

export interface CommunityMembershipRequestDTO {
  id: string;
  user: SafeUserDTO;
  requestedAt: string;
}

export interface CommunityFeedResponseDTO {
  posts: PostDTO[];
  total: number;
  page: number;
  limit: number;
}


