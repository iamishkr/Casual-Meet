import { Router, Response } from 'express';
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

export default router;
