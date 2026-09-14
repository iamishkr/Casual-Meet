import { Router, Response } from 'express';
import mongoose from 'mongoose';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import {
  postCreationLimiter,
  commentLimiter,
  likeLimiter,
} from '../middleware/rateLimiter.js';
import { Post, IPost } from '../models/Post.js';
import { PostLike } from '../models/PostLike.js';
import { PostComment } from '../models/PostComment.js';
import { MediaAsset } from '../models/MediaAsset.js';
import { canViewPost, SAFE_USER_FIELDS, formatMediaDto } from '../utils/socialAuth.js';
import { sendNotification } from '../services/notificationService.js';
import commentsRoutes from './comments.routes.js';

const router = Router();

// Require authentication for all post endpoints
router.use(authenticate);

function formatPostDto(post: IPost, isLiked: boolean = false) {
  return {
    id: post._id.toString(),
    author: post.authorId,
    communityId: post.communityId ? post.communityId.toString() : undefined,
    caption: post.caption,
    media: post.media.map((m) => formatMediaDto(m.storageKey, m.mediaType, m)),
    visibility: post.visibility,
    locationName: post.locationName || undefined,
    likeCount: post.likeCount,
    commentCount: post.commentCount,
    isLiked,
    isEdited: post.isEdited,
    editedAt: post.editedAt,
    moderationStatus: post.moderationStatus,
    createdAt: post.createdAt,
  };
}

/**
 * POST /api/posts
 * Create new post with media ownership verification and rate limiting.
 */
router.post('/', postCreationLimiter, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const { caption, media, visibility, locationName } = req.body;

    // Validate caption
    const safeCaption = typeof caption === 'string' ? caption.trim() : '';
    if (safeCaption.length > 2200) {
      res.status(400).json({ error: 'Caption exceeds 2,200 character limit.' });
      return;
    }

    // Validate visibility
    const allowedVisibility = ['public', 'followers', 'connections', 'private'];
    const safeVisibility = allowedVisibility.includes(visibility) ? visibility : 'public';

    // Validate coarse location (never coordinates)
    const safeLocation = typeof locationName === 'string' ? locationName.trim().slice(0, 100) : undefined;

    // Validate and verify media ownership
    const verifiedMedia: any[] = [];
    const mediaAssetIdsToUpdate: mongoose.Types.ObjectId[] = [];

    if (Array.isArray(media) && media.length > 0) {
      if (media.length > 10) {
        res.status(400).json({ error: 'A maximum of 10 media items can be attached to a post.' });
        return;
      }

      for (const item of media) {
        if (!item || !item.storageKey) {
          res.status(400).json({ error: 'Each media item must have a valid storageKey.' });
          return;
        }

        const asset = await MediaAsset.findOne({ storageKey: item.storageKey });
        if (!asset) {
          res.status(404).json({ error: `Media asset ${item.storageKey} not found.` });
          return;
        }

        // Strict ownership check: caller must own the media asset
        if (asset.uploaderId.toString() !== user._id.toString()) {
          res.status(403).json({ error: 'Unauthorized. You cannot attach media uploaded by another user.' });
          return;
        }

        // Prevent reattaching already attached media to another post
        if (asset.isAttached) {
          res.status(400).json({ error: `Media asset ${item.storageKey} is already attached to content.` });
          return;
        }

        verifiedMedia.push({
          url: `/api/media/file/${asset.storageKey}`,
          storageKey: asset.storageKey,
          mediaType: asset.mediaType,
          width: item.width || asset.width,
          height: item.height || asset.height,
          duration: item.duration || asset.duration,
          thumbnail: item.thumbnail,
        });

        mediaAssetIdsToUpdate.push(asset._id as mongoose.Types.ObjectId);
      }
    }

    // Content requirement: must have either text or media
    if (!safeCaption && verifiedMedia.length === 0) {
      res.status(400).json({ error: 'Post must contain either text caption or media.' });
      return;
    }

    // Create Post with strict JWT-derived authorId
    const post = await Post.create({
      authorId: user._id,
      caption: safeCaption,
      media: verifiedMedia,
      visibility: safeVisibility,
      locationName: safeLocation,
      likeCount: 0,
      commentCount: 0,
      isDeleted: false,
      moderationStatus: 'visible',
    });

    // Mark media assets as attached to this post
    if (mediaAssetIdsToUpdate.length > 0) {
      await MediaAsset.updateMany(
        { _id: { $in: mediaAssetIdsToUpdate } },
        { $set: { isAttached: true, attachedToType: 'post', attachedToId: post._id } }
      );
    }

    await post.populate('authorId', SAFE_USER_FIELDS);
    res.status(201).json(formatPostDto(post, false));
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to create post.' });
  }
});

// Mount comments sub-router before /:id parameterized routes
router.use('/comments', commentsRoutes);

