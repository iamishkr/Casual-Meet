import { Router, Response } from 'express';
import mongoose from 'mongoose';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { Chat } from '../models/Chat.js';
import { Message } from '../models/Message.js';
import { User } from '../models/User.js';
import { scanSensitive } from '../utils/scanner.js';
import { emitToChat, emitToUser } from '../socket.js';
import { isBlocked, getBlockedUserIds, isConnected, isFollower } from '../utils/socialAuth.js';
import { sendNotification } from '../services/notificationService.js';
import { messageLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// ============================================================================
// 1. LIST CONVERSATIONS (Bounded pagination, PII-safe preview, group support)
// ============================================================================
router.get('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);
    const page = Math.max(Number(req.query.page) || 1, 1);

    const blockedUserIds = await getBlockedUserIds(user._id);

    const filter: any = { participants: user._id };
    if (blockedUserIds.length > 0) {
      filter.participants = { $all: [user._id], $nin: blockedUserIds };
    }

    const total = await Chat.countDocuments(filter);
    const chats = await Chat.find(filter)
      .populate('participants', 'name username avatarHue isVerified city allowMessages')
      .sort({ lastMessageAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const conversationDTOs = await Promise.all(
      chats.map(async (chat) => {
        // Fetch latest message in this chat
        const lastMsg = await Message.findOne({ chatId: chat._id }).sort({ createdAt: -1 });
        let safeLastMessage: any = null;

        if (lastMsg) {
          const isRevealed = lastMsg.revealedBy.some((id) => id.toString() === user._id.toString());
          const isSender = lastMsg.senderId.toString() === user._id.toString();

          // MANDATORY CORRECTION 1: Never expose unrevealed sensitive content in conversation list
          const shouldRedact = lastMsg.containsSensitive && !isRevealed && !isSender;

          safeLastMessage = {
            _id: lastMsg._id,
            chatId: lastMsg.chatId,
            senderId: lastMsg.senderId,
            content: shouldRedact ? 'Sensitive Content' : lastMsg.content,
            type: lastMsg.type,
            containsSensitive: lastMsg.containsSensitive,
            status: lastMsg.status,
            createdAt: lastMsg.createdAt,
            updatedAt: lastMsg.updatedAt,
          };
        }

        // Calculate unread count for current user
        const unreadCount = await Message.countDocuments({
          chatId: chat._id,
          senderId: { $ne: user._id },
          status: { $ne: 'read' },
        });

        // MANDATORY CORRECTION 4: Group Chat Compatibility
        if (chat.type === 'group') {
          const safeParticipants = (chat.participants as any[]).map((p) => ({
            _id: p._id,
            name: p.name,
            username: p.username,
            avatarHue: p.avatarHue,
            isVerified: p.isVerified,
          }));

          return {
            _id: chat._id,
            type: 'group',
            name: (chat as any).name || 'Group Chat',
            participants: safeParticipants,
            lastMessage: safeLastMessage,
            lastMessageAt: chat.lastMessageAt,
            unreadCount,
            createdAt: chat.createdAt,
            updatedAt: chat.updatedAt,
          };
        }

        // Direct chat: identify the other participant
        const other = (chat.participants as any[]).find(
          (p) => p._id.toString() !== user._id.toString()
        );

        let relationship: any = null;
        if (other) {
          const [connected, following, follower] = await Promise.all([
            isConnected(user._id, other._id),
            isFollower(user._id, other._id),
            isFollower(other._id, user._id),
          ]);

          relationship = {
            connectionStatus: connected ? 'accepted' : 'none',
            canMeet: connected, // Strictly accepted connection required for Meet Safely
            isFollowing: following,
            isFollower: follower,
          };
        }

        return {
          _id: chat._id,
          type: 'direct',
          participants: chat.participants,
          otherUser: other
            ? {
                _id: other._id,
                name: other.name,
                username: other.username,
                avatarHue: other.avatarHue,
                isVerified: other.isVerified,
                city: other.city,
              }
            : null,
          lastMessage: safeLastMessage,
          lastMessageAt: chat.lastMessageAt,
          unreadCount,
          relationship,
          createdAt: chat.createdAt,
          updatedAt: chat.updatedAt,
        };
      })
    );

    res.setHeader('X-Total-Count', total.toString());
    res.setHeader('X-Page', page.toString());
    res.setHeader('X-Limit', limit.toString());

    if (req.query.paginated === 'true') {
      res.json({
        chats: conversationDTOs,
        total,
        page,
        limit,
      });
      return;
    }

    res.json(conversationDTOs);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch conversations.' });
  }
});

// ============================================================================
// 2. GET MESSAGES IN CHAT (Retrieval Only — MANDATORY CORRECTION 2: DOES NOT MARK READ)
// ============================================================================
router.get('/:id/messages', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(404).json({ error: 'Chat not found or access denied.' });
      return;
    }

    const chat = await Chat.findOne({
      _id: req.params.id,
      participants: user._id,
    });

    if (!chat) {
      res.status(404).json({ error: 'Chat not found or access denied.' });
      return;
    }

    // Block enforcement: verify no active block with conversation partner
    const otherParticipant = chat.participants.find((p) => p.toString() !== user._id.toString());
    if (otherParticipant && (await isBlocked(user._id, otherParticipant))) {
      res.status(403).json({ error: 'Access denied. You have a blocked relationship with this user.' });
      return;
    }

    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
    const page = Math.max(Number(req.query.page) || 1, 1);

    // Strictly retrieval only — NO READ STATUS MUTATION
    const messages = await Message.find({ chatId: chat._id })
      .sort({ createdAt: 1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.json(messages);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch messages.' });
  }
});

