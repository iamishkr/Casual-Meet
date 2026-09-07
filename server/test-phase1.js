/**
 * CASUALMEET — PHASE 1 BACKEND VERIFICATION & HARDENING SUITE
 * 
 * Tests all Phase 1 requirements:
 *  1. Message reveal IDOR
 *  2. SOS RBAC & Authorization (User, Moderator, Super Admin)
 *  3. Emergency contact ownership (JWT derived, zero cross-user access)
 *  4. Verification submission ownership & duplicate prevention
 *  5. Report ownership, categories & self-report prevention
 *  6. Location updates (strict bounds, ownership, safe response)
 *  7. Geospatial discovery with $geoNear & strict coordinate redaction
 *  8. Safe Zone consumer access & admin protection
 *  9. Safety timer state machine & authoritative server-side worker expiration
 * 10. SOS Idempotency (duplicate active SOS prevention)
 * 11. JWT secret configuration & fail-fast validation
 * 12. Socket.io authentication & gateway authorization
 */

import { io as ClientIO } from 'socket.io-client';
import { getJwtSecret, validateJwtConfig } from './src/config/jwt.js';

const BASE_URL = 'http://localhost:5000';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const res = await fetch(url, { ...options, headers });
  let data = null;
  const text = await res.text();
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, data, headers: res.headers };
}

