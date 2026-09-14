import { Router, Response } from 'express';
import mongoose from 'mongoose';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { searchLimiter } from '../middleware/rateLimiter.js';
import { Location } from '../models/Location.js';
import { Connection } from '../models/Connection.js';
import { User } from '../models/User.js';
import { Post } from '../models/Post.js';
import { Follow } from '../models/Follow.js';
import { Suspension } from '../models/Suspension.js';
import { COORD_REDACTED } from '../utils/scanner.js';
import { getBlockedUserIds } from '../utils/socialAuth.js';

const router = Router();

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * GET /api/discover — Geospatial discovery using MongoDB native $geoNear pipeline
 * Preserves privacy-preserving coarse distance and redacted coordinates.
 * trustScore is strictly removed from consumer response.
 */
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
    const blockedUserIds = await getBlockedUserIds(user._id);

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
    // NOTE: trustScore is strictly purged per Phase 3C-4 privacy lockdown.
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

/**
 * GET /api/discover/people — Deterministic social people discovery
 * Ranks candidates using a transparent 5-level deterministic priority based on:
 * 1. Mutual connections + shared interests
 * 2. Shared interests
 * 3. Mutual connections
 * 4. Same coarse city/area
 * 5. Other eligible public users
 * Strictly coarse location (city name). Zero GPS calculations.
 */
