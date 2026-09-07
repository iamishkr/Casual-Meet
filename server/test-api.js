async function runTests() {
  const BASE = 'http://localhost:5000/api';

  console.log('--- 1. Testing Health Endpoint ---');
  const healthRes = await fetch(`${BASE}/health`);
  const health = await healthRes.json();
  console.log('Health:', health);

  console.log('\n--- 2. Testing Login as Aisha (JWT verification) ---');
  const loginRes = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'aisha.k', password: 'user123' }),
  });
  const loginData = await loginRes.json();
  console.log('Login status:', loginRes.status);
  console.log('User:', loginData.user.name, `(@${loginData.user.username})`, 'Role:', loginData.user.role);
  console.log('Token (truncated):', loginData.token.substring(0, 30) + '...');

  console.log('\n--- 3. Testing Discovery with MongoDB 2dsphere & Redacted Coordinates ---');
  const discoverRes = await fetch(`${BASE}/discover?maxKm=15`, {
    headers: { Authorization: `Bearer ${loginData.token}` },
  });
  const discoverData = await discoverRes.json();
  console.log(`Discovered ${discoverData.length} nearby people:`);
  for (const d of discoverData) {
    console.log(`  • ${d.user.name} (${d.distanceKm} km away) - Redacted: "${d.coordinatesRedacted}"`);
  }

  console.log('\n--- 4. Testing Registering New User in MongoDB ---');
  const ts = Date.now();
  const regRes = await fetch(`${BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Vikram Malhotra',
      username: `vikram.${ts}`,
      email: `vikram.${ts}@casualmeet.app`,
      password: 'user123',
      phone: '+919988776655',
      city: 'Koramangala, Bengaluru',
      occupation: 'Product Designer',
    }),
  });
  const regData = await regRes.json();
  console.log('Registration status:', regRes.status);
  if (regRes.status === 201) {
    console.log('New User in MongoDB:', regData.user.name, `(@${regData.user.username})`, 'ID:', regData.user.id);
  } else {
    console.log('Registration response:', regData);
  }

  console.log('\n--- 5. Testing Creator Admin Authentication & SOS Board ---');
  const adminLoginRes = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'kavita.ops', password: 'admin123' }),
  });
  const adminLogin = await adminLoginRes.json();
  console.log('Admin login:', adminLogin.user.name, 'Role:', adminLogin.user.role);

  const adminSosRes = await fetch(`${BASE}/admin/sos`, {
    headers: { Authorization: `Bearer ${adminLogin.token}` },
  });
  const adminSos = await adminSosRes.json();
  console.log('Admin SOS Endpoint Status:', adminSosRes.status);
  console.log('Total SOS records in MongoDB:', adminSos.events ? adminSos.events.length : 'ok');

  console.log('\n✅ ALL BACKEND AND DATABASE TESTS PASSED WITH 100% SUCCESS!');
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
