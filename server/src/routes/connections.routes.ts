import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { connectionRequestLimiter } from '../middleware/rateLimiter.js';
import { Connection } from '../models/Connection.js';
import { Chat } from '../models/Chat.js';
import { User } from '../models/User.js';
import { Follow } from '../models/Follow.js';
import { sendNotification } from '../services/notificationService.js';

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
router.post('/request', authenticate, connectionRequestLimiter, async (req: AuthRequest, res: Response): Promise<void> => {
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

    // Send connection request notification
    await sendNotification({
      recipientId: targetUser._id,
      actor: user,
      type: 'connection_requested',
      title: 'New Connection Request',
      message: `${user.name} sent you a connection request.`,
      targetType: 'user',
      targetId: user._id,
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

    // Send connection accepted notification
    await sendNotification({
      recipientId: conn.requesterId,
      actor: user,
      type: 'connection_accepted',
      title: 'Connection Accepted',
      message: `${user.name} accepted your connection request. Direct messaging is now unlocked.`,
      targetType: 'user',
      targetId: user._id,
    });

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

// Block User
router.post('/block', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const { targetUserId } = req.body;

    if (!targetUserId || targetUserId === user._id.toString()) {
      res.status(400).json({ error: 'Cannot block self or invalid target user.' });
      return;
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      res.status(404).json({ error: 'Target user does not exist.' });
      return;
    }

    // 1. Sever all mutual follow relationships
    await Follow.deleteMany({
      $or: [
        { followerId: user._id, followingId: targetUserId },
        { followerId: targetUserId, followingId: user._id },
      ],
    });

    // 2. Set authoritative connection status to 'blocked'
    const conn = await Connection.findOneAndUpdate(
      {
        $or: [
          { requesterId: user._id, receiverId: targetUserId },
          { requesterId: targetUserId, receiverId: user._id },
        ],
      },
      {
        $set: {
          requesterId: user._id,
          receiverId: targetUserId,
          status: 'blocked',
        },
      },
      { upsert: true, new: true }
    );

    res.json({ success: true, connection: conn });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to block user.' });
  }
});

// Unblock User (Removes ONLY the block state; returns relationship to clean 'none' state)
router.post('/unblock', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const { targetUserId } = req.body;

    if (!targetUserId || targetUserId === user._id.toString()) {
      res.status(400).json({ error: 'Cannot unblock self or invalid target user.' });
      return;
    }

    // Directive #3: Remove ONLY the block record. Never automatically restore social relationships.
    const deleted = await Connection.deleteMany({
      $or: [
        { requesterId: user._id, receiverId: targetUserId, status: 'blocked' },
        { requesterId: targetUserId, receiverId: user._id, status: 'blocked' },
      ],
    });

    res.json({ success: true, message: 'User unblocked successfully.', removedBlocks: deleted.deletedCount });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to unblock user.' });
  }
});

// Remove / Disconnect
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const conn = await Connection.findOne({
      _id: req.params.id,
      $or: [{ requesterId: user._id }, { receiverId: user._id }],
    });

    if (!conn) {
      res.status(404).json({ error: 'Connection not found or not authorized.' });
      return;
    }

    await conn.deleteOne();
    res.json({ success: true, message: 'Connection removed successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to remove connection.' });
  }
});

// Remove / Disconnect by target user ID
router.delete('/user/:targetUserId', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const { targetUserId } = req.params;

    const result = await Connection.deleteMany({
      $or: [
        { requesterId: user._id, receiverId: targetUserId, status: { $ne: 'blocked' } },
        { requesterId: targetUserId, receiverId: user._id, status: { $ne: 'blocked' } },
      ],
    });

    if (result.deletedCount === 0) {
      res.status(404).json({ error: 'Active or pending connection not found.' });
      return;
    }

    res.json({ success: true, message: 'Connection removed successfully.', removedCount: result.deletedCount });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to remove connection.' });
  }
});

export default router;