router.get('/people', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 30);
    const interestFilter = typeof req.query.interest === 'string' && req.query.interest.trim()
      ? req.query.interest.trim()
      : null;

    // 1. Gather excluded users: self, suspended, blocked
    const [activeSuspensions, blockedUserIds] = await Promise.all([
      Suspension.find({
        isActive: true,
        $or: [{ expiresAt: { $exists: false } }, { expiresAt: { $gt: new Date() } }],
      }).select('userId'),
      getBlockedUserIds(user._id),
    ]);

    const suspendedIds = activeSuspensions.map((s) => s.userId);
    const excludedIds = [user._id, ...suspendedIds, ...blockedUserIds];

    // 2. Fetch candidate public users
    const query: any = {
      _id: { $nin: excludedIds },
      role: 'user',
    };

    if (interestFilter) {
      query.interests = { $regex: new RegExp(`^${escapeRegex(interestFilter)}$`, 'i') };
    }

    const candidateUsers = await User.find(query)
      .select('_id name username bio city occupation interests avatarHue isVerified createdAt')
      .lean();

    if (candidateUsers.length === 0) {
      res.json({
        people: [],
        total: 0,
        page,
        limit,
      });
      return;
    }

    const candidateIds = candidateUsers.map((c) => c._id);

    // 3. Batch query caller's connections and candidate connections
    const [callerConns, candidateConns, followsGiven, followsReceived, directConns] = await Promise.all([
      Connection.find({
        $or: [{ requesterId: user._id }, { receiverId: user._id }],
        status: 'accepted',
      }).select('requesterId receiverId'),
      Connection.find({
        $or: [
          { requesterId: { $in: candidateIds } },
          { receiverId: { $in: candidateIds } },
        ],
        status: 'accepted',
      }).select('requesterId receiverId'),
      Follow.find({ followerId: user._id, followingId: { $in: candidateIds } }).select('followingId'),
      Follow.find({ followerId: { $in: candidateIds }, followingId: user._id }).select('followerId'),
      Connection.find({
        $or: [
          { requesterId: user._id, receiverId: { $in: candidateIds } },
          { requesterId: { $in: candidateIds }, receiverId: user._id },
        ],
      }).select('requesterId receiverId status'),
    ]);

    // Set of caller's accepted friend IDs
    const callerFriendIds = new Set(
      callerConns.map((c) =>
        c.requesterId.toString() === user._id.toString()
          ? c.receiverId.toString()
          : c.requesterId.toString()
      )
    );

    // Map candidate ID -> Set of friend IDs
    const candidateFriendsMap = new Map<string, Set<string>>();
    for (const c of candidateConns) {
      const rId = c.requesterId.toString();
      const recId = c.receiverId.toString();

      if (!candidateFriendsMap.has(rId)) candidateFriendsMap.set(rId, new Set());
      candidateFriendsMap.get(rId)!.add(recId);

      if (!candidateFriendsMap.has(recId)) candidateFriendsMap.set(recId, new Set());
      candidateFriendsMap.get(recId)!.add(rId);
    }

    const followingSet = new Set(followsGiven.map((f) => f.followingId.toString()));
    const followerSet = new Set(followsReceived.map((f) => f.followerId.toString()));

    const directConnMap = new Map<string, any>();
    for (const c of directConns) {
      const otherId = c.requesterId.toString() === user._id.toString()
        ? c.receiverId.toString()
        : c.requesterId.toString();
      directConnMap.set(otherId, c);
    }

    const userInterestsLower = (user.interests || []).map((i: string) => i.trim().toLowerCase());
    const userCityLower = (user.city || '').trim().toLowerCase();

    // 4. Score candidates using 5-level deterministic priority
    const scoredCandidates = candidateUsers.map((cand) => {
      const candIdStr = cand._id.toString();
      const candFriends = candidateFriendsMap.get(candIdStr) || new Set();

      // Mutual connections count
      let mutualCount = 0;
      for (const fId of candFriends) {
        if (callerFriendIds.has(fId)) {
          mutualCount++;
        }
      }

      // Shared interests
      const sharedInterests = (cand.interests || []).filter((i: string) =>
        userInterestsLower.includes(i.trim().toLowerCase())
      );
      const sharedCount = sharedInterests.length;

      // Coarse location match (city text)
      const candCityLower = (cand.city || '').trim().toLowerCase();
      const sameCity = Boolean(userCityLower && candCityLower && userCityLower === candCityLower);

      // Deterministic priority bucket (1 is highest priority, 5 is lowest)
      let priorityBucket = 5;
      if (mutualCount > 0 && sharedCount > 0) {
        priorityBucket = 1;
      } else if (sharedCount > 0 && mutualCount === 0) {
        priorityBucket = 2;
      } else if (mutualCount > 0 && sharedCount === 0) {
        priorityBucket = 3;
      } else if (sameCity && mutualCount === 0 && sharedCount === 0) {
        priorityBucket = 4;
      } else {
        priorityBucket = 5;
      }

      // Explanations (only explicit, non-sensitive public facts)
      const explanations: string[] = [];
      if (mutualCount > 0) {
        explanations.push(`${mutualCount} mutual connection${mutualCount > 1 ? 's' : ''}`);
      }
      if (sharedCount > 0) {
        explanations.push(`Shares ${sharedCount} interest${sharedCount > 1 ? 's' : ''}`);
      }
      if (sameCity) {
        explanations.push(`Same city (${cand.city})`);
      }
      if (cand.isVerified) {
        explanations.push('ID Verified');
      }

      // Relationship status with caller
      const connDoc = directConnMap.get(candIdStr);
      const connectionStatus: 'none' | 'pending' | 'connected' =
        connDoc?.status === 'accepted' ? 'connected' : connDoc?.status === 'pending' ? 'pending' : 'none';

      return {
        cand,
        priorityBucket,
        mutualCount,
        sharedCount,
        sharedInterests,
        sameCity,
        explanations,
        relationship: {
          isFollowing: followingSet.has(candIdStr),
          isFollower: followerSet.has(candIdStr),
          connectionStatus,
        },
      };
    });

    // Sort deterministically:
    // Primary: priorityBucket (ascending: 1 -> 2 -> 3 -> 4 -> 5)
    // Secondary: combined signal count (descending)
    // Tertiary: isVerified (true > false)
    // Quaternary: createdAt (descending)
    // Quinary: _id (deterministic tie-breaker)
    scoredCandidates.sort((a, b) => {
      if (a.priorityBucket !== b.priorityBucket) {
        return a.priorityBucket - b.priorityBucket;
      }
      const signalA = a.mutualCount + a.sharedCount;
      const signalB = b.mutualCount + b.sharedCount;
      if (signalA !== signalB) {
        return signalB - signalA;
      }
      if (a.cand.isVerified !== b.cand.isVerified) {
        return a.cand.isVerified ? -1 : 1;
      }
      const timeA = new Date(a.cand.createdAt).getTime();
      const timeB = new Date(b.cand.createdAt).getTime();
      if (timeA !== timeB) {
        return timeB - timeA;
      }
      return a.cand._id.toString().localeCompare(b.cand._id.toString());
    });

    const total = scoredCandidates.length;
    const pagedCandidates = scoredCandidates.slice((page - 1) * limit, page * limit);

    // Build final safe DTOs — NEVER expose internal priority score or private data
    const people = pagedCandidates.map((item) => ({
      id: item.cand._id,
      name: item.cand.name,
      username: item.cand.username,
      bio: item.cand.bio,
      city: item.cand.city,
      occupation: item.cand.occupation,
      interests: item.cand.interests,
      avatarHue: item.cand.avatarHue,
      isVerified: item.cand.isVerified,
      sharedInterests: item.sharedInterests,
      mutualConnectionsCount: item.mutualCount,
      explanations: item.explanations,
      relationship: item.relationship,
    }));

    res.json({
      people,
      total,
      page,
      limit,
    });
  } catch (err: any) {
    console.error('Social people discovery error:', err);
    res.status(500).json({ error: err.message || 'Failed to discover people.' });
  }
});

