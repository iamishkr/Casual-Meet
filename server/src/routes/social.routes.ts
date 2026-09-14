import { Router, Response } from 'express';
import mongoose from 'mongoose';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { followLimiter } from '../middleware/rateLimiter.js';
import { Follow } from '../models/Follow.js';
import { Connection } from '../models/Connection.js';
import { User } from '../models/User.js';
import { Post } from '../models/Post.js';
import { PostLike } from '../models/PostLike.js';
import {
  isBlocked,
  isFollower,
  isConnected,
  getBlockedUserIds,
  SAFE_USER_FIELDS,
  formatMediaDto,
} from '../utils/socialAuth.js';
import { sendNotification } from '../services/notificationService.js';

const router = Router();

router.use(authenticate);

/**
 * POST /api/users/:id/follow
 * Follow another user (one-way relationship).
 * Rejects self-follow, blocked relationships, and duplicate follows.
 */
router.post('/:id/follow', followLimiter, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const targetUserId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
      res.status(400).json({ error: 'Invalid user ID format.' });
      return;
    }

    if (user._id.toString() === targetUserId) {
      res.status(400).json({ error: 'You cannot follow yourself.' });
      return;
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      res.status(404).json({ error: 'User to follow does not exist.' });
      return;
    }

    // Block check
    const blocked = await isBlocked(user._id, targetUserId);
    if (blocked) {
      res.status(403).json({ error: 'Cannot follow a blocked user.' });
      return;
    }

    let newlyFollowed = false;
    try {
      await Follow.create({
        followerId: user._id,
        followingId: targetUser._id,
      });
      newlyFollowed = true;
    } catch (err: any) {
      if (err.code === 11000) {
        // Already following (idempotent)
        newlyFollowed = false;
      } else {
        throw err;
      }
    }

    if (newlyFollowed) {
      await sendNotification({
        recipientId: targetUser._id,
        actor: user,
        type: 'new_follower',
        title: 'New Follower',
        message: `${user.name} started following you.`,
        targetType: 'user',
        targetId: user._id,
      });
    }

    res.json({ success: true, following: true, message: `Now following ${targetUser.name}.` });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to follow user.' });
  }
});

/**
 * DELETE /api/users/:id/follow
 * Unfollow a user.
 */
router.delete('/:id/follow', followLimiter, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const targetUserId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
      res.status(400).json({ error: 'Invalid user ID format.' });
      return;
    }

    await Follow.deleteOne({
      followerId: user._id,
      followingId: targetUserId,
    });

    res.json({ success: true, following: false, message: 'Unfollowed successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to unfollow user.' });
  }
});

/**
 * GET /api/users/:id/followers
 * Paginated followers list.
 */
router.get('/:id/followers', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const targetUserId = req.params.id;
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);
    const page = Math.max(Number(req.query.page) || 1, 1);

    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
      res.status(400).json({ error: 'Invalid user ID format.' });
      return;
    }

    // Block check
    if (user._id.toString() !== targetUserId && (await isBlocked(user._id, targetUserId))) {
      res.status(403).json({ error: 'Access denied.' });
      return;
    }

    const followDocs = await Follow.find({ followingId: targetUserId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('followerId', SAFE_USER_FIELDS);

    const total = await Follow.countDocuments({ followingId: targetUserId });

    res.json({
      followers: followDocs.map((f) => ({
        user: f.followerId,
        followedAt: f.createdAt,
      })),
      total,
      page,
      limit,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch followers.' });
  }
});

/**
 * GET /api/users/:id/following
 * Paginated following list.
 */
router.get('/:id/following', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const targetUserId = req.params.id;
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);
    const page = Math.max(Number(req.query.page) || 1, 1);

    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
      res.status(400).json({ error: 'Invalid user ID format.' });
      return;
    }

    // Block check
    if (user._id.toString() !== targetUserId && (await isBlocked(user._id, targetUserId))) {
      res.status(403).json({ error: 'Access denied.' });
      return;
    }

    const followDocs = await Follow.find({ followerId: targetUserId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('followingId', SAFE_USER_FIELDS);

    const total = await Follow.countDocuments({ followerId: targetUserId });

    res.json({
      following: followDocs.map((f) => ({
        user: f.followingId,
        followedAt: f.createdAt,
      })),
      total,
      page,
      limit,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch following.' });
  }
});

/**
 * GET /api/users/:id/mutual-connections
 * Retrieve mutual accepted connections between caller and target user.
 * Strictly respects blocking, authorization, and safe projection.
 */
router.get('/:id/mutual-connections', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const targetUserId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
      res.status(400).json({ error: 'Invalid user ID format.' });
      return;
    }

    if (user._id.toString() === targetUserId) {
      res.status(400).json({ error: 'Cannot view mutual connections with yourself.' });
      return;
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      res.status(404).json({ error: 'Target user does not exist.' });
      return;
    }

    // Bidirectional block check
    const blocked = await isBlocked(user._id, targetUserId);
    if (blocked) {
      res.status(403).json({ error: 'Cannot view mutual connections for this user.' });
      return;
    }

    // Find accepted connections of caller
    const callerConns = await Connection.find({
      $or: [{ requesterId: user._id }, { receiverId: user._id }],
      status: 'accepted',
    }).select('requesterId receiverId');

    const callerFriendIds = callerConns.map((c) =>
      c.requesterId.toString() === user._id.toString()
        ? c.receiverId.toString()
        : c.requesterId.toString()
    );

    // Find accepted connections of target user
    const targetConns = await Connection.find({
      $or: [{ requesterId: targetUserId }, { receiverId: targetUserId }],
      status: 'accepted',
    }).select('requesterId receiverId');

    const targetFriendIds = targetConns.map((c) =>
      c.requesterId.toString() === targetUserId
        ? c.receiverId.toString()
        : c.requesterId.toString()
    );

    // Common accepted connection IDs
    const mutualIdStrings = callerFriendIds.filter((id) => targetFriendIds.includes(id));

    // Exclude any mutual friends who are blocked by caller or have blocked caller
    const blockedIds = (await getBlockedUserIds(user._id)).map((id) => id.toString());
    const accessibleMutualIds = mutualIdStrings.filter((id) => !blockedIds.includes(id));

    // Bounded pagination: max 20, default 10
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 20);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const total = accessibleMutualIds.length;

    const pagedIds = accessibleMutualIds.slice((page - 1) * limit, page * limit);

    // Safe public projection only: _id, name, username, avatarHue, isVerified, city
    const mutualUsers = await User.find({
      _id: { $in: pagedIds },
    }).select('_id name username avatarHue isVerified city');

    res.json({
      mutualConnections: mutualUsers.map((u) => ({
        id: u._id,
        name: u.name,
        username: u.username,
        avatarHue: u.avatarHue,
        isVerified: u.isVerified,
        city: u.city,
      })),
      total,
      page,
      limit,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch mutual connections.' });
  }
});


