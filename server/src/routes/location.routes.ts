import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { Location } from '../models/Location.js';

const router = Router();

// PUT /api/location — Update authenticated user's real-time GPS coordinates
router.put('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const { latitude, longitude } = req.body;

    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      res.status(400).json({ error: 'Latitude and longitude must be numbers.' });
      return;
    }

    // Strict Geographic Boundary Validation
    if (latitude < -90 || latitude > 90) {
      res.status(400).json({ error: 'Invalid latitude. Must be between -90 and 90.' });
      return;
    }

    if (longitude < -180 || longitude > 180) {
      res.status(400).json({ error: 'Invalid longitude. Must be between -180 and 180.' });
      return;
    }

    // GeoJSON specification mandates [longitude, latitude] coordinate ordering
    const doc = await Location.findOneAndUpdate(
      { userId: user._id },
      {
        location: {
          type: 'Point',
          coordinates: [longitude, latitude],
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Privacy Safe Response: NEVER expose raw GPS coordinates back in consumer confirmation
    res.json({
      success: true,
      updatedAt: doc.updatedAt,
      message: 'Location updated securely.',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update location.' });
  }
});

export default router;
