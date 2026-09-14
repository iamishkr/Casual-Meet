import { Router, Response } from 'express';
import mongoose from 'mongoose';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { storyCreationLimiter } from '../middleware/rateLimiter.js';
import { Story, IStory } from '../models/Story.js';
import { StoryView } from '../models/StoryView.js';
import { MediaAsset } from '../models/MediaAsset.js';
import { Follow } from '../models/Follow.js';
import { Connection } from '../models/Connection.js';
import { Suspension } from '../models/Suspension.js';
import {
  canViewStory,
  getBlockedUserIds,
  SAFE_USER_FIELDS,
  formatMediaDto,
} from '../utils/socialAuth.js';

const router = Router();

router.use(authenticate);

function formatStoryDto(story: IStory) {
  return {
    id: story._id.toString(),
    author: story.authorId,
    media: formatMediaDto(story.media.storageKey, story.media.mediaType, story.media),
    caption: story.caption || undefined,
    visibility: story.visibility,
    expiresAt: story.expiresAt,
    createdAt: story.createdAt,
  };
}

/**
 * POST /api/stories
 * Create ephemeral 24-hour social story with media ownership validation.
 */
router.post('/', storyCreationLimiter, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const { media, caption, visibility } = req.body;

    if (!media || !media.storageKey) {
      res.status(400).json({ error: 'Valid media object with storageKey is required for stories.' });
      return;
    }

    const asset = await MediaAsset.findOne({ storageKey: media.storageKey });
    if (!asset) {
      res.status(404).json({ error: 'Media asset not found.' });
      return;
    }

    // Strict ownership verification
    if (asset.uploaderId.toString() !== user._id.toString()) {
      res.status(403).json({ error: 'Unauthorized. You cannot attach media uploaded by another user.' });
      return;
    }

    if (asset.isAttached) {
      res.status(400).json({ error: 'Media asset is already attached to existing content.' });
      return;
    }

    const allowedVisibility = ['public', 'followers', 'connections'];
    const safeVisibility = allowedVisibility.includes(visibility) ? visibility : 'followers';
    const safeCaption = typeof caption === 'string' ? caption.trim().slice(0, 500) : undefined;

    // Ephemeral lifespan: strictly 24 hours from creation
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const story = await Story.create({
      authorId: user._id,
      media: {
        url: `/api/media/file/${asset.storageKey}`,
        storageKey: asset.storageKey,
        mediaType: asset.mediaType,
        duration: media.duration || asset.duration,
      },
      caption: safeCaption,
      visibility: safeVisibility,
      expiresAt,
      isDeleted: false,
      moderationStatus: 'visible',
    });

    // Mark media as attached
    asset.isAttached = true;
    asset.attachedToType = 'story';
    asset.attachedToId = story._id as mongoose.Types.ObjectId;
    await asset.save();

    await story.populate('authorId', SAFE_USER_FIELDS);
    res.status(201).json(formatStoryDto(story));
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to create story.' });
  }
});

/**
 * GET /api/stories
 * Retrieve all active (unexpired) stories grouped by user.
 * Application-level expiration filter ensures real-time accuracy beyond MongoDB TTL cleanup.
 */
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const now = new Date();

    // 1. Gather excluded users: Suspended accounts
    const activeSuspensions = await Suspension.find({
      isActive: true,
      $or: [{ expiresAt: { $exists: false } }, { expiresAt: { $gt: now } }],
    }).select('userId');
    const suspendedUserIds = activeSuspensions.map((s) => s.userId);

    // 2. Gather excluded users: Blocked accounts
    const blockedUserIds = await getBlockedUserIds(user._id);

    const excludedIds = [
      ...suspendedUserIds.map((id) => id.toString()),
      ...blockedUserIds.map((id) => id.toString()),
    ];

    // 3. Gather relationships
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

    // Query active stories only
    const stories = await Story.find({
      authorId: { $nin: excludedIds },
      isDeleted: false,
      moderationStatus: { $ne: 'hidden' },
      expiresAt: { $gt: now }, // Application-level expiration check
      $or: [
        { visibility: 'public' },
        { authorId: user._id },
        { visibility: 'followers', authorId: { $in: followedIds } },
        { visibility: 'connections', authorId: { $in: connectedIds } },
      ],
    })
      .sort({ createdAt: 1 })
      .populate('authorId', SAFE_USER_FIELDS);

    // Group stories by author
    const groupedMap = new Map<string, { user: any; stories: any[] }>();

    for (const s of stories) {
      const author = s.authorId as any;
      const authorIdStr = author._id.toString();

      if (!groupedMap.has(authorIdStr)) {
        groupedMap.set(authorIdStr, { user: author, stories: [] });
      }

      groupedMap.get(authorIdStr)!.stories.push({
        id: s._id.toString(),
        media: formatMediaDto(s.media.storageKey, s.media.mediaType, s.media),
        caption: s.caption || undefined,
        visibility: s.visibility,
        expiresAt: s.expiresAt,
        createdAt: s.createdAt,
      });
    }

    res.json(Array.from(groupedMap.values()));
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch stories.' });
  }
});

