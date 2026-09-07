async function runSecurityTests() {
  const BASE = 'http://localhost:5000/api';
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

  console.log('====================================================');
  console.log('🛡️ BACKEND SECURITY HARDENING VERIFICATION SUITE');
  console.log('====================================================\n');

  // Test 1: Security Headers
  console.log('--- TEST 1: Security Response Headers ---');
  const healthRes = await fetch(`${BASE}/health`);
  assert(healthRes.headers.get('x-content-type-options') === 'nosniff', 'X-Content-Type-Options: nosniff present');
  assert(healthRes.headers.get('x-frame-options') === 'SAMEORIGIN', 'X-Frame-Options: SAMEORIGIN present');
  assert(healthRes.headers.get('x-xss-protection') === '1; mode=block', 'X-XSS-Protection: 1; mode=block present');

  // Test 2: Missing Password in Login (Password Bypass Prevention)
  console.log('\n--- TEST 2: Password Bypass Prevention (Missing Password) ---');
  const bypassRes = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'aisha.k' }), // No password provided
  });
  const bypassData = await bypassRes.json();
  assert(bypassRes.status === 400, `Returns 400 Bad Request (got ${bypassRes.status})`);
  assert(bypassData.error === 'Password is required.', `Rejects empty password with clear error: "${bypassData.error}"`);

  // Test 3: Missing Identifier in Login
  console.log('\n--- TEST 3: Missing Identifier Validation ---');
  const noIdRes = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'user123' }),
  });
  const noIdData = await noIdRes.json();
  assert(noIdRes.status === 400, `Returns 400 Bad Request (got ${noIdRes.status})`);
  assert(noIdData.error === 'Username or email is required.', `Rejects missing identifier: "${noIdData.error}"`);

  // Test 4: Wrong Password Rejection
  console.log('\n--- TEST 4: Wrong Password Rejection ---');
  const wrongPassRes = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'aisha.k', password: 'DefinitelyWrongPassword999!' }),
  });
  const wrongPassData = await wrongPassRes.json();
  assert(wrongPassRes.status === 401, `Returns 401 Unauthorized (got ${wrongPassRes.status})`);
  assert(wrongPassData.error === 'Invalid username or password.', `Returns uniform error: "${wrongPassData.error}"`);

  // Test 5: Role Escalation Prevention on Registration
  console.log('\n--- TEST 5: Role Escalation Prevention on Registration ---');
  const ts = Date.now();
  const hackRoleRes = await fetch(`${BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Sneaky Attacker',
      username: `attacker.${ts}`,
      email: `attacker.${ts}@evil.com`,
      password: 'hackedPassword123',
      phone: '+919900990099',
      role: 'super_admin', // Attacker attempts to become admin
    }),
  });
  const hackRoleData = await hackRoleRes.json();
  assert(hackRoleRes.status === 201, `Registration created (status ${hackRoleRes.status})`);
  assert(hackRoleData.user.role === 'user', `Role is strictly locked to 'user' (got '${hackRoleData.user.role}')`);

  // Test 6: Target Role Guard on Login (Regular user cannot log into admin console)
  console.log('\n--- TEST 6: Target Role Enforcement on Login ---');
  const adminAttemptRes = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: 'aisha.k',
      password: 'user123',
      targetRole: 'super_admin', // Aisha is a regular user trying to access admin
    }),
  });
  const adminAttemptData = await adminAttemptRes.json();
  assert(adminAttemptRes.status === 403, `Returns 403 Forbidden (got ${adminAttemptRes.status})`);
  assert(adminAttemptData.error.includes('Administrator privileges required'), `Access denied error returned: "${adminAttemptData.error}"`);

  // Test 7: Valid Super Admin Login
  console.log('\n--- TEST 7: Valid Super Admin Login ---');
  const kavitaRes = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: 'kavita.ops',
      password: 'admin123',
      targetRole: 'super_admin',
    }),
  });
  const kavitaData = await kavitaRes.json();
  assert(kavitaRes.status === 200, `Admin login successful (status ${kavitaRes.status})`);
  assert(kavitaData.user.role === 'super_admin', `Role confirmed: ${kavitaData.user.role}`);

  // Test 8: Password Reset Flow (Forgot Password & Reset)
  console.log('\n--- TEST 8: Password Reset Flow (Forgot & Reset) ---');
  // 8a. Forgot password
  const forgotRes = await fetch(`${BASE}/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `attacker.${ts}@evil.com` }),
  });
  const forgotData = await forgotRes.json();
  assert(forgotRes.status === 200, `Forgot password initiated (status ${forgotRes.status})`);
  assert(Boolean(forgotData.resetToken), `Reset token received`);

  // 8b. Reset password with invalid token
  const badResetRes = await fetch(`${BASE}/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resetToken: 'fakeToken1234567890', newPassword: 'newSecretPass789' }),
  });
  assert(badResetRes.status === 400, `Invalid token rejected with 400 (got ${badResetRes.status})`);

  // 8c. Reset password with valid token
  const goodResetRes = await fetch(`${BASE}/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resetToken: forgotData.resetToken, newPassword: 'brandNewSecret2026' }),
  });
  assert(goodResetRes.status === 200, `Password successfully reset (status ${goodResetRes.status})`);

  // 8d. Login with old password fails
  const oldLoginRes = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: `attacker.${ts}`, password: 'hackedPassword123' }),
  });
  assert(oldLoginRes.status === 401, `Old password fails (status ${oldLoginRes.status})`);

  // 8e. Login with new password succeeds
  const newLoginRes = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: `attacker.${ts}`, password: 'brandNewSecret2026' }),
  });
  const newLoginData = await newLoginRes.json();
  assert(newLoginRes.status === 200, `New password works (status ${newLoginRes.status})`);

  // Test 9: Authenticated Password Change
  console.log('\n--- TEST 9: Authenticated Password Change ---');
  const changeRes = await fetch(`${BASE}/auth/change-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${newLoginData.token}`,
    },
    body: JSON.stringify({
      currentPassword: 'brandNewSecret2026',
      newPassword: 'anotherUpdatedPassword123',
    }),
  });
  assert(changeRes.status === 200, `Password changed while logged in (status ${changeRes.status})`);

  // Test 10: Rate Limiting / Brute-Force Lockout
  console.log('\n--- TEST 10: Brute Force Rate Limiting & Lockout ---');
  const bruteUser = `victim.${Date.now()}`;
  // 5 failed attempts
  for (let i = 1; i <= 5; i++) {
    await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: bruteUser, password: `wrong_${i}` }),
    });
  }
  // 6th attempt should be blocked with 429
  const blockedRes = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: bruteUser, password: 'attempt_6' }),
  });
  const blockedData = await blockedRes.json();
  assert(blockedRes.status === 429, `6th failed attempt returns 429 Too Many Requests (got ${blockedRes.status})`);
  assert(blockedData.error.includes('Too many failed login attempts'), `Lockout message returned: "${blockedData.error}"`);

  console.log('\n====================================================');
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runSecurityTests().catch((err) => {
  console.error('Test run failed:', err);
  process.exit(1);
});
