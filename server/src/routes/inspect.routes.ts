import { Router, Response } from 'express';
import mongoose from 'mongoose';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth.js';
import { User } from '../models/User.js';
import { Location } from '../models/Location.js';
import { EmergencyContact } from '../models/EmergencyContact.js';
import { Connection } from '../models/Connection.js';
import { Chat } from '../models/Chat.js';
import { Message } from '../models/Message.js';
import { MeetingTimer } from '../models/MeetingTimer.js';
import { SosEvent } from '../models/SosEvent.js';
import { SafeZone } from '../models/SafeZone.js';
import { DailyStat } from '../models/DailyStat.js';

const router = Router();

// Strict Access Control: Admin credentials required to inspect database
router.use(authenticate);
router.use(requireAdmin);

router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [
      users,
      locations,
      emergencyContacts,
      connections,
      chats,
      messages,
      timers,
      sosEvents,
      safeZones,
      dailyStats,
    ] = await Promise.all([
      User.find().select('-password').lean(),
      Location.find().lean(),
      EmergencyContact.find().lean(),
      Connection.find().lean(),
      Chat.find().lean(),
      Message.find().lean(),
      MeetingTimer.find().lean(),
      SosEvent.find().lean(),
      SafeZone.find().lean(),
      DailyStat.find().lean(),
    ]);

    const data = {
      database: {
        status: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        name: mongoose.connection.name || 'casualmeet',
        host: mongoose.connection.host || 'localhost',
        collectionsCount: Object.keys(mongoose.connection.collections).length,
      },
      counts: {
        users: users.length,
        locations: locations.length,
        emergencyContacts: emergencyContacts.length,
        connections: connections.length,
        chats: chats.length,
        messages: messages.length,
        timers: timers.length,
        sosEvents: sosEvents.length,
        safeZones: safeZones.length,
        dailyStats: dailyStats.length,
      },
      collections: {
        users,
        locations,
        emergencyContacts,
        connections,
        chats,
        messages,
        timers,
        sosEvents,
        safeZones,
        dailyStats,
      },
    };

    // If client requested JSON or query param ?format=json
    if (req.query.format === 'json' || (req.headers.accept?.includes('application/json') && !req.headers.accept?.includes('text/html'))) {
      res.json(data);
      return;
    }

    // Otherwise render visual dark-mode HTML inspector
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CasualMeet MongoDB Inspector</title>
  <style>
    :root {
      --bg: #090d16;
      --card: #131a2a;
      --border: #1e293b;
      --text: #f1f5f9;
      --muted: #94a3b8;
      --accent: #38bdf8;
      --accent-glow: rgba(56, 189, 248, 0.15);
      --success: #10b981;
      --warn: #f59e0b;
      --danger: #ef4444;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.5;
      padding: 24px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
      margin-bottom: 24px;
      padding-bottom: 20px;
      border-bottom: 1px solid var(--border);
    }
    .title { font-size: 24px; font-weight: 700; color: #fff; display: flex; align-items: center; gap: 10px; }
    .badge-live {
      background: rgba(16, 185, 129, 0.2);
      color: var(--success);
      padding: 4px 10px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 600;
      border: 1px solid rgba(16, 185, 129, 0.4);
    }
    .actions { display: flex; gap: 10px; }
    .btn {
      background: var(--card);
      border: 1px solid var(--border);
      color: var(--text);
      padding: 8px 14px;
      border-radius: 8px;
      font-size: 13px;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn:hover { background: #1e293b; border-color: var(--accent); color: var(--accent); }
    .btn-primary { background: #0284c7; border-color: #0284c7; color: #fff; }
    .btn-primary:hover { background: #0369a1; }
    
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 14px;
      margin-bottom: 28px;
    }
    .stat-card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 16px;
      transition: transform 0.2s;
    }
    .stat-card:hover { transform: translateY(-2px); border-color: #334155; }
    .stat-title { font-size: 12px; color: var(--muted); text-transform: uppercase; font-weight: 600; }
    .stat-value { font-size: 28px; font-weight: 700; color: #fff; margin-top: 4px; }
    
    .section {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 20px;
      margin-bottom: 24px;
    }
    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }
    .section-title { font-size: 18px; font-weight: 600; display: flex; align-items: center; gap: 8px; }
    .count-pill {
      background: #1e293b;
      color: var(--accent);
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 12px;
    }
    
    .table-container { overflow-x: auto; }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
      text-align: left;
    }
    th {
      background: #0f172a;
      color: var(--muted);
      padding: 10px 14px;
      font-weight: 600;
      border-bottom: 1px solid var(--border);
    }
    td {
      padding: 10px 14px;
      border-bottom: 1px solid rgba(30, 41, 59, 0.7);
      vertical-align: top;
    }
    tr:hover td { background: rgba(30, 41, 59, 0.4); }
    
    .tag {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 600;
    }
    .tag-role { background: rgba(56, 189, 248, 0.15); color: #38bdf8; }
    .tag-admin { background: rgba(245, 158, 11, 0.15); color: #f59e0b; }
    .tag-verified { background: rgba(16, 185, 129, 0.15); color: #10b981; }
    .id-code {
      font-family: monospace;
      font-size: 11px;
      color: #94a3b8;
      background: #0f172a;
      padding: 2px 6px;
      border-radius: 4px;
    }
    pre {
      background: #090d16;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 12px;
      font-size: 12px;
      overflow-x: auto;
      color: #38bdf8;
      max-height: 250px;
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="title">
        🗄️ CasualMeet MongoDB Inspector
        <span class="badge-live">Live Database</span>
      </div>
      <p style="color: var(--muted); font-size: 13px; margin-top: 4px;">
        Database: <strong>${data.database.name}</strong> · Host: <strong>${data.database.host}</strong> · ${data.database.collectionsCount} active collections
      </p>
    </div>
    <div class="actions">
      <a href="http://localhost:3000/app" class="btn btn-primary" target="_blank">📱 Open User Portal</a>
      <a href="http://localhost:3000/admin" class="btn" target="_blank">🛡️ Admin Console</a>
      <a href="/api/inspect?format=json" class="btn" target="_blank">{ } Raw JSON</a>
      <button onclick="window.location.reload()" class="btn">🔄 Refresh</button>
    </div>
  </div>

  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-title">Registered Users</div>
      <div class="stat-value">${users.length}</div>
    </div>
    <div class="stat-card">
      <div class="stat-title">Locations (2dsphere)</div>
      <div class="stat-value">${locations.length}</div>
    </div>
    <div class="stat-card">
      <div class="stat-title">Emergency Contacts</div>
      <div class="stat-value">${emergencyContacts.length}</div>
    </div>
    <div class="stat-card">
      <div class="stat-title">Connections</div>
      <div class="stat-value">${connections.length}</div>
    </div>
    <div class="stat-card">
      <div class="stat-title">Chats & Messages</div>
      <div class="stat-value">${messages.length}</div>
    </div>
    <div class="stat-card">
      <div class="stat-title">Verified Safe Zones</div>
      <div class="stat-value">${safeZones.length}</div>
    </div>
  </div>

  <!-- Users Collection -->
  <div class="section">
    <div class="section-header">
      <div class="section-title">
        👤 Users Collection (<code>db.users</code>)
        <span class="count-pill">${users.length} documents</span>
      </div>
    </div>
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Name & Username</th>
            <th>Role</th>
            <th>Email</th>
            <th>Phone</th>
            <th>City</th>
            <th>Trust Score</th>
            <th>Verified</th>
          </tr>
        </thead>
        <tbody>
          ${users.map((u: any) => `
            <tr>
              <td><span class="id-code">${u._id}</span></td>
              <td><strong>${u.name}</strong> <span style="color:var(--muted)">(@${u.username})</span></td>
              <td><span class="tag ${u.role === 'super_admin' ? 'tag-admin' : 'tag-role'}">${u.role}</span></td>
              <td>${u.email}</td>
              <td>${u.phone}</td>
              <td>${u.city || 'Bengaluru'}</td>
              <td><strong style="color:var(--accent)">${u.trustScore || 100}</strong></td>
              <td>${u.isVerified ? '<span class="tag tag-verified">✓ Verified</span>' : '<span style="color:var(--muted)">Pending</span>'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  </div>

  <!-- Locations Collection -->
  <div class="section">
    <div class="section-header">
      <div class="section-title">
        📍 Geospatial Locations (<code>db.locations</code> · 2dsphere index)
        <span class="count-pill">${locations.length} documents</span>
      </div>
    </div>
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>User ID</th>
            <th>Type</th>
            <th>Coordinates [Longitude, Latitude]</th>
            <th>Last Updated</th>
          </tr>
        </thead>
        <tbody>
          ${locations.map((l: any) => `
            <tr>
              <td><span class="id-code">${l.userId}</span></td>
              <td>${l.location?.type || 'Point'}</td>
              <td><code style="color:#38bdf8">${JSON.stringify(l.location?.coordinates || [])}</code></td>
              <td>${new Date(l.updatedAt).toLocaleString()}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  </div>

  <!-- Emergency Contacts -->
  <div class="section">
    <div class="section-header">
      <div class="section-title">
        🆘 Emergency Contacts (<code>db.emergencycontacts</code>)
        <span class="count-pill">${emergencyContacts.length} documents</span>
      </div>
    </div>
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>User ID</th>
            <th>Contact Name</th>
            <th>Phone</th>
            <th>Relationship</th>
            <th>Notify On SOS</th>
          </tr>
        </thead>
        <tbody>
          ${emergencyContacts.length ? emergencyContacts.map((c: any) => `
            <tr>
              <td><span class="id-code">${c.userId}</span></td>
              <td><strong>${c.name}</strong></td>
              <td>${c.phone}</td>
              <td><span class="tag tag-role">${c.relationship}</span></td>
              <td>${c.notifyOnSos ? '✅ Enabled' : '❌ Disabled'}</td>
            </tr>
          `).join('') : '<tr><td colspan="5" style="color:var(--muted); text-align:center;">No emergency contacts recorded yet.</td></tr>'}
        </tbody>
      </table>
    </div>
  </div>

  <!-- Safe Zones -->
  <div class="section">
    <div class="section-header">
      <div class="section-title">
        🛡️ Verified Safe Zones (<code>db.safezones</code>)
        <span class="count-pill">${safeZones.length} locations</span>
      </div>
    </div>
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Category</th>
            <th>Address</th>
            <th>Coordinates [Lng, Lat]</th>
            <th>Verified Status</th>
          </tr>
        </thead>
        <tbody>
          ${safeZones.map((s: any) => `
            <tr>
              <td><strong>${s.name}</strong></td>
              <td><span class="tag tag-role">${s.category}</span></td>
              <td>${s.address}</td>
              <td><code style="color:#38bdf8">${JSON.stringify(s.location?.coordinates || [])}</code></td>
              <td><span class="tag tag-verified">✓ ${s.verificationLevel}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  </div>

</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to inspect database.' });
  }
});

export default router;
