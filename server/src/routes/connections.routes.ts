import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { Connection } from '../models/Connection.js';
import { Chat } from '../models/Chat.js';
import { User } from '../models/User.js';

const router = Router();

// List user's connections
router.get('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const conns = await Connection.find({
      $or: [{ requesterId: user._id }, { receiverId: user._id }],
    })
      .populate('requesterId', 'name username avatarHue isVerified')
      .populate('receiverId', 'name username avatarHue isVerified');

    res.json(conns);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch connections.' });
  }
});

// Request Connection
router.post('/request', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const { targetUserId } = req.body;

    if (!targetUserId || targetUserId === user._id.toString()) {
      res.status(400).json({ error: 'Cannot connect to self or invalid target user.' });
      return;
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      res.status(404).json({ error: 'Target user does not exist.' });
      return;
    }

    const existing = await Connection.findOne({
      $or: [
        { requesterId: user._id, receiverId: targetUserId },
        { requesterId: targetUserId, receiverId: user._id },
      ],
    });

    if (existing) {
      res.status(400).json({ error: `Connection record already exists (${existing.status}).` });
      return;
    }

    const conn = await Connection.create({
      requesterId: user._id,
      receiverId: targetUserId,
      status: 'pending',
    });

    res.status(201).json(conn);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to send connection request.' });
  }
});

// Accept Connection
router.put('/:id/accept', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const conn = await Connection.findById(req.params.id);

    if (!conn) {
      res.status(404).json({ error: 'Connection record not found.' });
      return;
    }

    if (conn.receiverId.toString() !== user._id.toString()) {
      res.status(403).json({ error: 'Only the receiving party may accept this connection.' });
      return;
    }

    conn.status = 'accepted';
    await conn.save();

    // Auto-create / ensure direct chat exists
    let chat = await Chat.findOne({
      type: 'direct',
      participants: { $all: [conn.requesterId, conn.receiverId] },
    });

    if (!chat) {
      chat = await Chat.create({
        type: 'direct',
        participants: [conn.requesterId, conn.receiverId],
        lastMessageAt: new Date(),
      });
    }

    res.json({ connection: conn, chatId: chat._id });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to accept connection.' });
  }
});

// Reject Connection
router.put('/:id/reject', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const conn = await Connection.findById(req.params.id);

    if (!conn) {
      res.status(404).json({ error: 'Connection record not found.' });
      return;
    }

    if (conn.receiverId.toString() !== user._id.toString()) {
      res.status(403).json({ error: 'Only the receiving party may reject this connection.' });
      return;
    }

    conn.status = 'rejected';
    await conn.save();
    res.json(conn);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to reject connection.' });
  }
});

export default router;
