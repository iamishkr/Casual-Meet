import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { User } from './models/User.js';

const JWT_SECRET = process.env.JWT_SECRET || 'casualmeet_super_secret_production_key_2026_xyz';

export function setupSocketIO(httpServer: HttpServer) {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
    },
  });

  io.use(async (socket: Socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
    if (!token) {
      return next(new Error('Authentication token required'));
    }

    try {
      const payload = jwt.verify(token, JWT_SECRET) as { userId: string };
      const user = await User.findById(payload.userId);
      if (!user) return next(new Error('User not found'));

      (socket as any).user = user;
      next();
    } catch {
      next(new Error('Invalid authentication token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = (socket as any).user;
    console.log(`[Socket.io] User connected: @${user.username} (${user.role}) - socket id: ${socket.id}`);

    // Join personal user room
    socket.join(`user:${user._id}`);

    // If admin or moderator, join admins room for real-time safety alerts
    if (user.role === 'super_admin' || user.role === 'moderator') {
      socket.join('room:admins');
      console.log(`[Socket.io] Admin joined room:admins: @${user.username}`);
    }

    // Typing indicators
    socket.on('typing.start', ({ chatId, targetUserId }) => {
      io.to(`user:${targetUserId}`).emit('typing', { chatId, userId: user._id, typing: true });
    });

    socket.on('typing.stop', ({ chatId, targetUserId }) => {
      io.to(`user:${targetUserId}`).emit('typing', { chatId, userId: user._id, typing: false });
    });

    socket.on('disconnect', () => {
      console.log(`[Socket.io] User disconnected: @${user.username}`);
    });
  });

  return io;
}
