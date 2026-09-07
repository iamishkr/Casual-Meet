import { Router, Response } from 'express';
import mongoose from 'mongoose';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { Chat } from '../models/Chat.js';
import { Message } from '../models/Message.js';
import { scanSensitive } from '../utils/scanner.js';
import { emitToChat, emitToUser } from '../socket.js';

const router = Router();

// List user's chats
router.get('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const chats = await Chat.find({ participants: user._id })
      .populate('participants', 'name username avatarHue isVerified')
      .sort({ lastMessageAt: -1 });

    res.json(chats);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch conversations.' });
  }
});

// Get messages in a chat
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

    const messages = await Message.find({ chatId: chat._id }).sort({ createdAt: 1 });
    res.json(messages);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch messages.' });
  }
});

// Send message with server-side sensitive PII redaction
router.post('/:id/messages', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const { content, type } = req.body;

    if (!content || !content.trim()) {
      res.status(400).json({ error: 'Message content cannot be empty.' });
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

    // Authoritative sensitive scan
    const hits = scanSensitive(content);
    const containsSensitive = hits.length > 0;
    const sensitiveKinds = hits.map((h) => h.kind);

    const message = await Message.create({
      chatId: chat._id,
      senderId: user._id,
      content: content.trim(),
      type: type || 'text',
      containsSensitive,
      sensitiveKinds,
      status: 'sent',
    });

    chat.lastMessageAt = new Date();
    await chat.save();

    // Real-time WebSocket emission (Post-persist)
    emitToChat(chat._id.toString(), 'new_message', {
      message,
      chatId: chat._id,
    });

    for (const p of chat.participants) {
      if (p.toString() !== user._id.toString()) {
        emitToUser(p.toString(), 'notification', {
          type: 'new_message',
          chatId: chat._id,
          sender: { id: user._id, name: user.name, username: user.username },
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

// Reveal sensitive message (Protected against IDOR)
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

    // IDOR Prevention: Verify that the authenticated user is a participant of the chat
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