/**
 * GET /api/posts/:id
 * Retrieve single post with privacy, block, and moderation authorization.
 */
router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid post ID format.' });
      return;
    }

    const post = await Post.findById(id).populate('authorId', SAFE_USER_FIELDS);
    if (!post) {
      res.status(404).json({ error: 'Post not found.' });
      return;
    }

    const authCheck = await canViewPost(post, user._id, user.role);
    if (!authCheck.allowed) {
      res.status(authCheck.status).json({ error: authCheck.reason || 'Access denied.' });
      return;
    }

    const like = await PostLike.findOne({ postId: post._id, userId: user._id });
    res.json(formatPostDto(post, Boolean(like)));
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to retrieve post.' });
  }
});

/**
 * PATCH /api/posts/:id
 * Author-only update with strict mass-assignment protection.
 */
router.patch('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid post ID format.' });
      return;
    }

    const post = await Post.findById(id);
    if (!post || post.isDeleted) {
      res.status(404).json({ error: 'Post not found or deleted.' });
      return;
    }

    // Strict ownership enforcement
    if (post.authorId.toString() !== user._id.toString()) {
      res.status(403).json({ error: 'Access denied. You can only edit your own posts.' });
      return;
    }

    // Mass-assignment defense: Whitelist allowed fields ONLY
    const { caption, visibility } = req.body;

    if (caption !== undefined) {
      if (typeof caption !== 'string' || caption.length > 2200) {
        res.status(400).json({ error: 'Caption must be a string up to 2,200 characters.' });
        return;
      }
      post.caption = caption.trim();
    }

    if (visibility !== undefined) {
      const allowed = ['public', 'followers', 'connections', 'private'];
      if (!allowed.includes(visibility)) {
        res.status(400).json({ error: 'Invalid visibility value.' });
        return;
      }
      post.visibility = visibility;
    }

    post.isEdited = true;
    post.editedAt = new Date();
    await post.save();

    await post.populate('authorId', SAFE_USER_FIELDS);
    const like = await PostLike.findOne({ postId: post._id, userId: user._id });

    res.json(formatPostDto(post, Boolean(like)));
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update post.' });
  }
});

/**
 * DELETE /api/posts/:id
 * Soft-delete post by author or moderator/admin.
 */
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid post ID format.' });
      return;
    }

    const post = await Post.findById(id);
    if (!post || post.isDeleted) {
      res.status(404).json({ error: 'Post not found or already deleted.' });
      return;
    }

    const isAuthor = post.authorId.toString() === user._id.toString();
    const isAdmin = user.role === 'super_admin' || user.role === 'moderator';

    if (!isAuthor && !isAdmin) {
      res.status(403).json({ error: 'Access denied. You cannot delete this post.' });
      return;
    }

    post.isDeleted = true;
    post.deletedAt = new Date();
    await post.save();

    res.json({ success: true, message: 'Post deleted successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to delete post.' });
  }
});

/**
 * POST /api/posts/:id/like
 * Idempotent like creation with atomic counter increment.
 */
router.post('/:id/like', likeLimiter, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid post ID format.' });
      return;
    }

    const post = await Post.findById(id);
    if (!post || post.isDeleted) {
      res.status(404).json({ error: 'Post not found or deleted.' });
      return;
    }

    const authCheck = await canViewPost(post, user._id, user.role);
    if (!authCheck.allowed) {
      res.status(authCheck.status).json({ error: authCheck.reason || 'Access denied.' });
      return;
    }

    let newlyCreated = false;
    try {
      await PostLike.create({ postId: post._id, userId: user._id });
      newlyCreated = true;
      // Increment counter ONLY upon successful new like creation
      await Post.updateOne({ _id: post._id }, { $inc: { likeCount: 1 } });
    } catch (err: any) {
      if (err.code === 11000) {
        // Already liked: do not increment counter
        newlyCreated = false;
      } else {
        throw err;
      }
    }

    const updatedPost = await Post.findById(post._id).select('likeCount');

    // Notify author if newly created and not self-like
    if (newlyCreated && post.authorId.toString() !== user._id.toString()) {
      await sendNotification({
        recipientId: post.authorId,
        actor: user,
        type: 'post_liked',
        title: 'New Like',
        message: `${user.name} liked your post.`,
        targetType: 'post',
        targetId: post._id,
      });
    }

    res.json({
      success: true,
      liked: true,
      likeCount: updatedPost ? updatedPost.likeCount : post.likeCount,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to like post.' });
  }
});

/**
 * DELETE /api/posts/:id/like
 * Idempotent unlike with safe non-negative counter decrement.
 */
