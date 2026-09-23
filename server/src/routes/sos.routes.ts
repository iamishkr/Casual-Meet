import { Router, Response } from 'express';
import mongoose from 'mongoose';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { SosEvent } from '../models/SosEvent.js';
import { Location } from '../models/Location.js';
import { dispatchEmergencyAlerts, retryFailedAlerts } from '../services/dispatchService.js';
import { emitToAdmins, emitToUser } from '../socket.js';
import { sendNotification } from '../services/notificationService.js';

const router = Router();

// Get active SOS for current user
router.get('/active', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const active = await SosEvent.findOne({ userId: user._id, status: 'active' });
    res.json(active);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to check active SOS.' });
  }
});

// Trigger SOS (Idempotent: prevents duplicate active emergencies per user)
router.post('/trigger', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const { source, locationName, timerId, includeLocation } = req.body;

    const existing = await SosEvent.findOne({ userId: user._id, status: 'active' });
    if (existing) {
      res.status(400).json({
        error: 'An active SOS emergency already exists for this account.',
        activeSosId: existing._id,
      });
      return;
    }

    let coords: [number, number] | undefined;
    if (includeLocation !== false) {
      const userLoc = await Location.findOne({ userId: user._id });
      if (userLoc) coords = userLoc.location.coordinates;
    }

    const sos = await SosEvent.create({
      userId: user._id,
      source: source || 'manual',
      location: coords ? { type: 'Point', coordinates: coords } : undefined,
      locationName: locationName?.trim() || 'Unknown Location',
      status: 'active',
      adminNotified: true,
      triggeredTimerId: timerId || undefined,
    });

    // Auto-dispatch alerts to emergency contacts via Dispatch Service Adapter
    const dispatchResults = await dispatchEmergencyAlerts(sos);
    const sentCount = dispatchResults.length;

    sos.smsSent = sentCount > 0;
    sos.contactsNotified = sentCount;
    sos.lastDispatchAt = new Date();
    await sos.save();

    // Broadcast realtime event to Admins/Moderators and the incident owner
    emitToAdmins('sos_triggered', {
      sos,
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        phone: user.phone,
        trustScore: user.trustScore,
        isVerified: user.isVerified,
      },
    });
    emitToUser(user._id.toString(), 'sos_updated', { sos });

    // Persist unified emergency notification
    await sendNotification({
      recipientId: user._id,
      actor: { _id: user._id, name: 'CasualMeet Emergency System', username: 'emergency' },
      type: 'sos_alert',
      title: 'Emergency SOS Active',
      message: `Emergency SOS triggered at ${sos.locationName}. Trusted contacts and safety teams alerted.`,
      targetType: 'user',
      targetId: user._id,
    });

    res.status(201).json({
      sos,
      contactsAlerted: sentCount,
      dispatchDetails: dispatchResults,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to trigger SOS emergency.' });
  }
});

// Resolve SOS with Explicit Role Authorization
// Allowed: Incident Owner, Moderator, or Super Admin
const resolveSosHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const { status } = req.body; // 'resolved' | 'false_alarm'

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(404).json({ error: 'SOS incident not found.' });
      return;
    }

    const sos = await SosEvent.findById(req.params.id);
    if (!sos) {
      res.status(404).json({ error: 'SOS incident not found.' });
      return;
    }

    // RBAC Authorization Check
    const isOwner = sos.userId.toString() === user._id.toString();
    const isAdminOrMod = user.role === 'super_admin' || user.role === 'moderator';

    if (!isOwner && !isAdminOrMod) {
      res.status(403).json({
        error: 'Access denied. You do not have permission to resolve this SOS incident.',
      });
      return;
    }

    sos.status = status === 'false_alarm' ? 'false_alarm' : 'resolved';
    sos.resolvedAt = new Date();
    sos.resolvedBy = user._id as any;
    sos.resolvedByRole = user.role;
    await sos.save();

    // Broadcast resolution event to Admins and User
    emitToAdmins('sos_updated', { sos });
    emitToUser(sos.userId.toString(), 'sos_updated', { sos });

    res.json(sos);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to resolve SOS emergency.' });
  }
};

router.post('/:id/resolve', authenticate, resolveSosHandler);
router.put('/:id/resolve', authenticate, resolveSosHandler);

/**
 * POST /api/sos/:id/retry-sms
 * Retries delivery for any failed emergency contact alerts for an SOS incident.
 */
router.post('/:id/retry-sms', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404).json({ error: 'SOS incident not found.' });
      return;
    }

    const sos = await SosEvent.findById(id);
    if (!sos) {
      res.status(404).json({ error: 'SOS incident not found.' });
      return;
    }

    const isOwner = sos.userId.toString() === user._id.toString();
    const isAdminOrMod = user.role === 'super_admin' || user.role === 'moderator';

    if (!isOwner && !isAdminOrMod) {
      res.status(403).json({ error: 'Access denied. You do not have permission to retry alerts for this SOS.' });
      return;
    }

    const results = await retryFailedAlerts(sos._id);
    res.json({
      success: true,
      retriedCount: results.length,
      details: results,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to retry emergency alerts.' });
  }
});

export default router;
