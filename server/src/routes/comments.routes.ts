import { Router, Response } from 'express';
import mongoose from 'mongoose';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { PostComment } from '../models/PostComment.js';
import { Post } from '../models/Post.js';
import { SAFE_USER_FIELDS } from '../utils/socialAuth.js';

const router = Router();

router.use(authenticate);

/**
 * PATCH /api/comments/:id
 * Author-only comment editing.
 */
router.patch('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const { text } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid comment ID format.' });
      return;
    }

    if (!text || typeof text !== 'string' || !text.trim()) {
      res.status(400).json({ error: 'Comment text cannot be empty.' });
      return;
    }

    const comment = await PostComment.findById(id);
    if (!comment || comment.isDeleted) {
      res.status(404).json({ error: 'Comment not found or deleted.' });
      return;
    }

    if (comment.authorId.toString() !== user._id.toString()) {
      res.status(403).json({ error: 'Access denied. You can only edit your own comments.' });
      return;
    }

    comment.text = text.trim().slice(0, 1000);
    comment.isEdited = true;
    comment.editedAt = new Date();
    await comment.save();

    await comment.populate('authorId', SAFE_USER_FIELDS);

    res.json({
      id: comment._id,
      postId: comment.postId,
      author: comment.authorId,
      text: comment.text,
      isEdited: comment.isEdited,
      editedAt: comment.editedAt,
      updatedAt: comment.updatedAt,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to edit comment.' });
  }
});

/**
 * DELETE /api/comments/:id
 * Comment author, Post author, or Moderator/Admin can delete comments.
 * Atomic commentCount decrement with duplicate decrement protection.
 */
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid comment ID format.' });
      return;
    }

    const comment = await PostComment.findById(id);
    if (!comment || comment.isDeleted) {
      res.status(404).json({ error: 'Comment not found or already deleted.' });
      return;
    }

    const post = await Post.findById(comment.postId);
    const isCommentAuthor = comment.authorId.toString() === user._id.toString();
    const isPostAuthor = post ? post.authorId.toString() === user._id.toString() : false;
    const isAdmin = user.role === 'super_admin' || user.role === 'moderator';

    if (!isCommentAuthor && !isPostAuthor && !isAdmin) {
      res.status(403).json({ error: 'Access denied. You cannot delete this comment.' });
      return;
    }

    comment.isDeleted = true;
    comment.deletedAt = new Date();
    await comment.save();

    // Atomically decrement comment count on post (guarded against negative values)
    await Post.updateOne(
      { _id: comment.postId, commentCount: { $gt: 0 } },
      { $inc: { commentCount: -1 } }
    );

    res.json({ success: true, message: 'Comment deleted successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to delete comment.' });
  }
});

export default router;
