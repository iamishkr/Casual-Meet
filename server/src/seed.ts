import bcrypt from 'bcryptjs';
import { User } from './models/User.js';
import { Location } from './models/Location.js';
import { SafeZone } from './models/SafeZone.js';
import { EmergencyContact } from './models/EmergencyContact.js';
import { Connection } from './models/Connection.js';
import { Chat } from './models/Chat.js';
import { Message } from './models/Message.js';
import { DailyStat } from './models/DailyStat.js';

export async function seedDatabase() {
  const count = await User.countDocuments();
  if (count > 0) {
    console.log('[Seed] Database already contains records. Skipping initial seed.');
    return;
  }

  console.log('[Seed] Seeding initial database with demo profiles, safe zones, and test data...');

  const userPasswordHash = await bcrypt.hash('user123', 10);
  const adminPasswordHash = await bcrypt.hash('admin123', 10);

  // 1. Seed Users
  const aisha = await User.create({
    name: 'Aisha Khan',
    username: 'aisha.k',
    email: 'aisha.k@casualmeet.app',
    passwordHash: userPasswordHash,
    phone: '+919812004571',
    city: 'Indiranagar, Bengaluru',
    avatarHue: 36,
    age: 26,
    occupation: 'UX Researcher',
    bio: 'Weekend trekker, all-week coffee snob. Looking for hiking buddies around Indiranagar.',
    interests: ['Trekking', 'Coffee', 'Photography', 'Board games'],
    lookingFor: 'Friendship & activity buddies',
    isVerified: true,
    trustScore: 128,
    role: 'user',
  });

  const rohan = await User.create({
    name: 'Rohan Mehta',
    username: 'rohan.m',
    email: 'rohan.m@casualmeet.app',
    passwordHash: userPasswordHash,
    phone: '+919822007711',
    city: 'Koramangala, Bengaluru',
    avatarHue: 205,
    age: 28,
    occupation: 'Backend Engineer',
    bio: 'Run at 6, code at 9. Koramangala regular — always up for a slow coffee.',
    interests: ['Running', 'Startups', 'Coffee', 'Cricket'],
    lookingFor: 'Friendship',
    isVerified: false,
    trustScore: 104,
    role: 'user',
  });

  const priya = await User.create({
    name: 'Priya Sharma',
    username: 'priya.s',
    email: 'priya.s@casualmeet.app',
    passwordHash: userPasswordHash,
    phone: '+919833445566',
    city: 'HSR Layout, Bengaluru',
    avatarHue: 320,
    age: 25,
    occupation: 'Content Writer',
    bio: 'I write about food and actually mean it. Open to chatting with anyone civil.',
    interests: ['Food blogs', 'Poetry', 'Yoga'],
    lookingFor: 'Casual conversations',
    isVerified: true,
    trustScore: 121,
    role: 'user',
  });

  const kavita = await User.create({
    name: 'Kavita Rao',
    username: 'kavita.ops',
    email: 'kavita.ops@casualmeet.app',
    passwordHash: adminPasswordHash,
    phone: '+919800112233',
    city: 'Bengaluru HQ',
    avatarHue: 220,
    age: 34,
    occupation: 'Trust & Safety Lead',
    bio: 'Keeping the map safe.',
    interests: ['Policy', 'Trail runs'],
    lookingFor: '—',
    role: 'super_admin',
    isVerified: true,
    trustScore: 150,
  });

  const rahul = await User.create({
    name: 'Rahul Verma',
    username: 'rahul.mod',
    email: 'rahul.mod@casualmeet.app',
    passwordHash: adminPasswordHash,
    phone: '+919800554433',
    city: 'Bengaluru Safety Center',
    avatarHue: 180,
    age: 30,
    occupation: 'Safety Operations Specialist',
    bio: 'Trust & Safety Moderator.',
    interests: ['Safety', 'Cycling'],
    lookingFor: '—',
    role: 'moderator',
    isVerified: true,
    trustScore: 140,
  });

  // 2. Seed Locations (Indiranagar, Koramangala, HSR)
  await Location.create([
    { userId: aisha._id, location: { type: 'Point', coordinates: [77.6412, 12.9719] } },
    { userId: rohan._id, location: { type: 'Point', coordinates: [77.6245, 12.9352] } },
    { userId: priya._id, location: { type: 'Point', coordinates: [77.6446, 12.9116] } },
    { userId: kavita._id, location: { type: 'Point', coordinates: [77.6033, 12.9719] } },
  ]);

  // 3. Seed Safe Zones
  await SafeZone.create([
    { name: 'Koramangala Police Station', category: 'police_station', area: 'Koramangala 5th Block', location: { type: 'Point', coordinates: [77.6186, 12.9352] } },
    { name: 'Indiranagar Metro Station', category: 'public_transit', area: '100 Feet Road', location: { type: 'Point', coordinates: [77.6403, 12.9712] } },
    { name: 'Starbucks Indiranagar', category: 'cafe', area: '12th Main', location: { type: 'Point', coordinates: [77.6433, 12.9716] } },
    { name: 'Phoenix Marketcity', category: 'mall', area: 'Whitefield Road', location: { type: 'Point', coordinates: [77.692, 12.9867] } },
    { name: 'Manipal Hospital Old Airport Rd', category: 'hospital', area: 'HAL Old Airport Rd', location: { type: 'Point', coordinates: [77.6533, 12.958] } },
  ]);

  // 4. Seed Emergency Contacts
  await EmergencyContact.create([
    { userId: aisha._id, name: 'Farida Khan (Mother)', phone: '+919812004571', relationship: 'family', notifyOnSos: true },
    { userId: aisha._id, name: 'Zoe Fernandes (Best friend)', phone: '+14155550134', relationship: 'friend', notifyOnSos: true },
    { userId: rohan._id, name: 'Suresh Mehta (Father)', phone: '+919822007711', relationship: 'family', notifyOnSos: true },
  ]);

  // 5. Seed Connection & Chat between Aisha and Rohan
  await Connection.create({
    requesterId: rohan._id,
    receiverId: aisha._id,
    status: 'accepted',
  });

  const chat = await Chat.create({
    type: 'direct',
    participants: [aisha._id, rohan._id],
    lastMessageAt: new Date(),
  });

  await Message.create([
    {
      chatId: chat._id,
      senderId: rohan._id,
      content: 'Hey! Are we still on for the Cubbon Park run tomorrow morning?',
      type: 'text',
      status: 'read',
    },
    {
      chatId: chat._id,
      senderId: aisha._id,
      content: 'Absolutely! 6:30 at the statue circle? I will start a meeting timer once we meet so my sister can relax 😄',
      type: 'text',
      status: 'read',
    },
    {
      chatId: chat._id,
      senderId: rohan._id,
      content: 'Perfect. First coffee on me if you beat my 5k time.',
      type: 'text',
      status: 'read',
    },
  ]);

  // 6. Seed Daily Analytics
  const now = Date.now();
  const dayMs = 86400000;
  const stats = [
    { offset: 13, reg: 41, con: 57, msg: 612, sos: 0 },
    { offset: 12, reg: 38, con: 63, msg: 655, sos: 1 },
    { offset: 11, reg: 52, con: 71, msg: 731, sos: 0 },
    { offset: 10, reg: 47, con: 66, msg: 698, sos: 0 },
    { offset: 9, reg: 59, con: 80, msg: 804, sos: 2 },
    { offset: 8, reg: 63, con: 88, msg: 921, sos: 0 },
    { offset: 7, reg: 71, con: 95, msg: 1042, sos: 1 },
    { offset: 6, reg: 66, con: 91, msg: 987, sos: 0 },
    { offset: 5, reg: 58, con: 84, msg: 903, sos: 0 },
    { offset: 4, reg: 74, con: 102, msg: 1130, sos: 1 },
    { offset: 3, reg: 80, con: 110, msg: 1216, sos: 0 },
    { offset: 2, reg: 77, con: 104, msg: 1189, sos: 0 },
    { offset: 1, reg: 85, con: 118, msg: 1301, sos: 2 },
    { offset: 0, reg: 34, con: 49, msg: 566, sos: 0 },
  ];

  for (const s of stats) {
    const d = new Date(now - s.offset * dayMs);
    const dateLabel = `${d.getDate()} ${d.toLocaleString('en', { month: 'short' })}`;
    const dateKey = d.toISOString().split('T')[0];
    await DailyStat.create({
      date: dateLabel,
      dateKey,
      registrations: s.reg,
      connections: s.con,
      messages: s.msg,
      sos: s.sos,
    });
  }

  console.log('[Seed] Demo database seeded successfully.');
}