/**
 * GET /api/stories/:id
 * Retrieve single story.
 */
router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid story ID format.' });
      return;
    }

    const story = await Story.findById(id).populate('authorId', SAFE_USER_FIELDS);
    if (!story) {
      res.status(404).json({ error: 'Story not found.' });
      return;
    }

    const authCheck = await canViewStory(story, user._id, user.role);
    if (!authCheck.allowed) {
      res.status(authCheck.status).json({ error: authCheck.reason || 'Access denied.' });
      return;
    }

    res.json(formatStoryDto(story));
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch story.' });
  }
});

/**
 * POST /api/stories/:id/view
 * Record idempotent story view for author's analytics.
 * Safeguard #7: Does NOT flood recipient with notifications.
 */
router.post('/:id/view', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid story ID format.' });
      return;
    }

    const story = await Story.findById(id);
    if (!story || story.isDeleted || new Date() > new Date(story.expiresAt)) {
      res.status(404).json({ error: 'Story not found or expired.' });
      return;
    }

    // Do not record views for the story creator themselves
    if (story.authorId.toString() !== user._id.toString()) {
      try {
        await StoryView.create({
          storyId: story._id,
          viewerId: user._id,
        });
      } catch (err: any) {
        if (err.code !== 11000) {
          throw err;
        }
        // Duplicate view ignored idempotently
      }
    }

    res.json({ success: true, viewed: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to record story view.' });
  }
});

/**
 * GET /api/stories/:id/views
 * Owner-only view list.
 */
router.get('/:id/views', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid story ID format.' });
      return;
    }

    const story = await Story.findById(id);
    if (!story) {
      res.status(404).json({ error: 'Story not found.' });
      return;
    }

    const isOwner = story.authorId.toString() === user._id.toString();
    const isAdmin = user.role === 'super_admin' || user.role === 'moderator';

    if (!isOwner && !isAdmin) {
      res.status(403).json({ error: 'Access denied. Only the story owner can view analytics.' });
      return;
    }

    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
    const page = Math.max(Number(req.query.page) || 1, 1);

    const [views, totalViews] = await Promise.all([
      StoryView.find({ storyId: story._id })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('viewerId', SAFE_USER_FIELDS),
      StoryView.countDocuments({ storyId: story._id }),
    ]);

    res.json({
      storyId: story._id,
      totalViews,
      views: views.map((v) => ({
        viewer: v.viewerId,
        viewedAt: v.createdAt,
      })),
      page,
      limit,
    });

  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch story views.' });
  }
});

/**
 * DELETE /api/stories/:id
 * Delete story by owner or admin.
 */
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid story ID format.' });
      return;
    }

    const story = await Story.findById(id);
    if (!story || story.isDeleted) {
      res.status(404).json({ error: 'Story not found or already deleted.' });
      return;
    }

    const isOwner = story.authorId.toString() === user._id.toString();
    const isAdmin = user.role === 'super_admin' || user.role === 'moderator';

    if (!isOwner && !isAdmin) {
      res.status(403).json({ error: 'Access denied. You cannot delete this story.' });
      return;
    }

    story.isDeleted = true;
    story.deletedAt = new Date();
    await story.save();

    res.json({ success: true, message: 'Story deleted successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to delete story.' });
  }
});

export default router;
