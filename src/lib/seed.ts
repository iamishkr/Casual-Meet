import type {
  AppState, Chat, Connection, DayStat, EmergencyContact, Message, SafeZone,
  AccountSuspension, SosDeliveryLog, SosEvent, User, UserLocation, UserReport, VerificationRequest,
} from './types';
import { point } from './utils';

const now = Date.now();
const mins = (n: number) => n * 60_000;
const hrs = (n: number) => n * 3_600_000;
const days = (n: number) => n * 86_400_000;

const U = (u: Partial<User> & Pick<User, 'id' | 'name' | 'username' | 'city' | 'avatarHue'>): User => ({
  email: `${u.username}@casualmeet.app`,
  phone: '+91 98' + String(Math.abs(u.avatarHue * 7919) % 100000000).padStart(8, '0'),
  age: 26,
  bio: 'New here — be kind.',
  occupation: 'Product designer',
  interests: ['coffee'],
  lookingFor: 'Friendship',
  role: 'user',
  isVerified: false,
  trustScore: 100,
  showLocation: true,
  allowMessages: 'connections',
  onboardingComplete: true,
  expoPushToken: `ExponentPushToken[${u.username}-x9f2]`,
  joinedDaysAgo: 40,
  ...u,
});

export const users: User[] = [
  U({ id: 'u_aisha', name: 'Aisha Khan', username: 'aisha.k', city: 'Indiranagar, Bengaluru', avatarHue: 36, age: 26, occupation: 'UX Researcher', bio: 'Weekend trekker, all-week coffee snob. Looking for hiking buddies around Indiranagar.', interests: ['Trekking', 'Coffee', 'Photography', 'Board games'], lookingFor: 'Friendship & activity buddies', isVerified: true, trustScore: 128, joinedDaysAgo: 122 }),
  U({ id: 'u_rohan', name: 'Rohan Mehta', username: 'rohan.m', city: 'Koramangala, Bengaluru', avatarHue: 205, age: 28, occupation: 'Backend Engineer', bio: 'Run at 6, code at 9. Koramangala regular — always up for a slow coffee.', interests: ['Running', 'Startups', 'Coffee', 'Cricket'], lookingFor: 'Friendship', trustScore: 104, joinedDaysAgo: 87 }),
  U({ id: 'u_priya', name: 'Priya Sharma', username: 'priya.s', city: 'HSR Layout, Bengaluru', avatarHue: 320, age: 25, occupation: 'Content Writer', bio: 'I write about food and actually mean it. Open to chatting with anyone civil.', interests: ['Food blogs', 'Poetry', 'Yoga'], lookingFor: 'Casual conversations', isVerified: true, trustScore: 121, allowMessages: 'everyone', joinedDaysAgo: 64 }),
  U({ id: 'u_kabir', name: 'Kabir Anand', username: 'kabir.a', city: 'MG Road, Bengaluru', avatarHue: 152, age: 30, occupation: 'Architect', bio: 'Sketching the city one cafe at a time.', interests: ['Architecture', 'Cycling', 'Jazz'], lookingFor: 'Friendship', joinedDaysAgo: 210 }),
  U({ id: 'u_sneha', name: 'Sneha Reddy', username: 'sneha.r', city: 'Jayanagar, Bengaluru', avatarHue: 262, age: 27, occupation: 'Data Analyst', bio: 'Filter coffee > everything. Jayanagar walker.', interests: ['Analytics', 'Filter coffee', 'Kathak'], lookingFor: 'Activity buddies', isVerified: true, trustScore: 117, joinedDaysAgo: 150 }),
  U({ id: 'u_arjun', name: 'Arjun Nair', username: 'arjun.n', city: 'Whitefield, Bengaluru', avatarHue: 12, age: 29, occupation: 'DevOps Lead', bio: 'Weekends are for badminton and biryani.', interests: ['Badminton', 'Biryani', 'Gadgets'], lookingFor: 'Sports partners', joinedDaysAgo: 33 }),
  U({ id: 'u_meera', name: 'Meera Iyer', username: 'meera.i', city: 'BTM Layout, Bengaluru', avatarHue: 190, age: 24, occupation: 'Masters student', bio: 'New to Bengaluru. Looking for study-cafe company.', interests: ['Books', 'Cafe hopping', 'Sketching'], lookingFor: 'Friendship', joinedDaysAgo: 9 }),
  U({ id: 'u_dev', name: 'Dev Patel', username: 'dev.p', city: 'Marathahalli, Bengaluru', avatarHue: 80, age: 31, occupation: 'Sales Manager', bio: 'Here to meet people, obviously.', interests: ['Movies', 'Gym'], lookingFor: 'Dating', trustScore: 71, joinedDaysAgo: 58 }),
  U({ id: 'u_ananya', name: 'Ananya Gupta', username: 'ananya.g', city: 'Malleshwaram, Bengaluru', avatarHue: 280, age: 26, occupation: 'Illustrator', bio: 'Privacy-first person. I browse, I rarely broadcast.', interests: ['Illustration', 'Indie music'], lookingFor: 'Friendship', showLocation: false, joinedDaysAgo: 76 }),
  U({ id: 'u_vivaan', name: 'Vivaan Joshi', username: 'vivaan.j', city: 'Hebbal, Bengaluru', avatarHue: 48, age: 23, occupation: 'Intern', bio: '', interests: [], lookingFor: 'Friendship', onboardingComplete: false, joinedDaysAgo: 1 }),
  U({ id: 'u_ishita', name: 'Ishita Verma', username: 'ishita.v', city: 'JP Nagar, Bengaluru', avatarHue: 340, age: 27, occupation: 'HR Associate', bio: 'Dog person. Weekend hiker. JP Nagar side.', interests: ['Dogs', 'Hiking', 'Baking'], lookingFor: 'Friendship', joinedDaysAgo: 95 }),
  U({ id: 'u_aditya', name: 'Aditya Kulkarni', username: 'aditya.k', city: 'Electronic City, Bengaluru', avatarHue: 120, age: 32, occupation: 'Consultant', bio: 'Trust the process.', interests: ['Chess'], lookingFor: 'Networking', trustScore: 58, joinedDaysAgo: 140 }),
  U({ id: 'u_kavita', name: 'Kavita Rao', username: 'kavita.ops', city: 'Bengaluru HQ', avatarHue: 220, age: 34, occupation: 'Trust & Safety Lead', bio: 'Keeping the map safe.', interests: ['Policy', 'Trail runs'], lookingFor: '—', role: 'super_admin', isVerified: true, trustScore: 150, showLocation: false, joinedDaysAgo: 400 }),
];

