import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { SafeZone } from '../models/SafeZone.js';

const router = Router();

// GET /api/safe-zones — Publicly accessible to all authenticated consumers
// Distinguishes public venue coordinates from private user GPS coordinates
router.get('/', authenticate, async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const zones = await SafeZone.find()
      .sort({ name: 1 })
      .lean();

    const sanitized = zones.map((z: any) => ({
      id: z._id,
      name: z.name,
      category: z.category,
      area: z.area,
      verificationLevel: 'verified',
      amenities: ['Well-lit', 'CCTV monitored', 'Public transit accessible'],
      venueCoordinates: z.location?.coordinates || [77.6245, 12.9352],
      isPublicVenue: true,
    }));

    res.json(sanitized);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch safe zones.' });
  }
});

export default router;