// ============================================================================
// 3. SEND MESSAGE (Rate-limited, mass-assignment protected, allowMessages check)
// ============================================================================
router.post('/:id/messages', authenticate, messageLimiter, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const { content, type } = req.body;

    // Content length & presence checks
    if (!content || typeof content !== 'string' || !content.trim()) {
      res.status(400).json({ error: 'Message content cannot be empty.' });
      return;
    }

    if (content.length > 2000) {
      res.status(400).json({ error: 'Message content cannot exceed 2000 characters.' });
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(404).json({ error: 'Chat not found or access denied.' });
      return;
    }

    const chat = await Chat.findOne({
      _id: req.params.id,
      participants: user._id,
    });

    if (!chat) {
      res.status(404).json({ error: 'Chat not found or access denied.' });
      return;
    }

    // Direct API Blocking Enforcement
    const otherParticipant = chat.participants.find((p) => p.toString() !== user._id.toString());
    if (otherParticipant && (await isBlocked(user._id, otherParticipant))) {
      res.status(403).json({ error: 'Cannot send messages to a blocked user.' });
      return;
    }

    // MANDATORY CORRECTION 5: Inspect User allowMessages schema privacy contract
    if (otherParticipant) {
      const recipientUser = await User.findById(otherParticipant);
      if (recipientUser) {
        if (recipientUser.allowMessages === 'none') {
          res.status(403).json({ error: 'This user does not accept direct messages.' });
          return;
        }
        if (recipientUser.allowMessages === 'connections') {
          const connected = await isConnected(user._id, otherParticipant);
          if (!connected) {
            res.status(403).json({ error: 'You must be connected with this user to send direct messages.' });
            return;
          }
        }
      }
    }

    // Authoritative sensitive scan
    const hits = scanSensitive(content);
    const containsSensitive = hits.length > 0;
    const sensitiveKinds = hits.map((h) => h.kind);

    // MANDATORY CORRECTION 7: Mass Assignment Protection
    // Server derives senderId, status, revealedBy, timestamps
    const message = await Message.create({
      chatId: chat._id,
      senderId: user._id,
      content: content.trim(),
      type: type === 'image' || type === 'location' ? type : 'text',
      containsSensitive,
      sensitiveKinds,
      revealedBy: [],
      status: 'sent',
    });

    chat.lastMessageAt = new Date();
    await chat.save();

    // Real-time WebSocket emission (Post-persist)
    emitToChat(chat._id.toString(), 'new_message', {
      message,
      chatId: chat._id,
    });

    // Authoritative Notification via existing notification service (Mandatory Correction 10)
    for (const p of chat.participants) {
      if (p.toString() !== user._id.toString()) {
        await sendNotification({
          recipientId: p,
          actor: user,
          type: 'new_message',
          title: `New message from ${user.name}`,
          message: containsSensitive ? 'Sent you a sensitive message' : content.trim().substring(0, 80),
          targetType: 'chat',
          targetId: chat._id,
        });
      }
    }

    res.status(201).json({
      message,
      flagged: containsSensitive,
      sensitiveDetails: hits.map((h) => h.label),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to send message.' });
  }
});