/**
 * GET /api/users/:id/relationship
 * Inspect combined follower and connection relationship between caller and target.
 */
router.get('/:id/relationship', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const targetUserId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
      res.status(400).json({ error: 'Invalid user ID format.' });
      return;
    }

    const [isFollowingTarget, isFollowedByTarget, connectionDoc] = await Promise.all([
      isFollower(user._id, targetUserId),
      isFollower(targetUserId, user._id),
      Connection.findOne({
        $or: [
          { requesterId: user._id, receiverId: targetUserId },
          { requesterId: targetUserId, receiverId: user._id },
        ],
      }),
    ]);

    const isBlockedRelationship = connectionDoc?.status === 'blocked';
    const connectionStatus = connectionDoc ? connectionDoc.status : 'none';
    const canMeet = connectionStatus === 'accepted';
    const canMessage = connectionStatus === 'accepted';

    res.json({
      userId: targetUserId,
      isFollowing: isFollowingTarget,
      isFollowedBy: isFollowedByTarget,
      connectionStatus,
      isBlocked: isBlockedRelationship,
      canMessage,
      canMeet,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to retrieve relationship.' });
  }
});

/**
 * GET /api/users/:id/profile (also matches GET /api/users/:id)
 * Authoritative public social profile with safety identity and mutual connection stats.
 * Strictly omits internal fields, private emergency contacts, and trustScore (Directive #1).
 */