async function runPhase1Tests() {
  console.log('====================================================');
  console.log('🛡️ CASUALMEET PHASE 1 — BACKEND VERIFICATION SUITE');
  console.log('====================================================\n');

  try {
    // --- SETUP: Authenticate Personas ---
    console.log('--- 0. Authenticating Personas ---');
    
    // Aisha (User A)
    const loginA = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier: 'aisha.k', password: 'user123' }),
    });
    const tokenA = loginA.data.token;
    const userA = loginA.data.user;
    assert(loginA.status === 200 && Boolean(tokenA), 'User A (Aisha) authenticated');

    // Rohan (User B)
    const loginB = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier: 'rohan.m', password: 'user123' }),
    });
    const tokenB = loginB.data.token;
    const userB = loginB.data.user;
    assert(loginB.status === 200 && Boolean(tokenB), 'User B (Rohan) authenticated');

    // User C (Third-party / Attacker)
    const usernameC = `userc_${Date.now().toString(36)}`;
    const regC = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'User C',
        username: usernameC,
        email: `${usernameC}@example.com`,
        phone: '+919876500099',
        password: 'Password123!',
      }),
    });
    const tokenC = regC.data.token;
    const userC = regC.data.user;
    assert(regC.status === 201 && Boolean(tokenC), 'User C (Attacker/Third-party) registered & authenticated');

    // Super Admin (Kavita Rao)
    const loginAdmin = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        identifier: 'kavita.ops',
        password: 'admin123',
        targetRole: 'super_admin',
      }),
    });
    const tokenAdmin = loginAdmin.data.token;
    assert(loginAdmin.status === 200 && loginAdmin.data.user.role === 'super_admin', 'Super Admin (Kavita) authenticated');

    // Moderator (Rahul Verma)
    const loginMod = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        identifier: 'rahul.mod',
        password: 'admin123',
      }),
    });
    const tokenMod = loginMod.data.token;
    assert(loginMod.status === 200 && loginMod.data.user.role === 'moderator', 'Safety Moderator (Rahul) authenticated');

    // --- TEST 1: Message Reveal IDOR Protection ---
    console.log('\n--- 1. Message Reveal IDOR Protection ---');
    const chatsRes = await request('/api/chats', {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(chatsRes.status === 200 && Array.isArray(chatsRes.data), 'Aisha retrieved conversation list');
    
    let chatId = chatsRes.data[0]?._id;
    let messageId = null;

    if (chatId) {
      // Send a message containing a sensitive phone number to trigger blurring
      const msgRes = await request(`/api/chats/${chatId}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenA}` },
        body: JSON.stringify({ content: 'Call me on 9812004571 later tonight', type: 'text' }),
      });
      assert(msgRes.status === 201, 'Sensitive message sent and persisted');
      messageId = msgRes.data.message?._id;
    }

    if (messageId) {
      // Attack: User C (not in chat A-B) attempts to reveal the message
      const idorAttack = await request(`/api/chats/messages/${messageId}/reveal`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${tokenC}` },
      });
      assert(idorAttack.status === 403, `User C blocked from revealing A-B message with 403 (got ${idorAttack.status})`);
      assert(idorAttack.data.error?.includes('participant'), 'Error confirms user is not a conversation participant');

      // Legit: User B (participant) reveals the message
      const legitReveal = await request(`/api/chats/messages/${messageId}/reveal`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${tokenB}` },
      });
      assert(legitReveal.status === 200, 'Participant (User B) successfully revealed message (got 200)');
      assert(Array.isArray(legitReveal.data.revealedBy) && legitReveal.data.revealedBy.length > 0, 'User B recorded in revealedBy list');
    }

    // --- TEST 2: SOS RBAC & Authorization ---
    // Ensure Aisha has no unresolved active SOS from earlier runs
    const activeCheck = await request('/api/sos/active', {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    if (activeCheck.data?._id) {
      await request(`/api/sos/${activeCheck.data._id}/resolve`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${tokenA}` },
        body: JSON.stringify({ resolutionNotes: 'Pre-test reset' }),
      });
    }

    // Aisha triggers SOS
    const sosTrigger = await request('/api/sos/trigger', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        locationName: 'Indiranagar 100ft Road',
        location: { type: 'Point', coordinates: [77.64, 12.97] },
      }),
    });
    assert(sosTrigger.status === 201, `Aisha triggered SOS successfully (got ${sosTrigger.status})`);
    const sosId = sosTrigger.data.sos?._id || sosTrigger.data._id;

    // User C attempts to resolve Aisha's SOS
    const unauthorizedResolve = await request(`/api/sos/${sosId}/resolve`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenC}` },
      body: JSON.stringify({ resolutionNotes: 'Fake resolution by attacker' }),
    });
    assert(unauthorizedResolve.status === 403, `Unauthorized normal user cannot resolve another user's SOS (got ${unauthorizedResolve.status})`);

    // Moderator resolves Aisha's SOS
    const modResolve = await request(`/api/sos/${sosId}/resolve`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenMod}` },
      body: JSON.stringify({ resolutionNotes: 'Verified safe by Safety Moderator' }),
    });
    assert(modResolve.status === 200, `Authorized Moderator resolves SOS incident (got ${modResolve.status})`);
    assert(modResolve.data.status === 'resolved', 'SOS status updated to "resolved"');
    assert(modResolve.data.resolvedByRole === 'moderator', 'Audit logs resolvedByRole as "moderator"');

    // Super Admin accesses administrative SOS overview
    const adminSosView = await request('/api/sos/active', {
      headers: { Authorization: `Bearer ${tokenAdmin}` },
    });
    assert(adminSosView.status === 200, 'Super Admin accesses active safety incidents');

    // --- TEST 3: Emergency Contact Ownership & Validation ---
    console.log('\n--- 3. Emergency Contact Ownership & Validation ---');
    // Ensure Aisha is below the 5-contact limit before adding test contact
    const existingContacts = await request('/api/contacts', {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    if (Array.isArray(existingContacts.data) && existingContacts.data.length >= 5) {
      for (let i = 2; i < existingContacts.data.length; i++) {
        await request(`/api/contacts/${existingContacts.data[i]._id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${tokenA}` },
        });
      }
    }

    // User A creates emergency contact
    const contactCreate = await request('/api/contacts', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        name: 'Farida Khan (Mom)',
        phone: '+919812004571',
        relationship: 'Mother',
        notifyOnSos: true,
      }),
    });
    assert(contactCreate.status === 201, `User A created emergency contact (got ${contactCreate.status})`);
    const contactId = contactCreate.data?._id;
    assert(contactCreate.data?.userId === userA.id, 'Server derived contact ownership strictly from JWT');

    // Invalid phone number rejected
    const badPhone = await request('/api/contacts', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        name: 'Invalid Phone Number',
        phone: '123',
        relationship: 'Friend',
      }),
    });
    assert(badPhone.status === 400, `Short invalid phone number rejected with 400 (got ${badPhone.status})`);

    // User C attempts to read User A's contact
    const crossRead = await request(`/api/contacts/${contactId}`, {
      headers: { Authorization: `Bearer ${tokenC}` },
    });
    assert(crossRead.status === 404, `User C cannot view User A's emergency contact (got ${crossRead.status})`);

    // User C attempts to delete User A's contact
    const crossDelete = await request(`/api/contacts/${contactId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenC}` },
    });
    assert(crossDelete.status === 404, `User C cannot delete User A's emergency contact (got ${crossDelete.status})`);

    // User A updates own contact
    const ownUpdate = await request(`/api/contacts/${contactId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ name: 'Farida Khan (Mother - Primary)' }),
    });
    assert(ownUpdate.status === 200 && ownUpdate.data.name === 'Farida Khan (Mother - Primary)', 'User A updated own contact successfully');

    // User A deletes own test contact
    const ownDelete = await request(`/api/contacts/${contactId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(ownDelete.status === 200, 'User A deleted own emergency contact successfully');

    // --- TEST 4: Verification Submission Ownership ---
    console.log('\n--- 4. Verification Submission Ownership ---');
    const verifySubmit = await request('/api/verification/submit', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenC}` },
      body: JSON.stringify({
        selfieUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD...',
        idType: 'government_id',
      }),
    });
    assert(verifySubmit.status === 201, `User C submitted verification request (got ${verifySubmit.status})`);

    // Duplicate active submission blocked
    const duplicateVerify = await request('/api/verification/submit', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenC}` },
      body: JSON.stringify({
        selfieUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD...',
        idType: 'government_id',
      }),
    });
    assert(duplicateVerify.status === 400, `Duplicate pending verification blocked with 400 (got ${duplicateVerify.status})`);

    // User C views own verification status
    const ownVerify = await request('/api/verification/mine', {
      headers: { Authorization: `Bearer ${tokenC}` },
    });
    assert(ownVerify.status === 200 && Boolean(ownVerify.data.latestRequest), 'User C retrieves own verification submission');

    // --- TEST 5: User Incident Reporting API ---
    console.log('\n--- 5. User Incident Reporting API ---');
    // Self-reporting rejected
    const selfReport = await request('/api/reports', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        reportedUserId: userA.id,
        category: 'harassment',
        reason: 'Attempting to report self',
      }),
    });
    assert(selfReport.status === 400, `Self-reporting blocked with 400 (got ${selfReport.status})`);

    // Valid report on User C
    const legitReport = await request('/api/reports', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        reportedUserId: userC.id,
        category: 'suspicious_behavior',
        reason: 'Suspicious scanning activity detected',
      }),
    });
    assert(legitReport.status === 201, `User A filed report against User C (got ${legitReport.status})`);

    // User A reads their own reports
    const myReports = await request('/api/reports/mine', {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(myReports.status === 200 && Array.isArray(myReports.data) && myReports.data.length > 0, 'User A views own submitted reports');

    // --- TEST 6: Location Update Ownership & Strict Bounds ---
    console.log('\n--- 6. Location Update Ownership & Strict Bounds ---');
    // Latitude out of bounds (> 90)
    const badLat = await request('/api/location', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ latitude: 95.0, longitude: 77.64 }),
    });
    assert(badLat.status === 400, `Latitude > 90 rejected with 400 (got ${badLat.status})`);

    // Longitude out of bounds (< -180)
    const badLng = await request('/api/location', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ latitude: 12.97, longitude: -195.0 }),
    });
    assert(badLng.status === 400, `Longitude < -180 rejected with 400 (got ${badLng.status})`);

    // Valid location update
    const validLoc = await request('/api/location', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ latitude: 12.9719, longitude: 77.6412, city: 'Indiranagar, Bengaluru' }),
    });
    assert(validLoc.status === 200 && validLoc.data.success === true, `Valid location updated (got ${validLoc.status})`);
    assert(validLoc.data.latitude === undefined && validLoc.data.coordinates === undefined, 'Exact coordinates strictly withheld from response DTO');

    // --- TEST 7: Geospatial Discovery ($geoNear) & Privacy Redaction ---
    console.log('\n--- 7. Geospatial Discovery ($geoNear) & Privacy Redaction ---');
    const discoverRes = await request('/api/discover?lat=12.9719&lng=77.6412&radiusKm=25', {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(discoverRes.status === 200, `Geospatial discovery with $geoNear returned 200 (got ${discoverRes.status})`);
    const people = Array.isArray(discoverRes.data) ? discoverRes.data : (discoverRes.data.people || []);
    assert(Array.isArray(people), 'Response contains people array');

    let leakedCoords = false;
    let leakedPhone = false;
    let leakedEmail = false;

    for (const p of people) {
      const u = p.user || p;
      if (p.coordinates || p.latitude || p.longitude || u.coordinates || u.latitude || u.longitude) leakedCoords = true;
      if (p.phone || u.phone) leakedPhone = true;
      if (p.email || u.email) leakedEmail = true;
      if (typeof p.distanceKm === 'number') {
        assert(p.distanceKm >= 0, `Discovery distance calculated via $geoNear: ${p.distanceKm} km for ${u.name}`);
      }
    }
    assert(!leakedCoords, 'No raw coordinates leaked in discovery items');
    assert(!leakedPhone, 'No private phone numbers leaked in discovery items');
    assert(!leakedEmail, 'No private email addresses leaked in discovery items');

    // --- TEST 8: Safe Zone Consumer Access & Admin Protection ---
    console.log('\n--- 8. Safe Zone Consumer Access & Admin Protection ---');
    // Consumer gets public safe zones
    const safeZones = await request('/api/safe-zones', {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const zones = Array.isArray(safeZones.data) ? safeZones.data : (safeZones.data?.safeZones || []);
    assert(safeZones.status === 200 && Array.isArray(zones), 'Consumer successfully accesses public Safe Zones');
    assert(zones.length > 0, `Found ${zones.length} verified public Safe Zones`);

    // Consumer blocked from admin safe zone creation
    const adminBlock = await request('/api/admin/safe-zones', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ name: 'Fake Safe Zone Venue' }),
    });
    assert(adminBlock.status === 403, `Normal consumer blocked from admin safe-zone creation with 403 (got ${adminBlock.status})`);

    // --- TEST 9: Safety Timer State Machine & Server-Side Expiration ---
    console.log('\n--- 9. Safety Timer State Machine & Server-Side Expiration ---');
    // Create meeting timer
    const timerCreate = await request('/api/timers', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenB}` },
      body: JSON.stringify({
        locationName: 'Starbucks Indiranagar',
        durationMinutes: 30,
        meetupLocation: { type: 'Point', coordinates: [77.6433, 12.9716] },
      }),
    });
    assert(timerCreate.status === 201, `Timer created with status: ${timerCreate.data.status}`);
    const timerId = timerCreate.data._id;

    // Extend timer (active -> extended)
    const timerExtend = await request(`/api/timers/${timerId}/extend`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenB}` },
      body: JSON.stringify({ addMinutes: 15 }),
    });
    assert(timerExtend.status === 200 && timerExtend.data.status === 'extended', 'Timer transitioned from active -> extended');

    // Mark timer safe (extended -> safe)
    const timerSafe = await request(`/api/timers/${timerId}/safe`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert(timerSafe.status === 200 && timerSafe.data.status === 'safe', 'Timer transitioned from extended -> safe');

    // Cannot extend an already safe timer (invalid state machine transition)
    const badExtend = await request(`/api/timers/${timerId}/extend`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenB}` },
      body: JSON.stringify({ addMinutes: 15 }),
    });
    assert(badExtend.status === 400, `Cannot extend a safe timer; rejected with 400 (got ${badExtend.status})`);

    // Authoritative Server-Side Expiration Test: arm timer marked testExpireNow
    const expiredTimerRes = await request('/api/timers', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        locationName: 'Expired Meetup Venue',
        testExpireNow: true,
      }),
    });
    assert(expiredTimerRes.status === 201, 'Created timer configured with past expiration for worker verification');

    // Trigger authoritative server-side timer worker check
    const workerCheck = await request('/api/admin/timers/check-expired', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenAdmin}` },
    });
    assert(workerCheck.status === 200, 'Server-side timer worker check triggered via admin API');
    assert(workerCheck.data.processedCount >= 1, `Worker detected and processed expired timer (count: ${workerCheck.data.processedCount})`);

    // Verify timer transitioned to 'expired'
    const aishaTimers = await request('/api/timers', {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const transitionedTimer = aishaTimers.data?.find((t) => t._id === expiredTimerRes.data._id);
    assert(transitionedTimer?.status === 'expired', 'Timer document status atomically transitioned to "expired"');

    // Verify auto-SOS was escalated on server side for Aisha
    const aishaActiveSos = await request('/api/sos/active', {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const autoSos = aishaActiveSos.data;
    assert(Boolean(autoSos) && autoSos.triggeredTimerId === expiredTimerRes.data._id, 'SOS incident was created authoritative on timer expiration');
    assert(autoSos?.source === 'timer_expired', 'Auto-escalated SOS incident marked with source: "timer_expired"');

    // Cleanup: Resolve the auto-escalated SOS
    if (autoSos?._id) {
      await request(`/api/sos/${autoSos._id}/resolve`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${tokenA}` },
        body: JSON.stringify({ resolutionNotes: 'Auto-timer test resolved by User A' }),
      });
    }

    // --- TEST 10: SOS Idempotency (Prevent Duplicate Active SOS) ---
    console.log('\n--- 10. SOS Idempotency (Prevent Duplicate Active SOS) ---');
    // Rohan triggers manual SOS
    const sos1 = await request('/api/sos/trigger', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenB}` },
      body: JSON.stringify({ locationName: 'Indiranagar Metro Station' }),
    });
    assert(sos1.status === 201, `Rohan triggered manual SOS (got ${sos1.status})`);

    // Immediate second trigger while first is active
    const sos2 = await request('/api/sos/trigger', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenB}` },
      body: JSON.stringify({ locationName: 'Indiranagar Metro Station Again' }),
    });
    assert(sos2.status === 400, `Duplicate active SOS prevented with 400 (got ${sos2.status})`);
    assert(sos2.data.error?.toLowerCase().includes('active sos'), 'Error indicates active incident already exists');

    // Running worker check again will NOT create duplicate SOS
    const workerSecondRun = await request('/api/admin/timers/check-expired', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenAdmin}` },
    });
    assert(workerSecondRun.data.sosCreatedCount === 0, 'Worker check confirmed 0 duplicate SOS incidents created (sosCreatedCount: 0)');

    // Cleanup: Rohan resolves own SOS
    const sos1Id = sos1.data.sos?._id || sos1.data._id;
    const cleanupSos = await request(`/api/sos/${sos1Id}/resolve`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenB}` },
      body: JSON.stringify({ resolutionNotes: 'Test cleanup resolved by Rohan' }),
    });
    assert(cleanupSos.status === 200, 'Rohan resolved own SOS incident cleanly');

    // --- TEST 11: JWT Secret Configuration & Fail-Fast Validation ---
    console.log('\n--- 11. JWT Secret Configuration & Fail-Fast Validation ---');
    try {
      const secret = getJwtSecret();
      assert(typeof secret === 'string' && secret.length > 0, 'JWT secret configured and validated');

      // Test fail-fast in production mode with empty secret
      const oldEnv = process.env.NODE_ENV;
      const oldSecret = process.env.JWT_SECRET;
      process.env.NODE_ENV = 'production';
      delete process.env.JWT_SECRET;

      let threwInProd = false;
      try {
        validateJwtConfig();
      } catch (prodErr) {
        threwInProd = true;
      }
      assert(threwInProd, 'validateJwtConfig() fails fast in production when JWT_SECRET is missing');

      // Restore environment
      process.env.NODE_ENV = oldEnv;
      if (oldSecret) process.env.JWT_SECRET = oldSecret;
    } catch (err) {
      assert(false, `JWT validation failed: ${err.message}`);
    }

    // --- TEST 12: Socket.io Authentication & Gateway Authorization ---
    console.log('\n--- 12. Socket.io Authentication & Gateway Authorization ---');
    await new Promise((resolve) => {
      const badSocket = ClientIO(BASE_URL, {
        reconnection: false,
        timeout: 2000,
      });

      badSocket.on('connect_error', (err) => {
        assert(err.message.includes('token') || err.message.includes('Authentication'), `Unauthenticated socket rejected: ${err.message}`);
        badSocket.disconnect();

        const goodSocket = ClientIO(BASE_URL, {
          auth: { token: tokenA },
          reconnection: false,
          timeout: 2000,
        });

        goodSocket.on('connect', () => {
          assert(true, `Authenticated Socket.io connection established for user ${userA.id}`);
          goodSocket.disconnect();
          resolve(true);
        });

        goodSocket.on('connect_error', (goodErr) => {
          assert(false, `Authenticated socket failed: ${goodErr.message}`);
          goodSocket.disconnect();
          resolve(false);
        });
      });
    });

  } catch (err) {
    console.error('Unexpected test failure:', err);
    failed++;
  }

  console.log('\n====================================================');
  console.log(`PHASE 1 VERIFICATION RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runPhase1Tests();