// ============================================================================
// 4. EXPLICIT READ TRANSITION (MANDATORY CORRECTIONS 2 & 6: SERVER-AUTHORITATIVE)
// ============================================================================
router.put('/:id/read', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(404).json({ error: 'Chat not found or access denied.' });
      return;
    }

    const chat = await Chat.findOne({
      _id: req.params.id,
      participants: user._id,
    });

    if (!chat) {
      res.status(404).json({ error: 'Chat not found or access denied.' });
      return;
    }

    const otherParticipant = chat.participants.find((p) => p.toString() !== user._id.toString());
    if (otherParticipant && (await isBlocked(user._id, otherParticipant))) {
      res.status(403).json({ error: 'Access denied due to block.' });
      return;
    }

    // Mark unread incoming messages as read
    const updateResult = await Message.updateMany(
      {
        chatId: chat._id,
        senderId: { $ne: user._id },
        status: { $ne: 'read' },
      },
      { status: 'read' }
    );

    // Server-authoritative: derive readerId from authenticated user
    const readerId = user._id.toString();

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

    res.json({
      success: true,
      chatId: chat._id,
      readCount: updateResult.modifiedCount,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to mark chat as read.' });
  }
});

// ============================================================================
// 5. DIRECT CHAT LOOKUP / INITIALIZE
// ============================================================================
router.get('/with/:userId', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const targetUserId = req.params.userId;

    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    if (targetUserId === user._id.toString()) {
      res.status(400).json({ error: 'Cannot create a chat with yourself.' });
      return;
    }

    if (await isBlocked(user._id, targetUserId)) {
      res.status(403).json({ error: 'Cannot open chat with a blocked user.' });
      return;
    }

    // Look for existing direct chat
    let chat = await Chat.findOne({
      type: 'direct',
      participants: { $all: [user._id, targetUserId], $size: 2 },
    }).populate('participants', 'name username avatarHue isVerified city allowMessages');

    if (!chat) {
      const targetUser = await User.findById(targetUserId);
      if (!targetUser) {
        res.status(404).json({ error: 'User not found.' });
        return;
      }

      // Check recipient's message privacy contract
      if (targetUser.allowMessages === 'none') {
        res.status(403).json({ error: 'This user does not accept direct messages.' });
        return;
      }

      if (targetUser.allowMessages === 'connections') {
        const connected = await isConnected(user._id, targetUser._id);
        if (!connected) {
          res.status(403).json({ error: 'You must be connected with this user to start a conversation.' });
          return;
        }
      }

      chat = await Chat.create({
        type: 'direct',
        participants: [user._id, targetUser._id],
        lastMessageAt: new Date(),
      });

      await chat.populate('participants', 'name username avatarHue isVerified city allowMessages');
    }

    res.json(chat);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to get conversation.' });
  }
});

// ============================================================================
// 6. REVEAL SENSITIVE MESSAGE (Protected against IDOR)
// ============================================================================
router.put('/messages/:id/reveal', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(404).json({ error: 'Message not found.' });
      return;
    }

    const msg = await Message.findById(req.params.id);
    if (!msg) {
      res.status(404).json({ error: 'Message not found.' });
      return;
    }

    // IDOR Prevention: Verify authenticated user is a participant of the chat
    const chat = await Chat.findById(msg.chatId);
    if (!chat || !chat.participants.some((p) => p.toString() === user._id.toString())) {
      res.status(403).json({ error: 'Access denied. You are not a participant in this conversation.' });
      return;
    }

    if (!msg.revealedBy.some((id) => id.toString() === user._id.toString())) {
      msg.revealedBy.push(user._id);
      await msg.save();
    }

    res.json(msg);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to reveal message.' });
  }
});

export default router;