router.get(['/:id/profile', '/:id'], async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const targetUserId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
      res.status(400).json({ error: 'Invalid user ID format.' });
      return;
    }

    // Direct Access-Control Blocking Check (Directive #4, #5)
    if (user._id.toString() !== targetUserId && (await isBlocked(user._id, targetUserId))) {
      res.status(403).json({ error: 'Access denied.' });
      return;
    }

    const targetUser = await User.findById(targetUserId).select(
      '_id name username avatarHue isVerified city bio occupation interests lookingFor createdAt'
    );

    if (!targetUser) {
      res.status(404).json({ error: 'Member not found.' });
      return;
    }

    // Parallel calculation of mutual connections and social stats
    const [
      postsCount,
      followersCount,
      followingCount,
      isFollowingTarget,
      isFollowedByTarget,
      connectionDoc,
      viewerConns,
      targetConns,
    ] = await Promise.all([
      Post.countDocuments({
        authorId: targetUserId,
        isDeleted: false,
        moderationStatus: { $ne: 'hidden' },
      }),
      Follow.countDocuments({ followingId: targetUserId }),
      Follow.countDocuments({ followerId: targetUserId }),
      isFollower(user._id, targetUserId),
      isFollower(targetUserId, user._id),
      Connection.findOne({
        $or: [
          { requesterId: user._id, receiverId: targetUserId },
          { requesterId: targetUserId, receiverId: user._id },
        ],
      }),
      Connection.find({
        $or: [{ requesterId: user._id }, { receiverId: user._id }],
        status: 'accepted',
      }),
      Connection.find({
        $or: [{ requesterId: targetUserId }, { receiverId: targetUserId }],
        status: 'accepted',
      }),
    ]);

    // Calculate mutual connections count
    const viewerFriendIds = new Set(
      viewerConns.map((c) =>
        c.requesterId.toString() === user._id.toString()
          ? c.receiverId.toString()
          : c.requesterId.toString()
      )
    );

    let mutualConnectionsCount = 0;
    for (const tc of targetConns) {
      const friendId =
        tc.requesterId.toString() === targetUserId.toString()
          ? tc.receiverId.toString()
          : tc.requesterId.toString();
      if (friendId !== user._id.toString() && viewerFriendIds.has(friendId)) {
        mutualConnectionsCount++;
      }
    }

    const connectionStatus = connectionDoc ? connectionDoc.status : 'none';
    const isBlockedRelationship = connectionDoc?.status === 'blocked';
    const canMessage = connectionStatus === 'accepted';
    const canMeet = connectionStatus === 'accepted';

    const relationship = {
      isFollowing: isFollowingTarget,
      isFollowedBy: isFollowedByTarget,
      connectionStatus,
      isBlocked: isBlockedRelationship,
      canMessage,
      canMeet,
    };

    res.json({
      _id: targetUser._id.toString(),
      id: targetUser._id.toString(),
      name: targetUser.name,
      username: targetUser.username,
      avatarHue: targetUser.avatarHue,
      isVerified: targetUser.isVerified,
      city: targetUser.city,
      bio: targetUser.bio,
      occupation: targetUser.occupation,
      interests: targetUser.interests,
      lookingFor: targetUser.lookingFor,
      createdAt: targetUser.createdAt,
      user: {
        id: targetUser._id.toString(),
        name: targetUser.name,
        username: targetUser.username,
        avatarHue: targetUser.avatarHue,
        isVerified: targetUser.isVerified,
        city: targetUser.city,
        bio: targetUser.bio,
        occupation: targetUser.occupation,
        interests: targetUser.interests,
        lookingFor: targetUser.lookingFor,
        createdAt: targetUser.createdAt,
      },
      followersCount,
      followingCount,
      postsCount,
      mutualConnectionsCount,
      isFollowing: isFollowingTarget,
      isFollowedBy: isFollowedByTarget,
      connectionStatus,
      isBlocked: isBlockedRelationship,
      canMessage,
      canMeet,
      relationship,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch user profile.' });
  }
});

/**
 * GET /api/users/:id/posts
 * Paginated posts created by target user, respecting viewer's relationship permissions.
 */
router.get('/:id/posts', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const targetUserId = req.params.id;
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);
    const page = Math.max(Number(req.query.page) || 1, 1);

    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
      res.status(400).json({ error: 'Invalid user ID format.' });
      return;
    }

    const isSelf = user._id.toString() === targetUserId;
    const isAdmin = user.role === 'super_admin' || user.role === 'moderator';

    // Block check
    if (!isSelf && !isAdmin && (await isBlocked(user._id, targetUserId))) {
      res.status(403).json({ error: 'Access denied.' });
      return;
    }

    // Determine allowed visibility scopes
    let allowedVisibilities: string[] = ['public'];

    if (isSelf || isAdmin) {
      allowedVisibilities = ['public', 'followers', 'connections', 'private'];
    } else {
      const [following, connected] = await Promise.all([
        isFollower(user._id, targetUserId),
        isConnected(user._id, targetUserId),
      ]);

      if (following) allowedVisibilities.push('followers');
      if (connected) allowedVisibilities.push('connections');
    }

    const posts = await Post.find({
      authorId: targetUserId,
      isDeleted: false,
      moderationStatus: { $ne: 'hidden' },
      visibility: { $in: allowedVisibilities },
    })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('authorId', SAFE_USER_FIELDS);

    const total = await Post.countDocuments({
      authorId: targetUserId,
      isDeleted: false,
      moderationStatus: { $ne: 'hidden' },
      visibility: { $in: allowedVisibilities },
    });

    const postIds = posts.map((p) => p._id);
    const likes = await PostLike.find({ postId: { $in: postIds }, userId: user._id }).select('postId');
    const likedSet = new Set(likes.map((l) => l.postId.toString()));

    res.json({
      posts: posts.map((p) => ({
        id: p._id.toString(),
        author: p.authorId,
        caption: p.caption,
        media: p.media.map((m) => formatMediaDto(m.storageKey, m.mediaType, m)),
        visibility: p.visibility,
        locationName: p.locationName || undefined,
        likeCount: p.likeCount,
        commentCount: p.commentCount,
        isLiked: likedSet.has(p._id.toString()),
        isEdited: p.isEdited,
        editedAt: p.editedAt,
        moderationStatus: p.moderationStatus,
        createdAt: p.createdAt,
      })),
      total,
      page,
      limit,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch user posts.' });
  }
});

export default router;
