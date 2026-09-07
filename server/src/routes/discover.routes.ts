import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { Location } from '../models/Location.js';
import { Connection } from '../models/Connection.js';
import { Suspension } from '../models/Suspension.js';
import { COORD_REDACTED } from '../utils/scanner.js';

const router = Router();

// GET /api/discover — Geospatial discovery using MongoDB native $geoNear pipeline
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

    // 1. Gather excluded users: Suspended accounts
    const activeSuspensions = await Suspension.find({
      isActive: true,
      $or: [{ expiresAt: { $exists: false } }, { expiresAt: { $gt: new Date() } }],
    }).select('userId');
    const suspendedUserIds = activeSuspensions.map((s) => s.userId);

    // 2. Gather excluded users: Blocked connections
    const blockedConns = await Connection.find({
      $or: [{ requesterId: user._id }, { receiverId: user._id }],
      status: 'blocked',
    });
    const blockedUserIds = blockedConns.map((c) =>
      c.requesterId.toString() === user._id.toString() ? c.receiverId : c.requesterId
    );

    const excludedIds = [user._id, ...suspendedUserIds, ...blockedUserIds];

    // 3. Native MongoDB $geoNear Aggregation Pipeline
    const pipeline: any[] = [
      {
        $geoNear: {
          near: { type: 'Point', coordinates: myCoords },
          distanceField: 'distanceMeters',
          maxDistance: maxKm * 1000,
          spherical: true,
          query: {
            userId: { $nin: excludedIds },
          },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'userData',
        },
      },
      { $unwind: '$userData' },
      {
        $match: {
          'userData.showLocation': true,
          'userData.role': 'user',
        },
      },
      { $limit: 50 },
    ];

    const nearbyLocations = await Location.aggregate(pipeline);

    // 4. Batch query existing connections for the discovered results
    const candidateIds = nearbyLocations.map((item: any) => item.userData._id);
    const existingConns = await Connection.find({
      $or: [
        { requesterId: user._id, receiverId: { $in: candidateIds } },
        { requesterId: { $in: candidateIds }, receiverId: user._id },
      ],
    });

    const connMap = new Map<string, any>();
    for (const c of existingConns) {
      const otherId = c.requesterId.toString() === user._id.toString()
        ? c.receiverId.toString()
        : c.requesterId.toString();
      connMap.set(otherId, c);
    }

    // 5. Safe Response DTO — Strictly sanitized, NO raw coordinates or PII
    const results = nearbyLocations.map((item: any) => {
      const u = item.userData;
      const conn = connMap.get(u._id.toString());
      const distanceKm = Math.round((item.distanceMeters / 1000) * 10) / 10;

      return {
        user: {
          id: u._id,
          name: u.name,
          username: u.username,
          bio: u.bio,
          city: u.city,
          occupation: u.occupation,
          interests: u.interests,
          avatarHue: u.avatarHue,
          isVerified: u.isVerified,
          trustScore: u.trustScore,
        },
        distanceKm,
        coordinatesRedacted: COORD_REDACTED,
        conn: conn
          ? {
              id: conn._id,
              status: conn.status,
              direction: conn.requesterId.toString() === user._id.toString() ? 'out' : 'in',
            }
          : null,
      };
    });

    res.json(results);
  } catch (err: any) {
    console.error('Geospatial discovery error:', err);
    res.status(500).json({ error: err.message || 'Discovery search failed.' });
  }
});

export default router;
