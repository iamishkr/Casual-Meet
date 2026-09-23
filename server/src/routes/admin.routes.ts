import { Router, Response } from 'express';
import mongoose from 'mongoose';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth.js';
import { SosEvent } from '../models/SosEvent.js';
import { SosDeliveryLog } from '../models/SosDeliveryLog.js';
import { UserReport } from '../models/UserReport.js';
import { VerificationRequest } from '../models/VerificationRequest.js';
import { User } from '../models/User.js';
import { Suspension } from '../models/Suspension.js';
import { DailyStat } from '../models/DailyStat.js';
import { Message } from '../models/Message.js';
import { MeetingTimer } from '../models/MeetingTimer.js';
import { SafeZone } from '../models/SafeZone.js';
import { Connection } from '../models/Connection.js';
import { Post } from '../models/Post.js';
import { PostComment } from '../models/PostComment.js';
import { getSmsGatewayStatus, sendTestSms } from '../services/dispatchService.js';

const router = Router();

// Apply auth + requireAdmin to all admin endpoints
router.use(authenticate);
router.use(requireAdmin);

// Live SOS Incident Board
router.get('/sos', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const events = await SosEvent.find()
      .populate('userId', 'name username phone avatarHue trustScore isVerified')
      .sort({ createdAt: -1 });

    const eventIds = events.map((e) => e._id);
    const logs = await SosDeliveryLog.find({ sosId: { $in: eventIds } }).sort({ createdAt: 1 });

    res.json({ events, logs });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch admin SOS records.' });
  }
});

// Moderation: User Reports
router.get('/reports', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const reports = await UserReport.find()
      .populate('reporterId', 'name username')
      .populate('reportedUserId', 'name username trustScore isVerified')
      .sort({ createdAt: -1 });

    res.json(reports);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch reports.' });
  }
});

// Resolve Report & apply suspension
router.post('/reports/:id/resolve', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const admin = req.user!;
    const { outcome, note } = req.body; // 'user_suspended' | 'warning_issued' | 'false_report'
    const report = await UserReport.findById(req.params.id);

    if (!report) {
      res.status(404).json({ error: 'Report not found.' });
      return;
    }

    report.status = outcome === 'false_report' ? 'dismissed' : 'actioned';
    report.outcome = outcome;
    report.actionNote = note?.trim() || '';
    report.resolvedBy = admin._id as any;
    report.resolvedAt = new Date();
    await report.save();

    if (outcome === 'user_suspended') {
      await Suspension.create({
        userId: report.reportedUserId,
        suspendedBy: admin._id,
        type: 'temporary',
        reason: `${report.reason} (Report #${report._id})`,
        isActive: true,
        expiresAt: new Date(Date.now() + 7 * 86400000), // 7 days
      });
    }

    // If report targeted a post or comment and was actioned, hide the content
    if (outcome !== 'false_report' && report.targetId) {
      if (report.targetType === 'post') {
        await Post.updateOne(
          { _id: report.targetId },
          { moderationStatus: 'hidden', moderationReason: report.reason }
        );
      } else if (report.targetType === 'comment') {
        await PostComment.updateOne(
          { _id: report.targetId },
          { moderationStatus: 'hidden' }
        );
      }
    }

    res.json(report);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to resolve report.' });
  }
});

// Verification Requests
router.get('/verifications', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const verifs = await VerificationRequest.find()
      .populate('userId', 'name username avatarHue trustScore')
      .sort({ createdAt: -1 });

    res.json(verifs);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch verification requests.' });
  }
});

// Review Verification
router.post('/verifications/:id/review', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const admin = req.user!;
    const { approve, note } = req.body;
    const verif = await VerificationRequest.findById(req.params.id);

    if (!verif) {
      res.status(404).json({ error: 'Verification request not found.' });
      return;
    }

    verif.status = approve ? 'approved' : 'rejected';
    verif.reviewNote = note?.trim() || '';
    verif.reviewedBy = admin._id as any;
    verif.reviewedAt = new Date();
    await verif.save();

    if (approve) {
      const user = await User.findById(verif.userId);
      if (user) {
        user.isVerified = true;
        user.trustScore += 20;
        await user.save();
      }
    }

    res.json(verif);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to review verification request.' });
  }
});

// Users Management & Suspensions
router.get('/users', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const users = await User.find().select('-passwordHash').sort({ createdAt: -1 });
    const suspensions = await Suspension.find({ isActive: true });
    res.json({ users, suspensions });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch user directory.' });
  }
});

// Apply Suspension
router.post('/users/:id/suspend', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const admin = req.user!;
    const { type, reason, days } = req.body;

    const suspension = await Suspension.create({
      userId: req.params.id,
      suspendedBy: admin._id,
      type: type || 'temporary',
      reason: reason || 'Violation of community safety guidelines',
      isActive: true,
      expiresAt: type === 'temporary' ? new Date(Date.now() + (Number(days) || 7) * 86400000) : undefined,
    });

    res.status(201).json(suspension);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to suspend account.' });
  }
});

