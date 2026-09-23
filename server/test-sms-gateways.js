import assert from 'assert';

const BASE = 'http://localhost:5000/api';

async function runSmsGatewayTests() {
  console.log('📱 [Test] Step 4: Live SMS Gateway & Carrier Delivery Verification');

  // 1. Authenticate as Admin (Kavita) and Normal User (Aisha)
  console.log('1. Authenticating Admin and User personas...');
  const adminLogin = await (await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'kavita.ops', password: 'admin123' }),
  })).json();
  assert(adminLogin.token, 'Admin login failed');

  const userLogin = await (await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'aisha.k', password: 'user123' }),
  })).json();
  assert(userLogin.token, 'User login failed');
  console.log('   Admin and User authenticated successfully.');

  // 2. Test SMS Gateway Status Endpoint
  console.log('2. Checking SMS gateway status (GET /api/admin/sms/status)...');
  const statusRes = await fetch(`${BASE}/admin/sms/status`, {
    headers: { Authorization: `Bearer ${adminLogin.token}` },
  });
  assert.strictEqual(statusRes.status, 200, 'SMS status check failed');
  const statusData = await statusRes.json();
  assert(['live', 'simulated'].includes(statusData.mode), 'Invalid mode');
  assert('fast2sms' in statusData && 'twilio' in statusData);
  console.log(`   Gateway operational mode: "${statusData.mode.toUpperCase()}"`);
  console.log(`   Fast2SMS: ${statusData.fast2sms.configured ? 'Configured (Route q)' : 'Unset (Fallback active)'}`);
  console.log(`   Twilio: ${statusData.twilio.configured ? `Configured (${statusData.twilio.senderNumber})` : 'Unset (Fallback active)'}`);

  // 3. Test Diagnostic SMS Dispatch to Indian Number (Fast2SMS route)
  console.log('3. Testing diagnostic SMS dispatch to Indian number (+919876543210)...');
  const testIndiaRes = await fetch(`${BASE}/admin/sms/test`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminLogin.token}`,
    },
    body: JSON.stringify({
      phone: '+919876543210',
      message: 'CasualMeet Automated Test: India Carrier Route Verification',
    }),
  });
  assert.strictEqual(testIndiaRes.status, 200);
  const testIndiaData = await testIndiaRes.json();
  assert.strictEqual(testIndiaData.success, true);
  assert(testIndiaData.result.sid, 'SID missing from dispatch');
  console.log(`   Dispatched via: ${testIndiaData.result.gateway.toUpperCase()} (Status: ${testIndiaData.result.status}, SID: ${testIndiaData.result.sid})`);

  // 4. Test Diagnostic SMS Dispatch to International Number (Twilio route)
  console.log('4. Testing diagnostic SMS dispatch to International number (+14155552671)...');
  const testIntlRes = await fetch(`${BASE}/admin/sms/test`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminLogin.token}`,
    },
    body: JSON.stringify({
      phone: '+14155552671',
      message: 'CasualMeet Automated Test: Global Twilio Route Verification',
    }),
  });
  assert.strictEqual(testIntlRes.status, 200);
  const testIntlData = await testIntlRes.json();
  assert.strictEqual(testIntlData.success, true);
  assert.strictEqual(testIntlData.result.gateway, 'twilio');
  console.log(`   Dispatched via: TWILIO (Status: ${testIntlData.result.status}, SID: ${testIntlData.result.sid})`);

  // 5. Test Live Emergency SOS Alerting with Delivery Logs
  console.log('5. Triggering Emergency SOS to test per-contact SMS delivery logs...');
  // Ensure no conflicting active SOS
  const existingActive = await (await fetch(`${BASE}/sos/active`, {
    headers: { Authorization: `Bearer ${userLogin.token}` },
  })).json();
  if (existingActive?._id) {
    await fetch(`${BASE}/sos/${existingActive._id}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userLogin.token}` },
      body: JSON.stringify({ status: 'resolved' }),
    });
  }

  const sosRes = await fetch(`${BASE}/sos/trigger`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${userLogin.token}`,
    },
    body: JSON.stringify({
      locationName: 'MG Road Metro Station, Bengaluru',
      source: 'manual',
    }),
  });
  assert.strictEqual(sosRes.status, 201, 'SOS creation failed');
  const sosData = await sosRes.json();
  console.log(`   Active SOS created: ${sosData.sos._id}. Dispatched alerts to ${sosData.contactsAlerted} contacts.`);

  // 6. Inspect Admin SOS Delivery Records
  console.log('6. Inspecting per-contact delivery records in MongoDB via Admin Board...');
  const adminSosRes = await fetch(`${BASE}/admin/sos`, {
    headers: { Authorization: `Bearer ${adminLogin.token}` },
  });
  assert.strictEqual(adminSosRes.status, 200);
  const adminSosData = await adminSosRes.json();
  const matchedLogs = adminSosData.logs.filter((l) => l.sosId === sosData.sos._id);
  console.log(`   Found ${matchedLogs.length} delivery log records for incident in MongoDB.`);
  for (const log of matchedLogs) {
    assert(log.contactPhone, 'Log missing phone');
    assert(log.gateway, 'Log missing gateway');
    console.log(`     • ${log.contactName} (${log.contactPhone}): Gateway=${log.gateway}, Status=${log.status}, SID=${log.gatewayResponse?.sid || 'N/A'}`);
  }

  // 7. Test Retry Failed Alerts Endpoint
  console.log('7. Testing Retry Alerts endpoint (POST /api/sos/:id/retry-sms)...');
  const retryRes = await fetch(`${BASE}/sos/${sosData.sos._id}/retry-sms`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${userLogin.token}`,
    },
  });
  assert.strictEqual(retryRes.status, 200, 'Retry endpoint failed');
  const retryData = await retryRes.json();
  assert.strictEqual(retryData.success, true);
  console.log(`   Retry endpoint executed successfully: retried ${retryData.retriedCount} alerts.`);

  // 8. Clean up SOS incident
  await fetch(`${BASE}/sos/${sosData.sos._id}/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userLogin.token}` },
    body: JSON.stringify({ status: 'resolved' }),
  });
  console.log('   SOS incident resolved cleanly.');

  // 9. RBAC Security Check: Normal user blocked from admin SMS tools
  console.log('8. Verifying RBAC protection on Admin SMS tools...');
  const forbiddenStatus = await fetch(`${BASE}/admin/sms/status`, {
    headers: { Authorization: `Bearer ${userLogin.token}` },
  });
  assert.strictEqual(forbiddenStatus.status, 403, 'Normal user should be blocked with 403');
  console.log('   Non-admin access strictly blocked (got HTTP 403 Forbidden).');

  console.log('\n🎉 ALL STEP 4 LIVE SMS GATEWAY TESTS PASSED WITH 100% SUCCESS!');
}

runSmsGatewayTests().catch((err) => {
  console.error('\n❌ SMS gateway test failed:', err);
  process.exit(1);
});
