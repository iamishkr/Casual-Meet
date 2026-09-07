import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { User } from './models/User.js';
import { getJwtSecret } from './config/jwt.js';

let ioInstance: SocketIOServer | null = null;

export function getIO(): SocketIOServer | null {
  return ioInstance;
}

export function emitToUser(userId: string, event: string, data: any): void {
  if (ioInstance) {
    ioInstance.to(`user:${userId}`).emit(event, data);
  }
}

export function emitToAdmins(event: string, data: any): void {
  if (ioInstance) {
    ioInstance.to('room:admins').emit(event, data);
  }
}

export function emitToChat(chatId: string, event: string, data: any): void {
  if (ioInstance) {
    ioInstance.to(`chat:${chatId}`).emit(event, data);
  }
}

export function setupSocketIO(httpServer: HttpServer): SocketIOServer {
  const isProd = process.env.NODE_ENV === 'production';
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
    : ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://192.168.1.6:3000', 'capacitor://localhost', 'http://localhost'];

  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: isProd ? allowedOrigins : '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      credentials: true,
    },
  });

  io.use(async (socket: Socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
    if (!token) {
      return next(new Error('Authentication token required'));
    }

    try {
      const payload = jwt.verify(token, getJwtSecret()) as { userId: string };
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
    const userIdStr = user._id.toString();

    // Join personal user notification room
    socket.join(`user:${userIdStr}`);

    // If admin or moderator, join admins room for real-time safety alerts
    if (user.role === 'super_admin' || user.role === 'moderator') {
      socket.join('room:admins');
    }

    // Join specific chat room
    socket.on('chat.join', (chatId: string) => {
      if (chatId) socket.join(`chat:${chatId}`);
    });

    socket.on('chat.leave', (chatId: string) => {
      if (chatId) socket.leave(`chat:${chatId}`);
    });

    // Typing indicators
    socket.on('typing.start', ({ chatId, targetUserId }) => {
      io.to(`user:${targetUserId}`).emit('typing', { chatId, userId: userIdStr, typing: true });
    });

    socket.on('typing.stop', ({ chatId, targetUserId }) => {
      io.to(`user:${targetUserId}`).emit('typing', { chatId, userId: userIdStr, typing: false });
    });

    socket.on('disconnect', () => {
      // Clean disconnect
    });
  });

  ioInstance = io;
  return io;
}