router.delete('/:id/like', likeLimiter, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid post ID format.' });
      return;
    }

    const post = await Post.findById(id);
    if (!post || post.isDeleted) {
      res.status(404).json({ error: 'Post not found or deleted.' });
      return;
    }

    const deleteResult = await PostLike.deleteOne({ postId: post._id, userId: user._id });

    // Decrement counter ONLY if a like document was actually removed, guarded against negative
    if (deleteResult.deletedCount > 0) {
      await Post.updateOne(
        { _id: post._id, likeCount: { $gt: 0 } },
        { $inc: { likeCount: -1 } }
      );
    }

    const updatedPost = await Post.findById(post._id).select('likeCount');

    res.json({
      success: true,
      liked: false,
      likeCount: updatedPost ? updatedPost.likeCount : 0,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to unlike post.' });
  }
});

/**
 * GET /api/posts/:id/likes
 * Paginated list of users who liked the post.
 */
router.get('/:id/likes', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);
    const page = Math.max(Number(req.query.page) || 1, 1);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid post ID format.' });
      return;
    }

    const post = await Post.findById(id);
    if (!post || post.isDeleted) {
      res.status(404).json({ error: 'Post not found.' });
      return;
    }

    const authCheck = await canViewPost(post, user._id, user.role);
    if (!authCheck.allowed) {
      res.status(authCheck.status).json({ error: authCheck.reason || 'Access denied.' });
      return;
    }

    const likes = await PostLike.find({ postId: post._id })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('userId', SAFE_USER_FIELDS);

    res.json({
      likes: likes.map((l) => ({
        user: l.userId,
        likedAt: l.createdAt,
      })),
      page,
      limit,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch likes.' });
  }
});

/**
 * POST /api/posts/:id/comments
 * Add comment with atomic commentCount increment and rate limiting.
 */
router.post('/:id/comments', commentLimiter, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const { text } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid post ID format.' });
      return;
    }

    if (!text || typeof text !== 'string' || !text.trim()) {
      res.status(400).json({ error: 'Comment text is required.' });
      return;
    }

    const safeText = text.trim();
    if (safeText.length > 1000) {
      res.status(400).json({ error: 'Comment cannot exceed 1,000 characters.' });
      return;
    }

    const post = await Post.findById(id);
    if (!post || post.isDeleted) {
      res.status(404).json({ error: 'Post not found or deleted.' });
      return;
    }

    const authCheck = await canViewPost(post, user._id, user.role);
    if (!authCheck.allowed) {
      res.status(authCheck.status).json({ error: authCheck.reason || 'Access denied.' });
      return;
    }

    const comment = await PostComment.create({
      postId: post._id,
      authorId: user._id,
      text: safeText,
      isDeleted: false,
      moderationStatus: 'visible',
    });

    // Atomic increment of comment count
    await Post.updateOne({ _id: post._id }, { $inc: { commentCount: 1 } });

    await comment.populate('authorId', SAFE_USER_FIELDS);

    // Notify author if not self-comment
    if (post.authorId.toString() !== user._id.toString()) {
      await sendNotification({
        recipientId: post.authorId,
        actor: user,
        type: 'post_commented',
        title: 'New Comment',
        message: `${user.name} commented on your post: "${safeText.slice(0, 40)}${safeText.length > 40 ? '...' : ''}"`,
        targetType: 'post',
        targetId: post._id,
      });
    }

    res.status(201).json({
      id: comment._id,
      postId: comment.postId,
      author: comment.authorId,
      text: comment.text,
      isEdited: comment.isEdited,
      createdAt: comment.createdAt,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to add comment.' });
  }
});

/**
 * GET /api/posts/:id/comments
 * Paginated comments for post.
 */
router.get('/:id/comments', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);
    const page = Math.max(Number(req.query.page) || 1, 1);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid post ID format.' });
      return;
    }

    const post = await Post.findById(id);
    if (!post || post.isDeleted) {
      res.status(404).json({ error: 'Post not found.' });
      return;
    }

    const authCheck = await canViewPost(post, user._id, user.role);
    if (!authCheck.allowed) {
      res.status(authCheck.status).json({ error: authCheck.reason || 'Access denied.' });
      return;
    }

    const comments = await PostComment.find({
      postId: post._id,
      isDeleted: false,
      moderationStatus: { $ne: 'hidden' },
    })
      .sort({ createdAt: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('authorId', SAFE_USER_FIELDS);

    const total = await PostComment.countDocuments({
      postId: post._id,
      isDeleted: false,
      moderationStatus: { $ne: 'hidden' },
    });

    res.json({
      comments: comments.map((c) => ({
        id: c._id,
        postId: c.postId,
        author: c.authorId,
        text: c.text,
        isEdited: c.isEdited,
        editedAt: c.editedAt,
        createdAt: c.createdAt,
      })),
      total,
      page,
      limit,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch comments.' });
  }
});

export default router;

