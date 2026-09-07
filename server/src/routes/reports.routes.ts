import { Router, Response } from 'express';
import mongoose from 'mongoose';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { UserReport } from '../models/UserReport.js';
import { User } from '../models/User.js';
import { emitToAdmins } from '../socket.js';

const router = Router();

router.use(authenticate);

const VALID_CATEGORIES = [
  'harassment',
  'spam',
  'scam',
  'threat',
  'fake_identity',
  'safety_concern',
  'inappropriate_content',
  'other',
];

// POST /api/reports — File a new safety/harassment report against another user
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const { reportedUserId, category, reason, details } = req.body;

    if (!reportedUserId || !mongoose.Types.ObjectId.isValid(reportedUserId)) {
      res.status(400).json({ error: 'Valid reported user ID is required.' });
      return;
    }

    if (reportedUserId.toString() === user._id.toString()) {
      res.status(400).json({ error: 'You cannot submit a report against your own account.' });
      return;
    }

    const targetUser = await User.findById(reportedUserId);
    if (!targetUser) {
      res.status(404).json({ error: 'The specified target user does not exist.' });
      return;
    }

    const reportReason = reason || category;
    if (!reportReason || typeof reportReason !== 'string' || !reportReason.trim()) {
      res.status(400).json({ error: 'A valid reason or category for the report is required.' });
      return;
    }

    // Rate limiting: Prevent report flooding (max 10 pending reports per reporter)
    const pendingCount = await UserReport.countDocuments({
      reporterId: user._id,
      status: 'pending',
    });
    if (pendingCount >= 10) {
      res.status(429).json({ error: 'You have reached the maximum number of pending reports.' });
      return;
    }

    const report = await UserReport.create({
      reporterId: user._id, // Strictly derived from JWT
      reportedUserId: targetUser._id,
      reason: reportReason.trim(),
      details: typeof details === 'string' ? details.trim() : '',
      status: 'pending',
    });

    // Real-time alert to moderator console
    emitToAdmins('new_report', {
      reportId: report._id,
      reporter: { id: user._id, username: user.username },
      reportedUser: { id: targetUser._id, username: targetUser.username },
      reason: report.reason,
    });

    res.status(201).json({
      success: true,
      message: 'Report submitted successfully. Our safety team will review it.',
      reportId: report._id,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to submit report.' });
  }
});

// GET /api/reports/mine — Ordinary users can only see reports filed by themselves
router.get('/mine', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const reports = await UserReport.find({ reporterId: user._id })
      .populate('reportedUserId', 'name username avatarHue')
      .sort({ createdAt: -1 })
      .lean();

    res.json(reports);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch personal reports.' });
  }
});

export default router;
