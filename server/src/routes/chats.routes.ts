import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { Chat } from '../models/Chat.js';
import { Message } from '../models/Message.js';
import { scanSensitive } from '../utils/scanner.js';

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

    res.status(201).json({
      message,
      flagged: containsSensitive,
      sensitiveDetails: hits.map((h) => h.label),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to send message.' });
  }
});

// Reveal sensitive message
router.put('/messages/:id/reveal', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const msg = await Message.findById(req.params.id);

    if (!msg) {
      res.status(404).json({ error: 'Message not found.' });
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