export const locations: UserLocation[] = [
  { userId: 'u_aisha', location: point(77.6412, 12.9719), updatedAt: now - mins(4) },   // Indiranagar
  { userId: 'u_rohan', location: point(77.6245, 12.9352), updatedAt: now - mins(11) },  // Koramangala
  { userId: 'u_priya', location: point(77.6446, 12.9116), updatedAt: now - mins(22) },  // HSR
  { userId: 'u_kabir', location: point(77.6049, 12.9754), updatedAt: now - hrs(1) },    // MG Road
  { userId: 'u_sneha', location: point(77.5830, 12.9308), updatedAt: now - hrs(2) },    // Jayanagar
  { userId: 'u_arjun', location: point(77.7499, 12.9698), updatedAt: now - hrs(3) },    // Whitefield
  { userId: 'u_meera', location: point(77.6101, 12.9166), updatedAt: now - mins(40) },  // BTM
  { userId: 'u_dev', location: point(77.7011, 12.9569), updatedAt: now - hrs(5) },      // Marathahalli
  { userId: 'u_ananya', location: point(77.5725, 13.0030), updatedAt: now - hrs(8) },   // Malleshwaram
  { userId: 'u_vivaan', location: point(77.5900, 13.0358), updatedAt: now - mins(2) },  // Hebbal
  { userId: 'u_ishita', location: point(77.5858, 12.9077), updatedAt: now - hrs(6) },   // JP Nagar
  { userId: 'u_aditya', location: point(77.6601, 12.8410), updatedAt: now - hrs(30) },  // E-City
  { userId: 'u_kavita', location: point(77.6033, 12.9719), updatedAt: now - hrs(1) },
];

export const contacts: EmergencyContact[] = [
  { id: 'ec_1', userId: 'u_aisha', name: 'Farida Khan (Mother)', phone: '+919812004571', relationship: 'family', notifyOnSos: true },
  { id: 'ec_2', userId: 'u_aisha', name: 'Imran Khan (Brother)', phone: '+919900112233', relationship: 'family', notifyOnSos: true },
  { id: 'ec_3', userId: 'u_aisha', name: 'Zoe Fernandes (Best friend)', phone: '+14155550134', relationship: 'friend', notifyOnSos: true },
  { id: 'ec_4', userId: 'u_rohan', name: 'Suresh Mehta (Father)', phone: '+919822007711', relationship: 'family', notifyOnSos: true },
  { id: 'ec_5', userId: 'u_rohan', name: 'Nikhil Bose (Friend)', phone: '+919765443322', relationship: 'friend', notifyOnSos: true },
];

