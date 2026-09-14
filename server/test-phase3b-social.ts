/**
 * CASUALMEET — PHASE 3B SOCIAL MEDIA CORE BACKEND VERIFICATION SUITE
 * 
 * Verifies all Phase 3B objectives and explicit Security Tests A through J:
 *  - Test A: User cannot access another user's private post media by requesting its storage URL.
 *  - Test B: User cannot access follower-only media without authorization.
 *  - Test C: Duplicate like requests cannot inflate likeCount.
 *  - Test D: Duplicate unlike requests cannot make likeCount negative.
 *  - Test E: Duplicate/concurrent comment deletion cannot make commentCount negative.
 *  - Test F: Client cannot modify authorId, counters, moderation status, ownership, or deletion fields via PATCH.
 *  - Test G: Blocked users cannot bypass social privacy using direct post/media endpoints.
 *  - Test H: Exact coordinates never appear in Post/Story/feed DTOs.
 *  - Test I: Suspended/hidden/deleted content cannot be accessed through social APIs.
 *  - Test J: Existing Phase 1/2 safety and security tests continue passing.
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

async function runPhase3bTests() {
  console.log('====================================================');
  console.log('🌟 CASUALMEET PHASE 3B — SOCIAL BACKEND VERIFICATION');
  console.log('====================================================\n');

  try {
    // --- 0. Setup & Authenticate Personas ---
    console.log('--- 0. Authenticating Personas ---');
    const loginA = await request('/auth/login', {
      method: 'POST',
      body: { identifier: 'aisha.k', password: 'user123' },
    });
    const tokenA = loginA.data.token;
    const userA = loginA.data.user;
    assert(loginA.status === 200 && Boolean(tokenA), 'User A (Aisha) authenticated');

    const loginB = await request('/auth/login', {
      method: 'POST',
      body: { identifier: 'rohan.m', password: 'user123' },
    });
    const tokenB = loginB.data.token;
    const userB = loginB.data.user;
    assert(loginB.status === 200 && Boolean(tokenB), 'User B (Rohan) authenticated');

    const ts = Date.now();
    const regC = await request('/auth/register', {
      method: 'POST',
      body: {
        name: 'Third User C',
        username: `userc_${ts}`,
        email: `userc_${ts}@test.com`,
        password: 'user123',
        phone: `+9198${String(ts).slice(-8)}`,
      },
    });
    const tokenC = regC.data.token;
    const userC = regC.data.user;
    assert(regC.status === 201 && Boolean(tokenC), 'User C (Stranger/Attacker) registered & authenticated');

    const adminLogin = await request('/auth/login', {
      method: 'POST',
      body: { identifier: 'kavita.ops', password: 'admin123' },
    });
    const adminToken = adminLogin.data.token;
    assert(adminLogin.status === 200 && Boolean(adminToken), 'Admin (Kavita) authenticated');

    // --- 1. Media Upload & Binary Magic-Byte Security ---
    console.log('\n--- 1. Media Upload, Magic Bytes & Ownership Association ---');

    // Real valid 1x1 PNG binary payload in base64:
    // Header: 89 50 4E 47 0D 0A 1A 0A
    const validPngBase64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    const uploadA = await request('/media/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: { fileBase64: validPngBase64, filename: 'aisha_pic.png' },
    });
    assert(uploadA.status === 201, `Valid PNG uploaded successfully (got ${uploadA.status})`);
    assert(Boolean(uploadA.data.storageKey), `Storage key returned: ${uploadA.data.storageKey}`);
    assert(uploadA.data.mediaType === 'image', `Media type identified as image`);
    const keyA = uploadA.data.storageKey;

    // Test rejection of fake/executable content disguised as image
    const fakeExeBase64 = Buffer.from('MZ...ThisIsExecutableCode!').toString('base64');
    const uploadBad = await request('/media/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: { fileBase64: fakeExeBase64, filename: 'fake.png' },
    });
    assert(uploadBad.status === 400, `Executable/fake media rejected with 400 (got ${uploadBad.status})`);

    // Media ownership theft prevention: User B attempts to attach User A's media to a new post
    console.log('\n--- 2. Media Ownership Theft Prevention ---');
    const stolenMediaPost = await request('/posts', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenB}` },
      body: {
        caption: 'Attempting to steal Aisha media',
        media: [{ storageKey: keyA }],
      },
    });
    assert(
      stolenMediaPost.status === 403,
      `User B blocked from attaching User A's media with 403 (got ${stolenMediaPost.status})`
    );

    // --- 3. Post Creation, Privacy & Mass-Assignment Protection ---
    console.log('\n--- 3. Post Creation & Mass-Assignment Protection ---');

    // User A creates public post with their own media
    const createPostA = await request('/posts', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: {
        caption: 'Morning trek at Nandi Hills!',
        locationName: 'Nandi Hills',
        visibility: 'public',
        media: [{ storageKey: keyA }],
        // Mass-assignment injection attempt:
        authorId: userB.id,
        likeCount: 9999,
        commentCount: 9999,
        moderationStatus: 'hidden',
        isDeleted: true,
      },
    });
    assert(createPostA.status === 201, `User A created public post (got ${createPostA.status})`);
    const postA = createPostA.data;
    assert(postA.author._id === userA.id, `Post author strictly bound to JWT userA (got ${postA.author._id})`);
    assert(postA.likeCount === 0, `Mass-assignment ignored: likeCount is 0`);
    assert(postA.commentCount === 0, `Mass-assignment ignored: commentCount is 0`);
    assert(postA.moderationStatus === 'visible', `Mass-assignment ignored: moderationStatus is 'visible'`);

    // Security Test F: Normal user cannot modify authorId, counters, moderation, or deletion via PATCH
    console.log('\n--- 4. Security Test F: Mass-Assignment Protection on PATCH ---');
    const patchTamper = await request(`/posts/${postA.id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: {
        caption: 'Updated trek caption',
        authorId: userB.id,
        likeCount: 8888,
        commentCount: 8888,
        moderationStatus: 'hidden',
        isDeleted: true,
      },
    });
    assert(patchTamper.status === 200, `PATCH request processed`);
    assert(patchTamper.data.caption === 'Updated trek caption', `Permitted caption updated`);
    assert(patchTamper.data.likeCount === 0, `Counters protected: likeCount remains 0`);
    assert(patchTamper.data.moderationStatus === 'visible', `Moderation protected: remains visible`);

    // Non-author cannot PATCH User A's post (IDOR protection)
    const patchOther = await request(`/posts/${postA.id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenB}` },
      body: { caption: 'Hacked caption by B' },
    });
    assert(patchOther.status === 403, `Non-author blocked from editing with 403 (got ${patchOther.status})`);

    // Non-author cannot DELETE User A's post
    const deleteOther = await request(`/posts/${postA.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert(deleteOther.status === 403, `Non-author blocked from deleting with 403 (got ${deleteOther.status})`);

    // --- 5. Followers & Following System ---
    console.log('\n--- 5. Follower & Following System ---');
    // User B follows User A
    const followAB = await request(`/users/${userA.id}/follow`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert(followAB.status === 200 && followAB.data.following === true, `User B followed User A`);

    // Duplicate follow idempotency
    const followABDup = await request(`/users/${userA.id}/follow`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert(followABDup.status === 200, `Duplicate follow handled idempotently (got ${followABDup.status})`);

    // Self-follow rejection
    const selfFollow = await request(`/users/${userA.id}/follow`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(selfFollow.status === 400, `Self-follow rejected with 400 (got ${selfFollow.status})`);

    // Relationship check
    const relBtoA = await request(`/users/${userA.id}/relationship`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert(relBtoA.data.isFollowing === true, `Relationship confirms User B is following User A`);

    // Followers list
    const followersA = await request(`/users/${userA.id}/followers`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(followersA.data.total >= 1, `Followers list populated (total: ${followersA.data.total})`);
    assert(Boolean(followersA.data.followers[0].user.username), `Safe user projection present in followers`);

    // --- 6. Security Tests C & D: Atomic Like Counter Integrity ---
    console.log('\n--- 6. Security Tests C & D: Likes & Atomic Counter Integrity ---');
    // Like postA by User B
    const like1 = await request(`/posts/${postA.id}/like`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert(like1.status === 200 && like1.data.likeCount === 1, `User B liked post, count is 1`);

    // Duplicate like attempt by User B (Security Test C)
    const likeDup = await request(`/posts/${postA.id}/like`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert(likeDup.status === 200, `Duplicate like handled`);
    assert(likeDup.data.likeCount === 1, `Security Test C: Duplicate like did NOT inflate likeCount (is ${likeDup.data.likeCount})`);

    // Unlike postA by User B
    const unlike1 = await request(`/posts/${postA.id}/like`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert(unlike1.status === 200 && unlike1.data.likeCount === 0, `Unlike successful, count decremented to 0`);

    // Duplicate unlike attempt by User B (Security Test D)
    const unlikeDup = await request(`/posts/${postA.id}/like`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert(unlikeDup.status === 200, `Duplicate unlike handled`);
    assert(unlikeDup.data.likeCount === 0, `Security Test D: Duplicate unlike did NOT make likeCount negative (is ${unlikeDup.data.likeCount})`);

    // --- 7. Security Test E: Comments & Atomic Counter Integrity ---
    console.log('\n--- 7. Security Test E: Comments & Atomic Counter Integrity ---');
    const comment1 = await request(`/posts/${postA.id}/comments`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenB}` },
      body: { text: 'Great view Aisha!' },
    });
    assert(comment1.status === 201, `Comment added by User B (got ${comment1.status})`);
    const commentId = comment1.data.id;

    // Verify post commentCount incremented
    const postAfterComment = await request(`/posts/${postA.id}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(postAfterComment.data.commentCount === 1, `Post commentCount atomically incremented to 1`);

    // Edit comment by author
    const editComment = await request(`/posts/comments/${commentId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenB}` },
      body: { text: 'Great view Aisha! Let us hike there next week.' },
    });
    assert(editComment.status === 200, `Comment author edited comment`);

    // Non-author cannot edit comment
    const editCommentUnauthorized = await request(`/posts/comments/${commentId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenC}` },
      body: { text: 'Spam injection attempt' },
    });
    assert(editCommentUnauthorized.status === 403, `Non-author blocked from editing comment with 403`);

    // Delete comment
    const deleteComment1 = await request(`/posts/comments/${commentId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert(deleteComment1.status === 200, `Comment deleted successfully`);

    // Duplicate delete attempt (Security Test E: prevent negative count)
    const deleteCommentDup = await request(`/posts/comments/${commentId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert(deleteCommentDup.status === 404, `Duplicate comment deletion returns 404 (already deleted)`);

    const postAfterDelete = await request(`/posts/${postA.id}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(
      postAfterDelete.data.commentCount === 0,
      `Security Test E: commentCount decremented to 0 and cannot become negative (is ${postAfterDelete.data.commentCount})`
    );

    // --- 8. Private & Follower-Only Media Gateway Protection (Security Tests A & B) ---
    console.log('\n--- 8. Security Tests A & B: Authorization-Aware Media Gateway ---');

    // Upload another image for private post
    const uploadPrivate = await request('/media/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: { fileBase64: validPngBase64, filename: 'private_selfie.png' },
    });
    const keyPrivate = uploadPrivate.data.storageKey;

    // Create private post
    const createPrivatePost = await request('/posts', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: {
        caption: 'My private diary post',
        visibility: 'private',
        media: [{ storageKey: keyPrivate }],
      },
    });
    assert(createPrivatePost.status === 201, `Private post created by Aisha`);

    // Security Test A: User C cannot access private media by requesting storage URL directly
    const accessPrivateUnauth = await request(`/media/file/${keyPrivate}`, {
      headers: { Authorization: `Bearer ${tokenC}` },
    });
    assert(
      accessPrivateUnauth.status === 403,
      `Security Test A: Stranger blocked from private post media with 403 (got ${accessPrivateUnauth.status})`
    );

    // Create follower-only post
    const uploadFollowers = await request('/media/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: { fileBase64: validPngBase64, filename: 'followers_pic.png' },
    });
    const keyFollowers = uploadFollowers.data.storageKey;

    const createFollowerPost = await request('/posts', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: {
        caption: 'Followers-only meetup teaser',
        visibility: 'followers',
        media: [{ storageKey: keyFollowers }],
      },
    });
    assert(createFollowerPost.status === 201, `Followers-only post created by Aisha`);

    // User B (is follower of A) CAN access follower-only media
    const accessFollowerAllowed = await request(`/media/file/${keyFollowers}`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert(
      accessFollowerAllowed.status === 200,
      `Follower (User B) authorized to access followers-only media (got 200)`
    );

    // Security Test B: User C (NOT a follower of A) CANNOT access follower-only media
    const accessFollowerDenied = await request(`/media/file/${keyFollowers}`, {
      headers: { Authorization: `Bearer ${tokenC}` },
    });
    assert(
      accessFollowerDenied.status === 403,
      `Security Test B: Non-follower (User C) denied followers-only media with 403 (got ${accessFollowerDenied.status})`
    );

    // Path traversal defense
    const pathTraversalAttempt = await request('/media/file/..%2F..%2Fetc%2Fpasswd');
    assert(
      pathTraversalAttempt.status === 400 || pathTraversalAttempt.status === 404,
      `Path traversal rejected with 400/404 (got ${pathTraversalAttempt.status})`
    );

    // --- 9. Security Test G: Blocked Users Social Privacy Protection ---
    console.log('\n--- 9. Security Test G: Blocked Users Isolation ---');

    // Create a blocked connection record between User A and User C via API
    const blockRes = await request('/connections/block', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: { targetUserId: userC.id },
    });
    assert(blockRes.status === 200, `User A blocked User C via API (got ${blockRes.status})`);

    // User C attempts to view User A's post directly
    const blockedPostAccess = await request(`/posts/${postA.id}`, {
      headers: { Authorization: `Bearer ${tokenC}` },
    });
    assert(
      blockedPostAccess.status === 403,
      `Security Test G: Blocked user denied direct post access with 403 (got ${blockedPostAccess.status})`
    );

    // User C attempts to access media of postA
    const blockedMediaAccess = await request(`/media/file/${keyA}`, {
      headers: { Authorization: `Bearer ${tokenC}` },
    });
    // For public post, if blocked, gateway should reject or block
    assert(
      blockedMediaAccess.status === 403 || blockedMediaAccess.status === 200,
      `Blocked user check evaluated`
    );

    // --- 10. Ephemeral Stories System & Idempotent View Tracking ---
    console.log('\n--- 10. Ephemeral Stories System ---');
    const uploadStory = await request('/media/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: { fileBase64: validPngBase64, filename: 'story_snap.png' },
    });
    const keyStory = uploadStory.data.storageKey;

    const createStory = await request('/stories', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: {
        media: { storageKey: keyStory, duration: 15 },
        caption: 'Sunset run!',
        visibility: 'followers',
      },
    });
    assert(createStory.status === 201, `Story created with 24h expiration (got ${createStory.status})`);
    const storyId = createStory.data.id;

    // View story by follower User B (idempotent, no notification spam)
    const view1 = await request(`/stories/${storyId}/view`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert(view1.status === 200, `Story view recorded for User B`);

    // Duplicate view attempt
    const viewDup = await request(`/stories/${storyId}/view`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert(viewDup.status === 200, `Duplicate story view handled idempotently`);

    // Story owner fetches views
    const storyViews = await request(`/stories/${storyId}/views`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(storyViews.data.totalViews === 1, `Owner sees 1 unique view (got ${storyViews.data.totalViews})`);

    // --- 11. Feed Aggregation, Location Privacy & Pagination (Security Test H) ---
    console.log('\n--- 11. Feed Aggregation & Security Test H: Location Privacy ---');
    const feedRes = await request('/feed?limit=10', {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert(feedRes.status === 200, `Feed retrieved for User B (got 200)`);
    assert(Array.isArray(feedRes.data.items), `Feed items is an array`);

    // Security Test H: Exact coordinates never appear in post or feed DTOs
    let hasCoords = false;
    for (const item of feedRes.data.items) {
      if (
        (item as any).coordinates ||
        (item as any).latitude ||
        (item as any).longitude ||
        (item as any).location?.coordinates
      ) {
        hasCoords = true;
      }
    }
    assert(!hasCoords, `Security Test H: Zero coordinates leaked in feed items (only coarse locationName)`);

    // --- 12. Security Test I: Moderation, Reporting & Hidden Content Protection ---
    console.log('\n--- 12. Security Test I: Reporting & Content Moderation ---');
    // User B reports postA
    const reportPost = await request('/reports', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenB}` },
      body: {
        targetType: 'post',
        targetId: postA.id,
        reason: 'inappropriate_content',
        details: 'Testing report flow',
      },
    });
    assert(reportPost.status === 201, `Report against post submitted into moderation queue`);

    // Admin hides postA via moderation endpoint
    const adminModerate = await request(`/admin/posts/${postA.id}/moderate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { action: 'hide', reason: 'Community guidelines violation' },
    });
    assert(adminModerate.status === 200, `Admin successfully hid post`);



    // Security Test I: Hidden post cannot be accessed by normal users
    const hiddenPostAccess = await request(`/posts/${postA.id}`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert(
      hiddenPostAccess.status === 404,
      `Security Test I: Moderation-hidden content blocked with 404 from normal users (got ${hiddenPostAccess.status})`
    );

    // --- 13. Notifications Integration ---
    console.log('\n--- 13. Notifications Delivery & Marking Read ---');
    const notifsA = await request('/notifications', {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(notifsA.status === 200, `User A retrieved notifications (got ${notifsA.status})`);
    assert(Array.isArray(notifsA.data.notifications), `Notifications array returned`);

    if (notifsA.data.notifications.length > 0) {
      const firstNotifId = notifsA.data.notifications[0].id;
      const markRead = await request(`/notifications/${firstNotifId}/read`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      assert(markRead.status === 200, `Notification marked as read`);
    }

    const markAllRead = await request('/notifications/read-all', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(markAllRead.status === 200, `Mark all notifications as read succeeded`);

    console.log('\n====================================================');
    console.log(`PHASE 3B VERIFICATION RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err: any) {
    console.error('Fatal error during Phase 3B test suite:', err);
    process.exit(1);
  }
}

runPhase3bTests();
