/**
 * CasualMeet Backend Database Inspector CLI
 * Run: node server/inspect-db.js
 */

async function inspect() {
  const loginUrl = 'http://localhost:5000/api/auth/login';
  const inspectUrl = 'http://localhost:5000/api/admin/inspect?format=json';

  try {
    // 1. Authenticate as Admin
    const loginRes = await fetch(loginUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'kavita.ops', password: 'admin123' }),
    });

    if (!loginRes.ok) {
      throw new Error(`Admin authentication failed: HTTP ${loginRes.status}`);
    }

    const loginData = await loginRes.json();
    const token = loginData.token;

    // 2. Fetch authenticated database inspection
    const res = await fetch(inspectUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      throw new Error(`Server returned HTTP ${res.status}`);
    }

    const data = await res.json();

    console.log('\n=============================================================');
    console.log('       🗄️  CASUALMEET MONGODB BACKEND DATA INSPECTOR        ');
    console.log('=============================================================');
    console.log(`Database Name: ${data.database.name}`);
    console.log(`Status:        ${data.database.status.toUpperCase()}`);
    console.log(`Host:          ${data.database.host}`);
    console.log(`Access:        Authenticated as Super Admin (@kavita.ops)`);
    console.log('-------------------------------------------------------------\n');

    console.log('📊 COLLECTION DOCUMENT COUNTS:');
    console.table(data.counts);

    console.log('\n👤 REGISTERED USERS (db.users):');
    const userSummary = data.collections.users.map((u) => ({
      ID: u._id,
      Name: u.name,
      Username: `@${u.username}`,
      Role: u.role,
      Email: u.email,
      Phone: u.phone,
      City: u.city || 'Bengaluru',
      TrustScore: u.trustScore,
      Verified: u.isVerified ? '✓' : 'Pending',
    }));
    console.table(userSummary);

    if (data.collections.emergencyContacts.length > 0) {
      console.log('\n🆘 EMERGENCY CONTACTS (db.emergencycontacts):');
      const contactSummary = data.collections.emergencyContacts.map((c) => ({
        UserId: c.userId,
        Name: c.name,
        Phone: c.phone,
        Relationship: c.relationship,
        NotifySOS: c.notifyOnSos ? 'YES' : 'NO',
      }));
      console.table(contactSummary);
    }

    if (data.collections.locations.length > 0) {
      console.log('\n📍 2DSPHERE GEOSPATIAL LOCATIONS (db.locations):');
      const locSummary = data.collections.locations.map((l) => ({
        UserId: l.userId,
        Coordinates: `[${l.location.coordinates.join(', ')}]`,
        Type: l.location.type,
        Updated: new Date(l.updatedAt).toLocaleTimeString(),
      }));
      console.table(locSummary);
    }

    if (data.collections.safeZones.length > 0) {
      console.log('\n🛡️ VERIFIED SAFE ZONES (db.safezones):');
      const safeSummary = data.collections.safeZones.map((s) => ({
        Name: s.name,
        Category: s.category,
        Address: s.address,
        Coordinates: `[${s.location.coordinates.join(', ')}]`,
      }));
      console.table(safeSummary);
    }

    console.log('\n=============================================================');
    console.log('✅ Visual Web Inspector: http://localhost:5000/api/inspect');
    console.log('📱 CasualMeet Web Portal: http://localhost:3000/app');
    console.log('🛡️ Creator Admin Console: http://localhost:3000/admin');
    console.log('=============================================================\n');
  } catch (err) {
    console.error('❌ Failed to inspect database:', err.message);
    console.error('Make sure the backend server is running on http://localhost:5000');
  }
}

inspect();