export const connections: Connection[] = [
  { id: 'cn_1', requesterId: 'u_rohan', receiverId: 'u_aisha', status: 'accepted', createdAt: now - days(12) },
  { id: 'cn_2', requesterId: 'u_aisha', receiverId: 'u_priya', status: 'accepted', createdAt: now - days(6) },
  { id: 'cn_3', requesterId: 'u_kabir', receiverId: 'u_rohan', status: 'accepted', createdAt: now - days(20) },
  { id: 'cn_4', requesterId: 'u_sneha', receiverId: 'u_aisha', status: 'pending', createdAt: now - hrs(3) },
  { id: 'cn_5', requesterId: 'u_aisha', receiverId: 'u_dev', status: 'pending', createdAt: now - hrs(26) },
  { id: 'cn_6', requesterId: 'u_ishita', receiverId: 'u_rohan', status: 'pending', createdAt: now - hrs(7) },
  { id: 'cn_7', requesterId: 'u_meera', receiverId: 'u_aisha', status: 'accepted', createdAt: now - days(2) },
];

export const chats: Chat[] = [
  { id: 'c_aisha_rohan', type: 'direct', participants: ['u_aisha', 'u_rohan'], lastMessageAt: now - mins(3) },
  { id: 'c_aisha_priya', type: 'direct', participants: ['u_aisha', 'u_priya'], lastMessageAt: now - hrs(4) },
  { id: 'c_rohan_kabir', type: 'direct', participants: ['u_rohan', 'u_kabir'], lastMessageAt: now - days(1) },
  { id: 'c_aisha_meera', type: 'direct', participants: ['u_aisha', 'u_meera'], lastMessageAt: now - hrs(9) },
];

const M = (m: Partial<Message> & Pick<Message, 'id' | 'chatId' | 'senderId' | 'content'>): Message => ({
  type: 'text', containsSensitive: false, sensitiveKinds: [], status: 'read', sentAt: now - hrs(1), ...m,
});

export const messages: Message[] = [
  M({ id: 'm_1', chatId: 'c_aisha_rohan', senderId: 'u_rohan', content: 'Hey! Are we still on for the Cubbon Park run tomorrow morning?', sentAt: now - hrs(2) - mins(6) }),
  M({ id: 'm_2', chatId: 'c_aisha_rohan', senderId: 'u_aisha', content: 'Absolutely. 6:30 at the statue circle? I will start a meeting timer once we meet so my sister can relax 😄', sentAt: now - hrs(2) - mins(2) }),
  M({ id: 'm_3', chatId: 'c_aisha_rohan', senderId: 'u_rohan', content: 'Perfect. First coffee on me if you beat my 5k time.', sentAt: now - mins(3) }),
  M({ id: 'm_4', chatId: 'c_aisha_priya', senderId: 'u_priya', content: 'That HSR cafe list you sent was gold. Adding three more this weekend.', sentAt: now - hrs(4) }),
  M({ id: 'm_5', chatId: 'c_aisha_priya', senderId: 'u_aisha', content: 'Told you! The filter coffee at the third one is ridiculous.', sentAt: now - hrs(4) + mins(6) }),
  M({ id: 'm_6', chatId: 'c_rohan_kabir', senderId: 'u_kabir', content: 'Bring the badminton racket Saturday, no excuses this time.', sentAt: now - days(1) }),
  M({ id: 'm_7', chatId: 'c_aisha_meera', senderId: 'u_meera', content: 'Thanks for the study-cafe suggestions! Will try the one near metro.', sentAt: now - hrs(9) }),
];

export const safeZones: SafeZone[] = [
  { id: 'sz_1', name: 'Koramangala Police Station', category: 'police_station', area: 'Koramangala 5th Block', location: point(77.6186, 12.9352) },
  { id: 'sz_2', name: 'Indiranagar Metro Station', category: 'public_transit', area: '100 Feet Road', location: point(77.6403, 12.9712) },
  { id: 'sz_3', name: 'Starbucks Indiranagar', category: 'cafe', area: '12th Main', location: point(77.6433, 12.9716) },
  { id: 'sz_4', name: 'Phoenix Marketcity', category: 'mall', area: 'Whitefield Road', location: point(77.6920, 12.9867) },
  { id: 'sz_5', name: 'Manipal Hospital Old Airport Rd', category: 'hospital', area: 'HAL Old Airport Rd', location: point(77.6533, 12.9580) },
  { id: 'sz_6', name: 'Third Wave Coffee Koramangala', category: 'cafe', area: '80 Feet Road', location: point(77.6106, 12.9345) },
];

export const verifications: VerificationRequest[] = [
  { id: 'vr_1', userId: 'u_meera', selfieUrl: 'selfie://capture/meera_live', status: 'pending', submittedAtWall: now - hrs(2) },
  { id: 'vr_2', userId: 'u_aisha', selfieUrl: 'selfie://capture/aisha_live', status: 'approved', reviewedBy: 'u_kavita', reviewNote: 'Face matches profile photo. Liveness check passed.', submittedAtWall: now - days(90), reviewedAtWall: now - days(90) + hrs(5) },
];

