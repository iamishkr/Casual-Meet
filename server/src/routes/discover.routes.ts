import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { Location } from '../models/Location.js';
import { User } from '../models/User.js';
import { Connection } from '../models/Connection.js';
import { Suspension } from '../models/Suspension.js';
import { haversineKm, COORD_REDACTED } from '../utils/scanner.js';

const router = Router();

router.get('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const maxKm = Math.min(Math.max(Number(req.query.maxKm) || 10, 1), 50);

    const userLoc = await Location.findOne({ userId: user._id });
    if (!userLoc) {
      res.json([]);
      return;
    }

    const myCoords = userLoc.location.coordinates;

    // Fetch suspended users to exclude
    const activeSuspensions = await Suspension.find({
      isActive: true,
      $or: [{ expiresAt: { $exists: false } }, { expiresAt: { $gt: new Date() } }],
    }).select('userId');
    const suspendedUserIds = activeSuspensions.map((s) => s.userId.toString());

    // Fetch candidate locations
    const allLocations = await Location.find({
      userId: { $ne: user._id },
    }).populate('userId');

    const results = [];

    for (const loc of allLocations) {
      const targetUser = loc.userId as any;
      if (!targetUser || !targetUser.showLocation || suspendedUserIds.includes(targetUser._id.toString())) {
        continue;
      }

      const km = haversineKm(myCoords, loc.location.coordinates);
      if (km > maxKm) continue;

      // Check existing connection
      const conn = await Connection.findOne({
        $or: [
          { requesterId: user._id, receiverId: targetUser._id },
          { requesterId: targetUser._id, receiverId: user._id },
        ],
      });

      if (conn && conn.status === 'blocked') continue;

      results.push({
        user: {
          id: targetUser._id,
          name: targetUser.name,
          username: targetUser.username,
          bio: targetUser.bio,
          city: targetUser.city,
          occupation: targetUser.occupation,
          interests: targetUser.interests,
          avatarHue: targetUser.avatarHue,
          isVerified: targetUser.isVerified,
          trustScore: targetUser.trustScore,
        },
        distanceKm: Math.round(km * 10) / 10,
        coordinatesRedacted: COORD_REDACTED,
        conn: conn
          ? {
              id: conn._id,
              status: conn.status,
              direction: conn.requesterId.toString() === user._id.toString() ? 'out' : 'in',
            }
          : null,
      });
    }

    results.sort((a, b) => a.distanceKm - b.distanceKm);
    res.json(results);
  } catch (err: any) {
    console.error('Discovery error:', err);
    res.status(500).json({ error: err.message || 'Discovery search failed.' });
  }
});

export default router;
