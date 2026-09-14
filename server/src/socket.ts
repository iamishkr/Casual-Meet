import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { User } from './models/User.js';
import { Chat } from './models/Chat.js';
import { Message } from './models/Message.js';
import { Community } from './models/Community.js';
import { CommunityMember } from './models/CommunityMember.js';
import { isBlocked } from './utils/socialAuth.js';
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

export function emitToCommunity(communityId: string, event: string, data: any): void {
  if (ioInstance) {
    ioInstance.to(`community:${communityId}`).emit(event, data);
  }
}

export function setupSocketIO(httpServer: HttpServer): SocketIOServer {
  const isProd = process.env.NODE_ENV === 'production';
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
    : ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://192.168.1.6:3000', 'capacitor://localhost', 'http://localhost', 'https://localhost'];

  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (
          !isProd ||
          allowedOrigins.includes('*') ||
          allowedOrigins.includes(origin) ||
          origin.endsWith('.vercel.app') ||
          origin.endsWith('.onrender.com') ||
          origin === 'capacitor://localhost' ||
          origin === 'https://localhost' ||
          origin === 'http://localhost'
        ) {
          return callback(null, true);
        }
        return callback(new Error(`Socket CORS error: Origin ${origin} not allowed`));
      },
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

    // Join specific chat room - AUTHORITATIVE MEMBERSHIP & BLOCK VERIFICATION
    socket.on('chat.join', async (chatId: string, callback?: (res: any) => void) => {
      if (!chatId || !mongoose.Types.ObjectId.isValid(chatId)) {
        if (typeof callback === 'function') callback({ error: 'Invalid chat ID' });
        return;
      }
      try {
        const chat = await Chat.findOne({
          _id: chatId,
          participants: user._id,
        });
        if (!chat) {
          if (typeof callback === 'function') callback({ error: 'Chat not found or access denied' });
          return;
        }

        const otherParticipant = chat.participants.find((p) => p.toString() !== userIdStr);
        if (otherParticipant && (await isBlocked(user._id, otherParticipant))) {
          if (typeof callback === 'function') callback({ error: 'Access denied due to block' });
          return;
        }

        socket.join(`chat:${chatId}`);
        if (typeof callback === 'function') callback({ success: true, chatId });
      } catch {
        if (typeof callback === 'function') callback({ error: 'Failed to join chat room' });
      }
    });

    socket.on('chat.leave', (chatId: string) => {
      if (chatId) socket.leave(`chat:${chatId}`);
    });

    // Authoritative typing indicators (verified chat membership and block check)
    socket.on('typing.start', async (data: { chatId: string }) => {
      const { chatId } = data || {};
      if (!chatId || !mongoose.Types.ObjectId.isValid(chatId)) return;
      try {
        const chat = await Chat.findOne({ _id: chatId, participants: user._id });
        if (!chat) return;
        const otherParticipant = chat.participants.find((p) => p.toString() !== userIdStr);
        if (otherParticipant && (await isBlocked(user._id, otherParticipant))) return;

        socket.to(`chat:${chatId}`).emit('typing', { chatId, userId: userIdStr, typing: true });
        if (otherParticipant) {
          emitToUser(otherParticipant.toString(), 'typing', { chatId, userId: userIdStr, typing: true });
        }
      } catch {
        // ignore
      }
    });

    socket.on('typing.stop', async (data: { chatId: string }) => {
      const { chatId } = data || {};
      if (!chatId || !mongoose.Types.ObjectId.isValid(chatId)) return;
      try {
        const chat = await Chat.findOne({ _id: chatId, participants: user._id });
        if (!chat) return;
        const otherParticipant = chat.participants.find((p) => p.toString() !== userIdStr);
        if (otherParticipant && (await isBlocked(user._id, otherParticipant))) return;

        socket.to(`chat:${chatId}`).emit('typing', { chatId, userId: userIdStr, typing: false });
        if (otherParticipant) {
          emitToUser(otherParticipant.toString(), 'typing', { chatId, userId: userIdStr, typing: false });
        }
      } catch {
        // ignore
      }
    });

    // Authoritative Socket Read Event:
    socket.on('chat.read', async (data: { chatId: string }, callback?: (res: any) => void) => {
      const { chatId } = data || {};
      if (!chatId || !mongoose.Types.ObjectId.isValid(chatId)) {
        if (typeof callback === 'function') callback({ error: 'Invalid chat ID' });
        return;
      }
      try {
        const chat = await Chat.findOne({ _id: chatId, participants: user._id });
        if (!chat) {
          if (typeof callback === 'function') callback({ error: 'Chat not found or access denied' });
          return;
        }
        const otherParticipant = chat.participants.find((p) => p.toString() !== userIdStr);
        if (otherParticipant && (await isBlocked(user._id, otherParticipant))) {
          if (typeof callback === 'function') callback({ error: 'Access denied due to block' });
          return;
        }

        // Server-authoritative: derive readerId from socket.user._id, never from client
        const readerId = userIdStr;
        await Message.updateMany(
          {
            chatId: chat._id,
            senderId: { $ne: user._id },
            status: { $ne: 'read' },
          },
          { status: 'read' }
        );

        emitToChat(chat._id.toString(), 'chat.read', {
          chatId: chat._id.toString(),
          readerId,
        });
        if (otherParticipant) {
          emitToUser(otherParticipant.toString(), 'chat.read', {
            chatId: chat._id.toString(),
            readerId,
          });
        }
        if (typeof callback === 'function') callback({ success: true, chatId });
      } catch {
        if (typeof callback === 'function') callback({ error: 'Failed to update read state' });
      }
    });

    // Join community room - AUTHORITATIVE PRIVACY & MEMBERSHIP VERIFICATION
    socket.on('community.join', async (communityId: string, callback?: (res: any) => void) => {
      if (!communityId || !mongoose.Types.ObjectId.isValid(communityId)) {
        if (typeof callback === 'function') callback({ error: 'Invalid community ID' });
        return;
      }
      try {
        const community = await Community.findById(communityId);
        if (!community || community.status === 'suspended') {
          if (typeof callback === 'function') callback({ error: 'Community not found or suspended' });
          return;
        }

        if (community.privacy === 'private') {
          const membership = await CommunityMember.findOne({
            communityId: community._id,
            userId: user._id,
            status: 'active',
          });
          const isAdmin = user.role === 'super_admin' || user.role === 'moderator';
          if (!membership && !isAdmin) {
            if (typeof callback === 'function') callback({ error: 'Access denied to private community' });
            return;
          }
        }

        socket.join(`community:${communityId}`);
        if (typeof callback === 'function') callback({ success: true, communityId });
      } catch {
        if (typeof callback === 'function') callback({ error: 'Failed to join community room' });
      }
    });

    socket.on('community.leave', (communityId: string) => {
      if (communityId) socket.leave(`community:${communityId}`);
    });

    socket.on('disconnect', () => {
      // Clean disconnect
    });
  });

  ioInstance = io;
  return io;
}