// Lift Suspension
router.delete('/suspensions/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const susp = await Suspension.findById(req.params.id);
    if (!susp) {
      res.status(404).json({ error: 'Suspension record not found.' });
      return;
    }
    susp.isActive = false;
    await susp.save();
    res.json({ success: true, message: 'Suspension lifted successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to lift suspension.' });
  }
});

// Daily Analytics
router.get('/analytics/daily', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const stats = await DailyStat.find().sort({ dateKey: 1 });
    res.json(stats);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch analytics.' });
  }
});

// Suspicious Activity & Security Watch Monitor
router.get('/suspicious', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [flaggedMessages, lowTrustUsers, activeTimers, recentSuspensions] = await Promise.all([
      Message.find({ containsSensitive: true })
        .populate('senderId', 'name username phone avatarHue trustScore')
        .sort({ createdAt: -1 })
        .limit(30)
        .lean(),
      User.find({ trustScore: { $lt: 90 } })
        .select('-passwordHash')
        .sort({ trustScore: 1 })
        .limit(20)
        .lean(),
      MeetingTimer.find({ status: 'active' })
        .populate('userId', 'name username phone avatarHue')
        .populate('meetWithUserId', 'name username phone')
        .sort({ expiresAt: 1 })
        .lean(),
      Suspension.find({ isActive: true })
        .populate('userId', 'name username')
        .populate('suspendedBy', 'name username')
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    res.json({
      flaggedMessages,
      lowTrustUsers,
      activeTimers,
      recentSuspensions,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch suspicious activity.' });
  }
});

// Safe Zones: Create new verified safe zone
router.post('/safe-zones', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, category, area, coordinates } = req.body;
    if (!name || !category || !area) {
      res.status(400).json({ error: 'Name, category, and area are required.' });
      return;
    }

    const coords: [number, number] = Array.isArray(coordinates) && coordinates.length === 2
      ? [Number(coordinates[0]), Number(coordinates[1])]
      : [77.6245, 12.9352]; // default Bengaluru center

    const safeZone = await SafeZone.create({
      name: name.trim(),
      category,
      area: area.trim(),
      location: {
        type: 'Point',
        coordinates: coords,
      },
    });

    res.status(201).json(safeZone);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to create safe zone.' });
  }
});

// Safe Zones: List all
router.get('/safe-zones', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const zones = await SafeZone.find().sort({ createdAt: -1 }).lean();
    res.json(zones);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch safe zones.' });
  }
});

// Admin: Trigger authoritative timer worker check manually
router.post('/timers/check-expired', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { checkExpiredTimers } = await import('../workers/timerWorker.js');
    const result = await checkExpiredTimers();
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to trigger timer check.' });
  }
});

// Admin: Moderate Post
router.post('/posts/:id/moderate', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid post ID format.' });
      return;
    }

    const { action, reason } = req.body; // 'hide' | 'unhide' | 'flag'
    if (!['hide', 'unhide', 'flag'].includes(action)) {
      res.status(400).json({ error: 'Invalid moderation action. Must be hide, unhide, or flag.' });
      return;
    }

    const moderationStatus = action === 'unhide' ? 'visible' : action === 'hide' ? 'hidden' : 'flagged';
    const post = await Post.findByIdAndUpdate(
      id,
      {
        moderationStatus,
        moderationReason: reason || undefined,
      },
      { new: true }
    );

    if (!post) {
      res.status(404).json({ error: 'Post not found.' });
      return;
    }

    res.json({ success: true, post });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to moderate post.' });
  }
});

// Admin: Moderate Comment
router.post('/comments/:id/moderate', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid comment ID format.' });
      return;
    }

    const { action } = req.body; // 'hide' | 'unhide' | 'flag'
    if (!['hide', 'unhide', 'flag'].includes(action)) {
      res.status(400).json({ error: 'Invalid moderation action. Must be hide, unhide, or flag.' });
      return;
    }

    const moderationStatus = action === 'unhide' ? 'visible' : action === 'hide' ? 'hidden' : 'flagged';
    const comment = await PostComment.findByIdAndUpdate(
      id,
      { moderationStatus },
      { new: true }
    );

    if (!comment) {
      res.status(404).json({ error: 'Comment not found.' });
      return;
    }

    res.json({ success: true, comment });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to moderate comment.' });
  }
});

/**
 * GET /api/admin/sms/status
 * Returns current configuration and operational status of Fast2SMS & Twilio.
 */
router.get('/sms/status', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const status = getSmsGatewayStatus();
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to check SMS gateway status.' });
  }
});

/**
 * POST /api/admin/sms/test
 * Sends a standalone diagnostic SMS to test carrier routing.
 */
router.post('/sms/test', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { phone, message } = req.body;
    if (!phone || typeof phone !== 'string') {
      res.status(400).json({ error: 'Target phone number is required.' });
      return;
    }

    const result = await sendTestSms(phone, message);
    res.json({
      success: result.status === 'sent' || result.status === 'simulated',
      result,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to execute test SMS.' });
  }
});

export default router;
