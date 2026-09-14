/**
 * CASUALMEET — PHASE 3C-3 SOCIAL + SAFETY DEEP INTEGRATION TEST SUITE
 * 
 * Verifies all Phase 3C-3 requirements and explicit user directives:
 *  1. REMOVE public trustScore from consumer profile. Keep only isVerified.
 *  2. DO NOT invent custom venue functionality. Strictly reuse existing meetup/timer API.
 *  3. Make unblock remove ONLY the block state. Never automatically restore social relationships.
 *  4. Direct API / access-control tests on blocking across all surfaces.
 *  5. Loss of meetup authorization after connection removal.
 *  6. Test that unblock does not automatically restore follow, connection, messaging, or meetup permissions.
 *  7. Story reporting integration with moderation queue.
 *  8. Unified social and safety notifications.
 *  9. Location privacy audit (zero raw coordinate leaks).
 */

const BASE_URL = 'http://localhost:5000/api';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

async function request(path: string, options: any = {}) {
  const url = `${BASE_URL}${path}`;
  const headers: any = { ...(options.headers || {}) };
  if (options.body && typeof options.body === 'object') {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }
  const res = await fetch(url, { ...options, headers });
  let data: any = null;
  const text = await res.text();
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, data, headers: res.headers };
}

async function runPhase3c3Tests() {
  console.log('===============================================================');
  console.log('🛡️  CASUALMEET PHASE 3C-3 — SOCIAL + SAFETY INTEGRATION TESTS');
  console.log('===============================================================\n');

  try {
    // --- 0. Setup & Authenticate Test Personas ---
    console.log('--- 0. Authenticating Personas ---');
    // User A: Aisha Khan
    const loginA = await request('/auth/login', {
      method: 'POST',
      body: { identifier: 'aisha.k', password: 'user123' },
    });
    assert(loginA.status === 200 && Boolean(loginA.data?.token), 'Persona A (aisha.k) authenticated');
    const tokenA = loginA.data.token;
    const userA = loginA.data.user;
    const userAId = (userA.id || userA._id).toString();

    // User B: Rohan Mehta
    const loginB = await request('/auth/login', {
      method: 'POST',
      body: { identifier: 'rohan.m', password: 'user123' },
    });
    assert(loginB.status === 200 && Boolean(loginB.data?.token), 'Persona B (rohan.m) authenticated');
    const tokenB = loginB.data.token;
    const userB = loginB.data.user;
    const userBId = (userB.id || userB._id).toString();

    // User C: Priya Sharma
    const loginC = await request('/auth/login', {
      method: 'POST',
      body: { identifier: 'priya.s', password: 'user123' },
    });
    assert(loginC.status === 200 && Boolean(loginC.data?.token), 'Persona C (priya.s) authenticated');
    const tokenC = loginC.data.token;
    const userC = loginC.data.user;
    const userCId = (userC.id || userC._id).toString();

    const authA = { Authorization: `Bearer ${tokenA}` };
    const authB = { Authorization: `Bearer ${tokenB}` };
    const authC = { Authorization: `Bearer ${tokenC}` };

    // Clean any residual blocks and connections between test users
    await request('/connections/unblock', { method: 'POST', headers: authA, body: { targetUserId: userBId } });
    await request('/connections/unblock', { method: 'POST', headers: authB, body: { targetUserId: userAId } });
    await request('/connections/unblock', { method: 'POST', headers: authA, body: { targetUserId: userCId } });
    await request('/connections/unblock', { method: 'POST', headers: authC, body: { targetUserId: userAId } });
    await request(`/connections/user/${userBId}`, { method: 'DELETE', headers: authA });
    await request(`/connections/user/${userCId}`, { method: 'DELETE', headers: authA });
    await request(`/users/${userBId}/follow`, { method: 'DELETE', headers: authA });
    await request(`/users/${userAId}/follow`, { method: 'DELETE', headers: authB });
    await request(`/users/${userCId}/follow`, { method: 'DELETE', headers: authA });
    await request(`/users/${userAId}/follow`, { method: 'DELETE', headers: authC });

    // --- TEST 1: Public Profile & Directive #1 (trustScore strict removal) ---
    console.log('\n--- 1. Public Profile & trustScore Isolation (Directive #1) ---');
    const profileBRes = await request(`/users/${userBId}/profile`, { headers: authA });
    assert(profileBRes.status === 200, 'GET /api/users/:id/profile returns 200');
    const profB = profileBRes.data;

    // Check presence of public safe fields
    assert(profB.name === userB.name, 'Profile contains public display name');
    assert(profB.username === userB.username, 'Profile contains username');
    assert(typeof profB.isVerified === 'boolean', 'Profile contains boolean isVerified');
    assert(typeof profB.mutualConnectionsCount === 'number', 'Profile contains mutualConnectionsCount');
    assert(Boolean(profB.relationship), 'Profile contains relationship metadata');

    // STRICT VERIFICATION: trustScore must be undefined
    assert(profB.trustScore === undefined, 'DIRECTIVE #1: trustScore is strictly absent/undefined from public profile response');
    assert(!('trustScore' in profB), 'DIRECTIVE #1: trustScore key does NOT exist in returned JSON object');

    // Strict safety verification: private credentials absent
    assert(!profB.password && !profB.emergencyContacts && !profB.email, 'Private fields (password, email, emergency contacts) are omitted');

    // --- TEST 2: Follow != Meetup / Messaging Authorization ---
    console.log('\n--- 2. Follow Does NOT Authorize Meetup or Messaging ---');
    // Follow User C
    const followRes = await request(`/users/${userCId}/follow`, { method: 'POST', headers: authA });
    assert(followRes.status === 200, 'User A successfully follows User C');

    // Profile check: isFollowing is true, but canMeet and canMessage are false (no connection)
    const profCRes = await request(`/users/${userCId}/profile`, { headers: authA });
    assert(profCRes.status === 200, 'Fetched User C profile');
    assert(profCRes.data.relationship.isFollowing === true, 'relationship.isFollowing is true');
    assert(profCRes.data.relationship.connectionStatus !== 'connected', 'relationship.connectionStatus is not connected');
    assert(profCRes.data.relationship.canMeet === false, 'relationship.canMeet is false for follow-only relationship');
    assert(profCRes.data.relationship.canMessage === false, 'relationship.canMessage is false for follow-only relationship');

    // Attempting to start meetup timer with User C must be rejected with 403
    const timerFollowOnly = await request('/timers/start', {
      method: 'POST',
      headers: authA,
      body: {
        durationMinutes: 30,
        locationName: 'Indiranagar Metro Station',
        meetWithUserId: userCId,
      },
    });
    assert(timerFollowOnly.status === 403, 'Starting meetup timer with follow-only user is rejected with 403 Forbidden');
    assert(
      timerFollowOnly.data?.error?.includes('accepted connections') ||
      timerFollowOnly.data?.error?.includes('Accepted mutual connection'),
      'Error explicitly states accepted connection required'
    );

    // --- TEST 3: Meetup Timer Authorization & Directive #2 (Existing API usage) ---
    console.log('\n--- 3. Meetup Timer Authorization & Existing API (Directive #2) ---');
    // Test 3a: Self-meetup rejected
    const selfTimer = await request('/timers/start', {
      method: 'POST',
      headers: authA,
      body: {
        durationMinutes: 30,
        locationName: 'Central Mall',
        meetWithUserId: userAId,
      },
    });
    assert(selfTimer.status === 400, 'Self-meetup timer is rejected with 400 Bad Request');

    // Test 3b: Non-existent user rejected
    const invalidUserTimer = await request('/timers/start', {
      method: 'POST',
      headers: authA,
      body: {
        durationMinutes: 30,
        locationName: 'Central Mall',
        meetWithUserId: '507f1f77bcf86cd799439011',
      },
    });
    assert(invalidUserTimer.status === 404, 'Timer with non-existent user rejected with 404');

    // Establish mutual accepted connection between User A and User B
    // User A requests connection with User B
    const connReq = await request('/connections/request', {
      method: 'POST',
      headers: authA,
      body: { targetUserId: userBId },
    });
    assert(connReq.status === 201, 'User A sends connection request to User B');
    const connId = connReq.data._id;

    // User B accepts connection
    const connAccept = await request(`/connections/${connId}/accept`, {
      method: 'PUT',
      headers: authB,
    });
    assert(connAccept.status === 200, 'User B accepts connection request');

    // Now User A starts meetup safety timer with User B at verified Safe Zone or public venue
    const safeMeetup = await request('/timers/start', {
      method: 'POST',
      headers: authA,
      body: {
        durationMinutes: 45,
        locationName: 'Third Wave Coffee, Indiranagar',
        meetWithUserId: userBId,
      },
    });
    assert(safeMeetup.status === 201, 'DIRECTIVE #2: Meetup safety timer with accepted connection succeeds with 201 Created');
    assert(safeMeetup.data.status === 'active', 'Timer is created in active status');
    assert(safeMeetup.data.locationName === 'Third Wave Coffee, Indiranagar', 'Timer preserves locationName');
    const timerId = safeMeetup.data.id || safeMeetup.data._id;

    // Check-in safe on timer
    const checkin = await request(`/timers/${timerId}/safe`, { method: 'PUT', headers: authA });
    assert(checkin.status === 200 && checkin.data.status === 'safe', 'Timer marked safe successfully');

    // --- TEST 4: Loss of Meetup Authorization after Connection Removal (Directive #5) ---
    console.log('\n--- 4. Loss of Meetup Authorization after Connection Removal (Directive #5) ---');
    // Remove connection between User A and User B
    const removeConn = await request(`/connections/user/${userBId}`, {
      method: 'DELETE',
      headers: authA,
    });
    assert(removeConn.status === 200, 'Connection successfully deleted between User A and User B');

    // Check relationship from User A's perspective
    const profBAfterDisconnect = await request(`/users/${userBId}/profile`, { headers: authA });
    assert(profBAfterDisconnect.data.relationship.connectionStatus === 'none', 'Connection status returned to "none"');
    assert(profBAfterDisconnect.data.relationship.canMeet === false, 'canMeet is revoked (false)');

    // Attempting to start meetup timer now must be rejected with 403
    const timerAfterDisconnect = await request('/timers/start', {
      method: 'POST',
      headers: authA,
      body: {
        durationMinutes: 30,
        locationName: 'Blue Tokai Cafe',
        meetWithUserId: userBId,
      },
    });
    assert(timerAfterDisconnect.status === 403, 'DIRECTIVE #5: Meetup timer authorization is immediately revoked (403) after connection removal');

    // Reverse attempt: User B trying to meet User A must also be rejected
    const timerBtoAAfterDisconnect = await request('/timers/start', {
      method: 'POST',
      headers: authB,
      body: {
        durationMinutes: 30,
        locationName: 'Blue Tokai Cafe',
        meetWithUserId: userAId,
      },
    });
    assert(timerBtoAAfterDisconnect.status === 403, 'DIRECTIVE #5: Both parties immediately lose meetup authorization');

    // --- TEST 5: Direct API Access-Control Blocking (Directive #4) ---
    console.log('\n--- 5. Direct API Access-Control Blocking (Directive #4) ---');
    // Re-establish connection and mutual follows
    const connReq2 = await request('/connections/request', {
      method: 'POST',
      headers: authA,
      body: { targetUserId: userBId },
    });
    const accept2 = await request(`/connections/${connReq2.data._id}/accept`, { method: 'PUT', headers: authB });
    const chatId = accept2.data?.chatId;
    await request(`/users/${userBId}/follow`, { method: 'POST', headers: authA });
    await request(`/users/${userAId}/follow`, { method: 'POST', headers: authB });

    // User A blocks User B
    const blockRes = await request('/connections/block', {
      method: 'POST',
      headers: authA,
      body: { targetUserId: userBId },
    });
    assert(blockRes.status === 200, 'User A successfully blocks User B');

    // Direct API Test 5a: Blocked user B cannot send message to direct chat
    const blockedMsgSend = await request(`/chats/${chatId}/messages`, {
      method: 'POST',
      headers: authB,
      body: { content: 'Hey Aisha, are you there?' },
    });
    assert(blockedMsgSend.status === 403, 'DIRECTIVE #4: Direct chat message sending is blocked with 403 Forbidden');

    // Direct API Test 5b: Blocked user B cannot read messages from direct chat
    const blockedMsgRead = await request(`/chats/${chatId}/messages`, {
      headers: authB,
    });
    assert(blockedMsgRead.status === 403, 'DIRECTIVE #4: Direct chat message reading is blocked with 403 Forbidden');

    // Direct API Test 5c: Blocked user B cannot view User A profile
    const blockedProfileGet = await request(`/users/${userAId}/profile`, {
      headers: authB,
    });
    assert(blockedProfileGet.status === 403, 'DIRECTIVE #4: Direct profile fetch of blocking user returns 403 Forbidden');

    // Direct API Test 5d: Blocked user B cannot follow User A
    const blockedFollow = await request(`/users/${userAId}/follow`, {
      method: 'POST',
      headers: authB,
    });
    assert(blockedFollow.status === 400 || blockedFollow.status === 403, 'DIRECTIVE #4: Follow attempt by blocked user returns 400/403');

    // Direct API Test 5e: Blocked user B cannot start meetup timer with User A
    const blockedTimer = await request('/timers/start', {
      method: 'POST',
      headers: authB,
      body: {
        durationMinutes: 30,
        locationName: 'Cafe Coffee Day',
        meetWithUserId: userAId,
      },
    });
    assert(blockedTimer.status === 403, 'DIRECTIVE #4: Meetup timer start by blocked user returns 403 Forbidden');

    // --- TEST 6: Unblock Isolation (Directives #3 & #6) ---
    console.log('\n--- 6. Unblock Isolation (Directives #3 & #6) ---');
    // User A unblocks User B
    const unblockRes = await request('/connections/unblock', {
      method: 'POST',
      headers: authA,
      body: { targetUserId: userBId },
    });
    assert(unblockRes.status === 200, 'User A unblocks User B');
    assert(unblockRes.data.removedBlocks > 0, 'Block record was removed from database');

    // Check relationship state: must be clean 'none'
    const profBAfterUnblock = await request(`/users/${userBId}/profile`, { headers: authA });
    assert(profBAfterUnblock.status === 200, 'Profile accessible again after unblock');
    const relAfterUnblock = profBAfterUnblock.data.relationship;

    // DIRECTIVE #3 & #6: Never automatically restore social relationships!
    assert(relAfterUnblock.isBlocked === false, 'DIRECTIVE #3: Block state is cleared');
    assert(relAfterUnblock.connectionStatus === 'none', 'DIRECTIVE #3 & #6: Connection status is strictly "none" (NOT restored)');
    assert(relAfterUnblock.isFollowing === false, 'DIRECTIVE #6: Follow state is NOT restored (User A does not follow User B)');
    assert(relAfterUnblock.isFollowedBy === false, 'DIRECTIVE #6: Follow state is NOT restored (User B does not follow User A)');
    assert(relAfterUnblock.canMeet === false, 'DIRECTIVE #6: Meetup permission is NOT restored');
    assert(relAfterUnblock.canMessage === false, 'DIRECTIVE #6: Messaging permission is NOT restored');

    // Meetup timer attempt after unblock must still be rejected (requires re-connection)
    const timerAfterUnblock = await request('/timers/start', {
      method: 'POST',
      headers: authA,
      body: {
        durationMinutes: 30,
        locationName: 'Starbucks',
        meetWithUserId: userBId,
      },
    });
    assert(timerAfterUnblock.status === 403, 'DIRECTIVE #6: Meetup timer after unblock is rejected (403) until mutually reconnected');

    // --- TEST 7: Story Reporting into Moderation Queue ---
    console.log('\n--- 7. Story Reporting into Moderation Queue ---');
    // Upload media asset first
    const validPngBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const uploadStory = await request('/media/upload', {
      method: 'POST',
      headers: authA,
      body: { fileBase64: validPngBase64, filename: 'story_integration.png' },
    });
    const keyStory = uploadStory.data?.storageKey;

    // User A creates a story
    const storyRes = await request('/stories', {
      method: 'POST',
      headers: authA,
      body: {
        media: { storageKey: keyStory, duration: 15 },
        caption: 'Meetup in Indiranagar tonight!',
        visibility: 'public',
      },
    });
    assert(storyRes.status === 201, 'User A creates a story');
    const storyId = storyRes.data?.id || storyRes.data?.story?.id || storyRes.data?._id;
    assert(Boolean(storyId), 'Story ID obtained');

    // User B reports the story
    const reportRes = await request('/reports', {
      method: 'POST',
      headers: authB,
      body: {
        targetType: 'story',
        targetId: storyId,
        category: 'safety_risk',
        reason: 'Testing story reporting in Phase 3C-3',
        details: 'Story reported for review',
      },
    });
    assert(reportRes.status === 201, 'Story report created with 201 in moderation queue');
    assert(Boolean(reportRes.data?.reportId), 'Report is queued in pending moderation queue with reportId');

    // Author should NOT be auto-punished or suspended
    const checkAuthor = await request('/auth/me', { headers: authA });
    assert(checkAuthor.status === 200 && checkAuthor.data.status !== 'suspended', 'Author is NOT auto-punished without moderator review');

    // --- TEST 8: Unified Social and Safety Notifications ---
    console.log('\n--- 8. Unified Social & Safety Notifications ---');
    // Clean any previous connection between A and C
    await request(`/connections/user/${userCId}`, { method: 'DELETE', headers: authA });

    // Send connection request to User C
    const connReqC = await request('/connections/request', {
      method: 'POST',
      headers: authA,
      body: { targetUserId: userCId },
    });
    assert(connReqC.status === 201, 'Connection request sent to User C');

    // Check User C notifications
    const notifsC = await request('/notifications', { headers: authC });
    assert(notifsC.status === 200, 'User C fetched notifications');
    const connNotif = notifsC.data?.notifications?.find(
      (n: any) => n.type === 'connection_requested' && (n.actor?.id === userAId || n.actor?._id === userAId)
    );
    assert(Boolean(connNotif), 'Notification of type "connection_requested" delivered to recipient');

    // --- TEST 9: Location Privacy Audit (Zero Coordinate Leaks) ---
    console.log('\n--- 9. Location Privacy Audit (Zero Coordinate Leaks) ---');
    const feedRes = await request('/feed', { headers: authA });
    const feedStr = JSON.stringify(feedRes.data);
    assert(!feedStr.includes('"coordinates"') && !feedStr.includes('"exactLocation"'), 'Feed DTO contains zero exact coordinates');

    const profileStr = JSON.stringify(profB);
    assert(!profileStr.includes('"coordinates"') && !profileStr.includes('"latitude"'), 'Profile DTO contains zero coordinates');

    // Clean up connections created during testing
    await request(`/connections/user/${userCId}`, { method: 'DELETE', headers: authA });

    // --- SUMMARY ---
    console.log('\n===============================================================');
    console.log(`🎉 ALL TESTS COMPLETED: ${passed} PASSED, ${failed} FAILED`);
    console.log('===============================================================\n');

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err: any) {
    console.error('❌ Test suite execution threw an unexpected error:', err);
    process.exit(1);
  }
}

runPhase3c3Tests();
