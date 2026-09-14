import { Router, Response } from 'express';
import mongoose from 'mongoose';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { Notification } from '../models/Notification.js';
import { SAFE_USER_FIELDS } from '../utils/socialAuth.js';

const router = Router();

router.use(authenticate);

/**
 * GET /api/notifications
 * Fetch user's persistent notifications with unread count.
 */
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);
    const page = Math.max(Number(req.query.page) || 1, 1);

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find({ recipientId: user._id })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('actorId', SAFE_USER_FIELDS),
      Notification.countDocuments({ recipientId: user._id }),
      Notification.countDocuments({ recipientId: user._id, isRead: false }),
    ]);

    res.json({
      notifications: notifications.map((n) => ({
        id: n._id,
        type: n.type,
        actor: n.actorId,
        targetType: n.targetType,
        targetId: n.targetId,
        title: n.title,
        message: n.message,
        isRead: n.isRead,
        createdAt: n.createdAt,
      })),
      unreadCount,
      total,
      page,
      limit,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch notifications.' });
  }
});

/**
 * PUT /api/notifications/:id/read
 * Mark a single notification as read.
 */
router.put('/:id/read', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid notification ID format.' });
      return;
    }

    const notif = await Notification.findOne({ _id: id, recipientId: user._id });
    if (!notif) {
      res.status(404).json({ error: 'Notification not found.' });
      return;
    }

    notif.isRead = true;
    await notif.save();

    res.json({ success: true, message: 'Notification marked as read.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update notification.' });
  }
});

/**
 * PUT /api/notifications/read-all
 * Mark all user notifications as read.
 */
router.put('/read-all', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const result = await Notification.updateMany(
      { recipientId: user._id, isRead: false },
      { $set: { isRead: true } }
    );

    res.json({ success: true, updatedCount: result.modifiedCount });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to mark all as read.' });
  }
});

export default router;