/**
 * GET /api/discover/search — Anti-enumeration protected discovery search
 * Rate limited with searchLimiter (60 req/min).
 * Requires query length between 2 and 50 characters.
 * Limits results to max 20 per request.
 * Strictly respects blocks, public visibility, moderation, and excludes private fields.
 */
router.get('/search', authenticate, searchLimiter, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const rawQ = req.query.q;

    if (!rawQ || typeof rawQ !== 'string' || rawQ.trim().length < 2 || rawQ.trim().length > 50) {
      res.status(400).json({ error: 'Search query must be between 2 and 50 characters.' });
      return;
    }

    const q = rawQ.trim();
    const type = typeof req.query.type === 'string' ? req.query.type : 'all'; // 'people' | 'posts' | 'all'
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 20);

    // Excluded authors: self + blocked users bidirectionally
    const blockedUserIds = await getBlockedUserIds(user._id);
    const excludedIds = [user._id, ...blockedUserIds];

    const escaped = escapeRegex(q);
    const regexQuery = { $regex: escaped, $options: 'i' };

    let peopleResults: any[] = [];
    let postResults: any[] = [];

    // Search People (if requested)
    if (type === 'people' || type === 'all') {
      const users = await User.find({
        _id: { $nin: excludedIds },
        role: 'user',
        $or: [
          { username: regexQuery },
          { name: regexQuery },
          { city: regexQuery },
          { interests: regexQuery },
        ],
      })
        .select('_id name username bio city occupation interests avatarHue isVerified')
        .limit(limit)
        .lean();

      peopleResults = users.map((u) => ({
        id: u._id,
        name: u.name,
        username: u.username,
        bio: u.bio,
        city: u.city,
        occupation: u.occupation,
        interests: u.interests,
        avatarHue: u.avatarHue,
        isVerified: u.isVerified,
      }));
    }

    // Search Public Posts (if requested)
    if (type === 'posts' || type === 'all') {
      const posts = await Post.find({
        visibility: 'public',
        isDeleted: false,
        moderationStatus: 'visible',
        authorId: { $nin: excludedIds },
        $or: [
          { caption: regexQuery },
          { locationName: regexQuery },
        ],
      })
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate('authorId', 'name username avatarHue isVerified')
        .lean();

      postResults = posts.map((p: any) => ({
        id: p._id,
        caption: p.caption,
        media: p.media,
        locationName: p.locationName,
        likeCount: p.likeCount,
        commentCount: p.commentCount,
        createdAt: p.createdAt,
        author: p.authorId ? {
          id: p.authorId._id,
          name: p.authorId.name,
          username: p.authorId.username,
          avatarHue: p.authorId.avatarHue,
          isVerified: p.authorId.isVerified,
        } : null,
      }));
    }

    res.json({
      query: q,
      people: peopleResults,
      posts: postResults,
    });
  } catch (err: any) {
    console.error('Discovery search error:', err);
    res.status(500).json({ error: err.message || 'Search failed.' });
  }
});

export default router;
