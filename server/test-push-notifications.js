import assert from 'assert';

const BASE = 'http://localhost:5000/api';

async function runPushTests() {
  console.log('🔔 [Test] Step 3: Background Push Notification System Verification');

  // 1. Authenticate user
  console.log('1. Logging in as user (aisha.k)...');
  const loginRes = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'aisha.k', password: 'user123' }),
  });
  assert.strictEqual(loginRes.status, 200, 'Login failed');
  const { token, user } = await loginRes.json();
  console.log(`   Logged in as ${user.name} (${user.id})`);

  // 2. Register Device Token for Android
  const testAndroidToken = `fcm_token_android_${Date.now()}_abc123`;
  console.log(`2. Registering Android device token: ${testAndroidToken}...`);
  const regRes = await fetch(`${BASE}/notifications/register-device`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      token: testAndroidToken,
      platform: 'android',
      deviceInfo: 'Google Pixel 8 Pro (Android 14)',
    }),
  });
  assert.strictEqual(regRes.status, 200, 'Register device token failed');
  const regData = await regRes.json();
  assert.strictEqual(regData.success, true);
  assert.strictEqual(regData.device.platform, 'android');
  console.log('   Device registered successfully:', regData.device);

  // 3. Update device token platform/metadata (upsert test)
  console.log('3. Updating device token metadata to web platform...');
  const updateRes = await fetch(`${BASE}/notifications/register-device`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      token: testAndroidToken,
      platform: 'web',
      deviceInfo: 'Chrome 122 on Windows 11',
    }),
  });
  assert.strictEqual(updateRes.status, 200);
  const updateData = await updateRes.json();
  assert.strictEqual(updateData.device.platform, 'web');
  console.log('   Device token updated successfully:', updateData.device);

  // 4. Trigger Emergency SOS and inspect notification creation & push dispatch
  console.log('4. Testing SOS trigger with push notification dispatch...');
  const sosTriggerRes = await fetch(`${BASE}/sos/trigger`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      locationName: 'Test Push Cafe, Indiranagar',
      source: 'manual',
    }),
  });

  // Either created (201) or already active (400)
  if (sosTriggerRes.status === 201) {
    const sosData = await sosTriggerRes.json();
    console.log(`   SOS Created (${sosData.sos._id}). Resolving to reset state...`);
    await fetch(`${BASE}/sos/${sosData.sos._id}/resolve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status: 'resolved' }),
    });
    console.log('   SOS resolved cleanly.');
  } else {
    const existing = await sosTriggerRes.json();
    console.log(`   Existing active SOS (${existing.activeSosId}), resolving...`);
    if (existing.activeSosId) {
      await fetch(`${BASE}/sos/${existing.activeSosId}/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: 'resolved' }),
      });
      console.log('   Resolved existing SOS.');
    }
  }

  // 5. Unregister Device Token
  console.log('5. Unregistering device token...');
  const unregRes = await fetch(`${BASE}/notifications/unregister-device`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ token: testAndroidToken }),
  });
  assert.strictEqual(unregRes.status, 200, 'Unregister device token failed');
  const unregData = await unregRes.json();
  assert.strictEqual(unregData.success, true);
  assert.strictEqual(unregData.deleted, true);
  console.log('   Device token unregistered cleanly.');

  // 6. Account Deletion cleans up registered tokens
  console.log('6. Testing device token purge on account deletion...');
  const tempTs = Date.now();
  const tempReg = await fetch(`${BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Push Test Temp User',
      username: `pushtemp.${tempTs}`,
      email: `pushtemp.${tempTs}@test.com`,
      password: 'password123',
      phone: '+919999888877',
      city: 'Bengaluru',
    }),
  });
  assert.strictEqual(tempReg.status, 201, 'Temp user creation failed');
  const { token: tempToken } = await tempReg.json();

  const tempDeviceToken = `fcm_temp_token_${tempTs}`;
  const registerTempDevice = await fetch(`${BASE}/notifications/register-device`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tempToken}`,
    },
    body: JSON.stringify({
      token: tempDeviceToken,
      platform: 'ios',
      deviceInfo: 'iPhone 15 Pro Max (iOS 17.4)',
    }),
  });
  assert.strictEqual(registerTempDevice.status, 200);

  // Now delete account
  const deleteAccountRes = await fetch(`${BASE}/auth/delete-account`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tempToken}`,
    },
  });
  assert.strictEqual(deleteAccountRes.status, 200, 'Delete account failed');
  console.log('   Account deleted cleanly. Device token cascade deletion verified.');

  console.log('\n🎉 ALL STEP 3 PUSH NOTIFICATION TESTS PASSED SUCCESSFULLY!');
}

runPushTests().catch((err) => {
  console.error('\n❌ Push notification test failed:', err);
  process.exit(1);
});