export const reports: UserReport[] = [
  { id: 'rp_1', reporterId: 'u_priya', reportedUserId: 'u_dev', reason: 'Shared contact details repeatedly', details: 'Kept sending his number and UPI handle even after I said I only chat on-platform. Three messages in a row.', status: 'pending', createdAtWall: now - hrs(5) },
  { id: 'rp_2', reporterId: 'u_sneha', reportedUserId: 'u_aditya', reason: 'Suspected fake profile', details: 'Profile photos look stock-model. Asked to meet at an odd location far from any public spot.', status: 'actioned', outcome: 'user_suspended', actionNote: 'Identity could not be confirmed; profile images reverse-matched to stock library. Temporary suspension pending verification.', resolvedBy: 'u_kavita', createdAtWall: now - days(2), resolvedAtWall: now - days(2) + hrs(3) },
  { id: 'rp_3', reporterId: 'u_kabir', reportedUserId: 'u_vivaan', reason: 'Spam in chat', details: 'Sent the same internship link four times.', status: 'dismissed', outcome: 'false_report', actionNote: 'Messages were onboarding tutorial prompts, not spam. Reporter confirmed misunderstanding.', resolvedBy: 'u_kavita', createdAtWall: now - days(6), resolvedAtWall: now - days(5) },
];

export const suspensions: AccountSuspension[] = [
  { id: 'sus_1', userId: 'u_aditya', suspendedBy: 'u_kavita', type: 'temporary', reason: 'rp_2 — unverified identity, unsafe meetup suggestion', isActive: true, createdAtWall: now - days(2), expiresAtWall: now + days(5) },
];

export const sosHistory: SosEvent[] = [
  {
    id: 'sos_seed', userId: 'u_sneha', source: 'manual', location: point(77.583, 12.9308), locationName: 'Jayanagar 4th Block',
    status: 'resolved', smsSent: true, adminNotified: true, contactsNotified: 2,
    createdAtV: -hrs(19), createdAtWall: now - hrs(19), resolvedAtWall: now - hrs(19) + mins(24),
  },
];

export const sosHistoryLogs: SosDeliveryLog[] = [
  { id: 'dl_s1', sosId: 'sos_seed', contactId: 'ecx_1', contactName: 'Ramesh Reddy (Father)', contactPhone: '+919845012340', gateway: 'fast2sms', status: 'sent', attempts: 1, gatewayResponse: { sid: 'F2S_99120a', cost: '₹0.16' }, updatedAtWall: now - hrs(19) },
  { id: 'dl_s2', sosId: 'sos_seed', contactId: 'ecx_2', contactName: 'Kavya Reddy (Sister)', contactPhone: '+919035011227', gateway: 'fast2sms', status: 'sent', attempts: 1, gatewayResponse: { sid: 'F2S_99121b', cost: '₹0.16' }, updatedAtWall: now - hrs(19) },
];

const day = (i: number) => {
  const d = new Date(now - days(13 - i));
  return `${d.getDate()} ${d.toLocaleString('en', { month: 'short' })}`;
};

export const daily: DayStat[] = [
  { date: day(0), registrations: 41, connections: 57, messages: 612, sos: 0 },
  { date: day(1), registrations: 38, connections: 63, messages: 655, sos: 1 },
  { date: day(2), registrations: 52, connections: 71, messages: 731, sos: 0 },
  { date: day(3), registrations: 47, connections: 66, messages: 698, sos: 0 },
  { date: day(4), registrations: 59, connections: 80, messages: 804, sos: 2 },
  { date: day(5), registrations: 63, connections: 88, messages: 921, sos: 0 },
  { date: day(6), registrations: 71, connections: 95, messages: 1042, sos: 1 },
  { date: day(7), registrations: 66, connections: 91, messages: 987, sos: 0 },
  { date: day(8), registrations: 58, connections: 84, messages: 903, sos: 0 },
  { date: day(9), registrations: 74, connections: 102, messages: 1130, sos: 1 },
  { date: day(10), registrations: 80, connections: 110, messages: 1216, sos: 0 },
  { date: day(11), registrations: 77, connections: 104, messages: 1189, sos: 0 },
  { date: day(12), registrations: 85, connections: 118, messages: 1301, sos: 2 },
  { date: day(13), registrations: 34, connections: 49, messages: 566, sos: 0 },
];

export const seedState: Omit<AppState, 'vnow' | 'feed' | 'toasts' | 'typing'> = {
  timeScale: 60,
  personaId: 'u_aisha',
  adminId: 'u_kavita',
  users, locations, contacts, connections, chats, messages,
  timers: [],
  sosEvents: sosHistory,
  deliveryLogs: sosHistoryLogs,
  verifications, reports, suspensions, safeZones, daily,
  bootAtWall: now,
};
