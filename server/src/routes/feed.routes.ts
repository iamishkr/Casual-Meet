import { Router, Response } from 'express';
import mongoose from 'mongoose';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { Post, IPost } from '../models/Post.js';
import { PostLike } from '../models/PostLike.js';
import { Follow } from '../models/Follow.js';
import { Connection } from '../models/Connection.js';
import { Suspension } from '../models/Suspension.js';
import { Community } from '../models/Community.js';
import { CommunityMember } from '../models/CommunityMember.js';
import { getBlockedUserIds, SAFE_USER_FIELDS, formatMediaDto } from '../utils/socialAuth.js';

const router = Router();

router.use(authenticate);

function encodeCursor(date: Date, id: mongoose.Types.ObjectId): string {
  return Buffer.from(`${date.getTime()}_${id.toString()}`).toString('base64');
}

function decodeCursor(cursor: string): { date: Date; id: mongoose.Types.ObjectId } | null {
  try {
    const decoded = Buffer.from(cursor, 'base64').toString('utf8');
    const [tsStr, idStr] = decoded.split('_');
    const ts = Number(tsStr);
    if (isNaN(ts) || !mongoose.Types.ObjectId.isValid(idStr)) return null;
    return { date: new Date(ts), id: new mongoose.Types.ObjectId(idStr) };
  } catch {
    return null;
  }
}

/**
 * GET /api/feed
 * Cursor-based paginated feed prioritizing followed users and accepted connections.
 * Strictly excludes blocked, suspended, deleted, moderation-hidden, and unauthorized private community posts.
 */
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);
    const scope = (req.query.scope as string) || 'home'; // 'home' | 'following' | 'connections' | 'explore'
    const cursorParam = req.query.cursor as string | undefined;

    // 1. Gather excluded users: Suspended accounts
    const activeSuspensions = await Suspension.find({
      isActive: true,
      $or: [{ expiresAt: { $exists: false } }, { expiresAt: { $gt: new Date() } }],
    }).select('userId');
    const suspendedUserIds = activeSuspensions.map((s) => s.userId);

    // 2. Gather excluded users: Blocked accounts (bidirectional)
    const blockedUserIds = await getBlockedUserIds(user._id);

    const excludedAuthorIds = [
      ...suspendedUserIds.map((id) => id.toString()),
      ...blockedUserIds.map((id) => id.toString()),
    ];

    // 3. Gather prioritized social relationships
    const [followDocs, connDocs] = await Promise.all([
      Follow.find({ followerId: user._id }).select('followingId'),
      Connection.find({
        $or: [{ requesterId: user._id }, { receiverId: user._id }],
        status: 'accepted',
      }).select('requesterId receiverId'),
    ]);

    const followedIds = followDocs.map((f) => f.followingId);
    const connectedIds = connDocs.map((c) =>
      c.requesterId.toString() === user._id.toString() ? c.receiverId : c.requesterId
    );

    // 4. Construct author filter based on feed scope
    let authorFilter: any = {};

    if (scope === 'following') {
      authorFilter = { $in: followedIds };
    } else if (scope === 'connections') {
      authorFilter = { $in: connectedIds };
    } else if (scope === 'explore') {
      // Explore scope: explicitly public content from verified or community members (not dumped into home)
      authorFilter = { $nin: [user._id, ...excludedAuthorIds] };
    } else {
      // Default 'home' scope: Followed users + accepted connections + self posts
      const homeAuthorSet = new Set<string>([
        user._id.toString(),
        ...followedIds.map((id) => id.toString()),
        ...connectedIds.map((id) => id.toString()),
      ]);

      // Remove any excluded/blocked users from the home pool
      for (const exc of excludedAuthorIds) {
        homeAuthorSet.delete(exc);
      }

      authorFilter = { $in: Array.from(homeAuthorSet).map((id) => new mongoose.Types.ObjectId(id)) };
    }

    // 5. Community Privacy Gate (Directive Section 11):
    // Exclude posts belonging to private communities where user is NOT an active member, or suspended communities
    const userMemberships = await CommunityMember.find({
      userId: user._id,
      status: 'active',
    }).select('communityId');
    const userCommunityIds = userMemberships.map((m) => m.communityId);

    const restrictedCommunities = await Community.find({
      $or: [
        { status: 'suspended' },
        { privacy: 'private', _id: { $nin: userCommunityIds } },
      ],
    }).select('_id');
    const forbiddenCommunityIds = restrictedCommunities.map((c) => c._id);

    // 6. Build query filters with clean $and composition to prevent cursor $or from overwriting visibility $or
    const andClauses: any[] = [
      { authorId: authorFilter },
      { isDeleted: false },
      { moderationStatus: { $ne: 'hidden' } },
    ];

    if (forbiddenCommunityIds.length > 0) {
      andClauses.push({
        $or: [
          { communityId: { $exists: false } },
          { communityId: null },
          { communityId: { $nin: forbiddenCommunityIds } },
        ],
      });
    }

    // If explore scope, only public posts are allowed
    if (scope === 'explore') {
      andClauses.push({ visibility: 'public' });
    } else {
      // Normal feed: visibility can be public, followers (if caller follows), connections (if connected), or self
      andClauses.push({
        $or: [
          { visibility: 'public' },
          { authorId: user._id },
          { visibility: 'followers', authorId: { $in: followedIds } },
          { visibility: 'connections', authorId: { $in: connectedIds } },
        ],
      });
    }

    // 6. Cursor pagination condition
    if (cursorParam) {
      const decoded = decodeCursor(cursorParam);
      if (decoded) {
        andClauses.push({
          $or: [
            { createdAt: { $lt: decoded.date } },
            { createdAt: decoded.date, _id: { $lt: decoded.id } },
          ],
        });
      }
    }

    const query = { $and: andClauses };


    // 7. Execute query with limit + 1 to check hasMore
    const posts = await Post.find(query)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .populate('authorId', SAFE_USER_FIELDS);

    const hasMore = posts.length > limit;
    const items = hasMore ? posts.slice(0, limit) : posts;

    // 8. Determine liked status for current user in batch
    const postIds = items.map((p) => p._id);
    const userLikes = await PostLike.find({
      postId: { $in: postIds },
      userId: user._id,
    }).select('postId');

    const likedPostIdSet = new Set(userLikes.map((l) => l.postId.toString()));

    const nextCursor =
      hasMore && items.length > 0
        ? encodeCursor(items[items.length - 1].createdAt, items[items.length - 1]._id as mongoose.Types.ObjectId)
        : null;

    res.json({
      items: items.map((p) => ({
        id: p._id.toString(),
        author: p.authorId,
        caption: p.caption,
        media: p.media.map((m) => formatMediaDto(m.storageKey, m.mediaType, m)),
        visibility: p.visibility,
        locationName: p.locationName || undefined,
        likeCount: p.likeCount,
        commentCount: p.commentCount,
        isLiked: likedPostIdSet.has(p._id.toString()),
        isEdited: p.isEdited,
        editedAt: p.editedAt,
        moderationStatus: p.moderationStatus,
        createdAt: p.createdAt,
      })),
      nextCursor,
      hasMore,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to retrieve social feed.' });
  }
});

export default router;
