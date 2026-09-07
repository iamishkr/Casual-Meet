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

// Route imports
import authRoutes from './routes/auth.routes.js';
import discoverRoutes from './routes/discover.routes.js';
import connectionsRoutes from './routes/connections.routes.js';
import chatsRoutes from './routes/chats.routes.js';
import timersRoutes from './routes/timers.routes.js';
import sosRoutes from './routes/sos.routes.js';
import adminRoutes from './routes/admin.routes.js';
import inspectRoutes from './routes/inspect.routes.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({ origin: '*' }));
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
      databaseInspector: '/api/admin/inspect (Requires Admin Bearer Token)',
      health: '/api/health',
      auth: '/api/auth/login',
      discover: '/api/discover',
      connections: '/api/connections',
      chats: '/api/chats',
      timers: '/api/timers',
      sos: '/api/sos',
      admin: '/api/admin/metrics',
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
    await connectDB();
    await seedDatabase();

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
