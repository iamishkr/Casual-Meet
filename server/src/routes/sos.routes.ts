import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { SosEvent } from '../models/SosEvent.js';
import { SosDeliveryLog } from '../models/SosDeliveryLog.js';
import { EmergencyContact } from '../models/EmergencyContact.js';
import { Location } from '../models/Location.js';
import { isIndianNumber, normalizePhone } from '../utils/scanner.js';

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

// Trigger SOS
router.post('/trigger', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const { source, locationName, timerId, includeLocation } = req.body;

    const existing = await SosEvent.findOne({ userId: user._id, status: 'active' });
    if (existing) {
      res.status(400).json({ error: 'An SOS emergency is already active for this account.' });
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

    // Auto-dispatch alerts to emergency contacts
    const contacts = await EmergencyContact.find({ userId: user._id, notifyOnSos: true }).limit(5);

    let sentCount = 0;
    for (const c of contacts) {
      const gateway = isIndianNumber(c.phone) ? 'fast2sms' : 'twilio';
      const sid = gateway === 'fast2sms' ? `F2S_${Math.random().toString(36).substring(2, 8).toUpperCase()}` : `SM${Math.random().toString(36).substring(2, 12)}`;

      await SosDeliveryLog.create({
        sosId: sos._id,
        contactId: c._id,
        contactName: c.name,
        contactPhone: normalizePhone(c.phone),
        gateway,
        status: 'sent',
        attempts: 1,
        gatewayResponse: {
          sid,
          cost: gateway === 'fast2sms' ? '₹0.16' : '$0.0079',
        },
      });
      sentCount++;
    }

    sos.smsSent = sentCount > 0;
    sos.contactsNotified = sentCount;
    sos.lastDispatchAt = new Date();
    await sos.save();

    res.status(201).json({
      sos,
      contactsAlerted: sentCount,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to trigger SOS emergency.' });
  }
});

// Resolve SOS
router.post('/:id/resolve', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const { status } = req.body; // 'resolved' | 'false_alarm'

    const sos = await SosEvent.findOne({
      _id: req.params.id,
      $or: [{ userId: user._id }, { ...(user.role === 'super_admin' ? {} : { userId: user._id }) }],
    });

    if (!sos) {
      res.status(404).json({ error: 'SOS event not found or access denied.' });
      return;
    }

    sos.status = status === 'false_alarm' ? 'false_alarm' : 'resolved';
    sos.resolvedAt = new Date();
    await sos.save();

    res.json(sos);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to resolve SOS emergency.' });
  }
});

export default router;
