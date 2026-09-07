import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { MeetingTimer } from '../models/MeetingTimer.js';

const router = Router();

// Get active / recent timers
router.get('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const timers = await MeetingTimer.find({ userId: user._id })
      .populate('meetWithUserId', 'name username avatarHue')
      .sort({ createdAt: -1 })
      .limit(10);

    res.json(timers);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch meeting timers.' });
  }
});

// Arm Meeting Timer (Support both POST / and POST /start)
router.post(['/', '/start'], authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const { durationMinutes, locationName, meetWithUserId, meetupLocation } = req.body;

    const active = await MeetingTimer.findOne({
      userId: user._id,
      status: { $in: ['active', 'extended'] },
    });

    if (active) {
      res.status(400).json({ error: 'A meeting timer is already currently active.' });
      return;
    }

    const isDevTestExpire = process.env.NODE_ENV !== 'production' && req.body.testExpireNow;
    const duration = isDevTestExpire ? 15 : Math.min(Math.max(Number(durationMinutes) || 60, 15), 480);
    const expiresAt = isDevTestExpire
      ? new Date(Date.now() - 60 * 1000)
      : new Date(Date.now() + duration * 60 * 1000);

    const timer = await MeetingTimer.create({
      userId: user._id,
      meetWithUserId: meetWithUserId || undefined,
      locationName: locationName?.trim() || 'Public meetup',
      meetupLocation: meetupLocation || undefined,
      durationMinutes: duration,
      startedAt: new Date(),
      expiresAt,
      status: 'active',
    });

    res.status(201).json(timer);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to arm meeting timer.' });
  }
});

// Mark Safe (State transition: active/extended -> safe)
router.put('/:id/safe', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const timer = await MeetingTimer.findOne({ _id: req.params.id, userId: user._id });

    if (!timer) {
      res.status(404).json({ error: 'Meeting timer not found.' });
      return;
    }

    if (timer.status !== 'active' && timer.status !== 'extended') {
      res.status(400).json({ error: `Cannot mark timer safe; current status is '${timer.status}'.` });
      return;
    }

    timer.status = 'safe';
    timer.resolvedAt = new Date();
    await timer.save();

    res.json(timer);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to resolve meeting timer.' });
  }
});

// Extend Timer (State transition: active/extended -> extended)
router.put('/:id/extend', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const { extraMinutes } = req.body;
    const timer = await MeetingTimer.findOne({ _id: req.params.id, userId: user._id });

    if (!timer) {
      res.status(404).json({ error: 'Meeting timer not found.' });
      return;
    }

    if (timer.status !== 'active' && timer.status !== 'extended') {
      res.status(400).json({ error: `Cannot extend timer; current status is '${timer.status}'.` });
      return;
    }

    const extra = Math.min(Math.max(Number(req.body.extraMinutes || req.body.addMinutes) || 15, 5), 120);
    timer.durationMinutes += extra;
    timer.expiresAt = new Date(timer.expiresAt.getTime() + extra * 60 * 1000);
    timer.status = 'extended';
    await timer.save();

    res.json(timer);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to extend meeting timer.' });
  }
});

// Cancel Timer (State transition: active/extended -> cancelled)
router.put('/:id/cancel', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const timer = await MeetingTimer.findOne({ _id: req.params.id, userId: user._id });

    if (!timer) {
      res.status(404).json({ error: 'Meeting timer not found.' });
      return;
    }

    if (timer.status !== 'active' && timer.status !== 'extended') {
      res.status(400).json({ error: `Cannot cancel timer; current status is '${timer.status}'.` });
      return;
    }

    timer.status = 'cancelled';
    timer.resolvedAt = new Date();
    await timer.save();

    res.json(timer);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to cancel meeting timer.' });
  }
});

export default router;
