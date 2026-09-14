import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { mediaUploadLimiter } from '../middleware/rateLimiter.js';
import { mediaStorage, isSafeStorageKey } from '../services/mediaStorage.js';
import { MediaAsset } from '../models/MediaAsset.js';
import { Post } from '../models/Post.js';
import { Story } from '../models/Story.js';
import { User, IUser } from '../models/User.js';
import { canViewPost, canViewStory } from '../utils/socialAuth.js';
import { getJwtSecret } from '../config/jwt.js';

const router = Router();

/**
 * Helper to optionally authenticate a user from Authorization header or query parameter.
 * Used by GET /file/:storageKey so browser <img src> / <video src> or fetch can authenticate.
 */
async function resolveViewer(req: Request): Promise<IUser | null> {
  const authHeader = req.headers.authorization;
  let token: string | undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.query.token && typeof req.query.token === 'string') {
    token = req.query.token;
  }

  if (!token) return null;

  try {
    const payload = jwt.verify(token, getJwtSecret()) as { userId: string };
    const user = await User.findById(payload.userId);
    return user || null;
  } catch {
    return null;
  }
}

/**
 * POST /api/media/upload
 * Authenticated upload endpoint.
 * Associates upload strictly with req.user._id.
 */
router.post('/upload', authenticate, mediaUploadLimiter, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const { fileBase64, filename } = req.body;

    if (!fileBase64 || typeof fileBase64 !== 'string') {
      res.status(400).json({ error: 'fileBase64 is required (base64 string or data URL).' });
      return;
    }

    const safeFilename = typeof filename === 'string' && filename.trim() ? filename.trim() : 'media_upload';

    // Strip optional data URL prefix (e.g. data:image/jpeg;base64,...)
    const base64Data = fileBase64.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    if (buffer.length === 0) {
      res.status(400).json({ error: 'Decoded media buffer is empty.' });
      return;
    }

    // Save and validate via storage provider (magic byte check)
    const saved = await mediaStorage.save(buffer, safeFilename);

    // Persist ownership record in MediaAsset
    const mediaAsset = await MediaAsset.create({
      uploaderId: user._id,
      storageKey: saved.storageKey,
      originalFilename: safeFilename,
      mimeType: saved.mimeType,
      mediaType: saved.mediaType,
      sizeBytes: saved.sizeBytes,
      isAttached: false,
    });

    res.status(201).json({
      storageKey: mediaAsset.storageKey,
      url: `/api/media/file/${mediaAsset.storageKey}`,
      mediaType: mediaAsset.mediaType,
      mimeType: mediaAsset.mimeType,
      sizeBytes: mediaAsset.sizeBytes,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Media upload failed.' });
  }
});

/**
 * GET /api/media/file/:storageKey
 * Authorization-Aware Media Gateway.
 * Strictly prevents direct filesystem access or bypassing parent Post/Story privacy.
 */
router.get('/file/:storageKey', async (req: Request, res: Response): Promise<void> => {
  try {
    const { storageKey } = req.params;

    if (!isSafeStorageKey(storageKey)) {
      res.status(400).json({ error: 'Invalid or malformed media storage key.' });
      return;
    }

    const asset = await MediaAsset.findOne({ storageKey });
    if (!asset) {
      res.status(404).json({ error: 'Media asset not found.' });
      return;
    }

    const filePath = mediaStorage.getFilePath(storageKey);
    if (!filePath) {
      res.status(404).json({ error: 'Media file does not exist on disk.' });
      return;
    }

    // Resolve caller identity (header or token param)
    const viewer = await resolveViewer(req);

    // 1. Unattached media: only uploader or admin can access
    if (!asset.isAttached) {
      if (!viewer) {
        res.status(401).json({ error: 'Authentication required for unattached media.' });
        return;
      }
      const isOwner = asset.uploaderId.toString() === viewer._id.toString();
      const isAdmin = viewer.role === 'super_admin' || viewer.role === 'moderator';
      if (!isOwner && !isAdmin) {
        res.status(403).json({ error: 'Access denied. You do not own this media.' });
        return;
      }
    } else if (asset.attachedToType === 'post' && asset.attachedToId) {
      // 2. Attached to a Post: evaluate parent Post authorization
      const post = await Post.findById(asset.attachedToId);
      if (!post) {
        res.status(404).json({ error: 'Parent post not found.' });
        return;
      }

      // Public Media Policy: genuinely public, non-deleted, unhidden posts can be accessed without auth
      if (post.visibility === 'public' && !post.isDeleted && post.moderationStatus !== 'hidden') {
        if (viewer) {
          const authCheck = await canViewPost(post, viewer._id, viewer.role);
          if (!authCheck.allowed) {
            res.status(authCheck.status).json({ error: authCheck.reason || 'Access denied.' });
            return;
          }
        }
        // Genuinely public post: unauthenticated access allowed
      } else {
        // Restricted Post (followers, connections, private, hidden, or deleted)
        if (!viewer) {
          res.status(401).json({ error: 'Authentication required to access restricted media.' });
          return;
        }
        const authCheck = await canViewPost(post, viewer._id, viewer.role);
        if (!authCheck.allowed) {
          res.status(authCheck.status).json({ error: authCheck.reason || 'Access denied to restricted media.' });
          return;
        }
      }
    } else if (asset.attachedToType === 'story' && asset.attachedToId) {
      // 3. Attached to a Story: evaluate parent Story authorization
      const story = await Story.findById(asset.attachedToId);
      if (!story) {
        res.status(404).json({ error: 'Parent story not found.' });
        return;
      }

      const isExpired = new Date() > new Date(story.expiresAt);

      if (story.visibility === 'public' && !story.isDeleted && story.moderationStatus !== 'hidden' && !isExpired) {
        if (viewer) {
          const authCheck = await canViewStory(story, viewer._id, viewer.role);
          if (!authCheck.allowed) {
            res.status(authCheck.status).json({ error: authCheck.reason || 'Access denied.' });
            return;
          }
        }
        // Genuinely public, active story: unauthenticated access allowed
      } else {
        if (!viewer) {
          res.status(401).json({ error: 'Authentication required to access restricted story media.' });
          return;
        }
        const authCheck = await canViewStory(story, viewer._id, viewer.role);
        if (!authCheck.allowed) {
          res.status(authCheck.status).json({ error: authCheck.reason || 'Access denied to story media.' });
          return;
        }
      }
    }


    // Authorized: stream file with security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Type', asset.mimeType);
    res.sendFile(filePath);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to serve media.' });
  }
});

export default router;
