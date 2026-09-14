import { Router, Response } from 'express';
import mongoose from 'mongoose';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { UserReport } from '../models/UserReport.js';
import { User } from '../models/User.js';
import { Post } from '../models/Post.js';
import { PostComment } from '../models/PostComment.js';
import { Story } from '../models/Story.js';
import { emitToAdmins } from '../socket.js';

const router = Router();

router.use(authenticate);

// POST /api/reports — File a new safety/harassment report against another user, post, comment, or story
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const { reportedUserId, targetType, targetId, category, reason, details } = req.body;

    const safeTargetType = ['user', 'post', 'comment', 'story'].includes(targetType)
      ? targetType
      : 'user';

    let resolvedReportedUserId: mongoose.Types.ObjectId | null = null;
    let resolvedTargetId: mongoose.Types.ObjectId | undefined = undefined;

    if (safeTargetType === 'post') {
      if (!targetId || !mongoose.Types.ObjectId.isValid(targetId)) {
        res.status(400).json({ error: 'Valid target post ID is required.' });
        return;
      }
      const post = await Post.findById(targetId);
      if (!post) {
        res.status(404).json({ error: 'Reported post not found.' });
        return;
      }
      resolvedTargetId = post._id as mongoose.Types.ObjectId;
      resolvedReportedUserId = post.authorId;
    } else if (safeTargetType === 'comment') {
      if (!targetId || !mongoose.Types.ObjectId.isValid(targetId)) {
        res.status(400).json({ error: 'Valid target comment ID is required.' });
        return;
      }
      const comment = await PostComment.findById(targetId);
      if (!comment) {
        res.status(404).json({ error: 'Reported comment not found.' });
        return;
      }
      resolvedTargetId = comment._id as mongoose.Types.ObjectId;
      resolvedReportedUserId = comment.authorId;
    } else if (safeTargetType === 'story') {
      if (!targetId || !mongoose.Types.ObjectId.isValid(targetId)) {
        res.status(400).json({ error: 'Valid target story ID is required.' });
        return;
      }
      const story = await Story.findById(targetId);
      if (!story) {
        res.status(404).json({ error: 'Reported story not found.' });
        return;
      }
      resolvedTargetId = story._id as mongoose.Types.ObjectId;
      resolvedReportedUserId = story.authorId;
    } else {
      // Default: user report
      if (!reportedUserId || !mongoose.Types.ObjectId.isValid(reportedUserId)) {
        res.status(400).json({ error: 'Valid reported user ID is required.' });
        return;
      }
      resolvedReportedUserId = new mongoose.Types.ObjectId(reportedUserId);
    }

    if (!resolvedReportedUserId) {
      res.status(400).json({ error: 'Could not determine reported account.' });
      return;
    }

    if (resolvedReportedUserId.toString() === user._id.toString()) {
      res.status(400).json({ error: 'You cannot submit a report against your own account or content.' });
      return;
    }

    const targetUser = await User.findById(resolvedReportedUserId);
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

    // Safeguard #9: Reporting does NOT automatically hide content.
    // Enters moderation queue for admin/moderator review.
    const report = await UserReport.create({
      reporterId: user._id,
      reportedUserId: targetUser._id,
      targetType: safeTargetType,
      targetId: resolvedTargetId,
      reason: reportReason.trim(),
      details: typeof details === 'string' ? details.trim() : '',
      status: 'pending',
    });

    // Real-time alert to moderator console
    emitToAdmins('new_report', {
      reportId: report._id,
      targetType: safeTargetType,
      targetId: resolvedTargetId,
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
