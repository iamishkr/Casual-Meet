import http from 'http';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

// Load environment variables
dotenv.config();

import { connectDB } from './db.js';
import { seedDatabase } from './seed.js';
import { setupSocketIO } from './socket.js';
import { validateJwtConfig } from './config/jwt.js';
import { initTimerWorker } from './workers/timerWorker.js';

// Route imports
import authRoutes from './routes/auth.routes.js';
import discoverRoutes from './routes/discover.routes.js';
import connectionsRoutes from './routes/connections.routes.js';
import chatsRoutes from './routes/chats.routes.js';
import timersRoutes from './routes/timers.routes.js';
import sosRoutes from './routes/sos.routes.js';
import adminRoutes from './routes/admin.routes.js';
import inspectRoutes from './routes/inspect.routes.js';
import contactsRoutes from './routes/contacts.routes.js';
import locationRoutes from './routes/location.routes.js';
import safeZonesRoutes from './routes/safezones.routes.js';
import reportsRoutes from './routes/reports.routes.js';
import verificationRoutes from './routes/verification.routes.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Environment-based CORS Configuration
const isProd = process.env.NODE_ENV === 'production';
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://192.168.1.6:3000',
      'capacitor://localhost',
      'http://localhost',
    ];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, native webview)
      if (!origin) return callback(null, true);
      if (!isProd || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS Policy: Origin ${origin} not allowed.`));
    },
    credentials: true,
  })
);

app.use(express.json());

// Security Headers Middleware
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Root & API welcome endpoints
app.get(['/', '/api'], (_req, res) => {
  res.json({
    status: 'ok',
    message: 'CasualMeet Backend REST API & MongoDB are live!',
    frontendApp: 'http://localhost:3000',
    adminConsole: 'http://localhost:3000/admin',
    portals: {
      home: 'http://localhost:3000/',
      userPortal: 'http://localhost:3000/app',
      adminConsole: 'http://localhost:3000/admin',
      login: 'http://localhost:3000/login',
    },
    endpoints: {
      health: '/api/health',
      auth: '/api/auth/login',
      discover: '/api/discover',
      connections: '/api/connections',
      chats: '/api/chats',
      timers: '/api/timers',
      sos: '/api/sos',
      contacts: '/api/contacts',
      location: '/api/location',
      safeZones: '/api/safe-zones',
      reports: '/api/reports',
      verification: '/api/verification',
      admin: '/api/admin/metrics',
      databaseInspector: '/api/admin/inspect (Requires Admin Bearer Token)',
    },
  });
});

// Health Check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'CasualMeet Backend API',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'connecting',
    serverTime: new Date().toISOString(),
  });
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/discover', discoverRoutes);
app.use('/api/connections', connectionsRoutes);
app.use('/api/chats', chatsRoutes);
app.use('/api/timers', timersRoutes);
app.use('/api/sos', sosRoutes);
app.use('/api/contacts', contactsRoutes);
app.use('/api/location', locationRoutes);
app.use('/api/safe-zones', safeZonesRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/verification', verificationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin/inspect', inspectRoutes);
app.use('/api/inspect', inspectRoutes);

// Global Error Handler to avoid leaking internal error stacks
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled API Error:', err);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error.' : (err.message || 'Internal server error.'),
  });
});

// HTTP & Socket Server
const httpServer = http.createServer(app);
export const io = setupSocketIO(httpServer);

// Start Server
async function startServer() {
  try {
    // Validate JWT configuration before bootstrapping
    validateJwtConfig();

    await connectDB();
    await seedDatabase();

    // Start Authoritative Server-Side Safety Timer Worker
    initTimerWorker(5000);

    httpServer.listen(PORT, () => {
      console.log(`====================================================`);
      console.log(`🚀 CasualMeet Backend Server running on http://localhost:${PORT}`);
      console.log(`🛡️ REST Endpoints: http://localhost:${PORT}/api/*`);
      console.log(`📡 WebSocket Gateway: ws://localhost:${PORT}`);
      console.log(`====================================================`);
    });
  } catch (err) {
    console.error('Fatal error starting server:', err);
    process.exit(1);
  }
}

startServer();
