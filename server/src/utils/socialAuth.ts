import mongoose from 'mongoose';
import { Connection } from '../models/Connection.js';
import { Follow } from '../models/Follow.js';
import { IPost } from '../models/Post.js';
import { IStory } from '../models/Story.js';
import { Community } from '../models/Community.js';
import { CommunityMember, ICommunityMember } from '../models/CommunityMember.js';

export const SAFE_USER_FIELDS = 'name username avatarHue isVerified city bio occupation';

/**
 * Returns all user IDs who either blocked or were blocked by the specified user.
 */
export async function getBlockedUserIds(userId: mongoose.Types.ObjectId | string): Promise<mongoose.Types.ObjectId[]> {
  const uid = new mongoose.Types.ObjectId(userId.toString());
  const blockedConnections = await Connection.find({
    $or: [{ requesterId: uid }, { receiverId: uid }],
    status: 'blocked',
  }).select('requesterId receiverId');

  return blockedConnections.map((c) =>
    c.requesterId.toString() === uid.toString() ? c.receiverId : c.requesterId
  );
}

/**
 * Checks if userA and userB have a blocked relationship in either direction.
 */
export async function isBlocked(
  userA: mongoose.Types.ObjectId | string,
  userB: mongoose.Types.ObjectId | string
): Promise<boolean> {
  const uidA = new mongoose.Types.ObjectId(userA.toString());
  const uidB = new mongoose.Types.ObjectId(userB.toString());

  const blockDoc = await Connection.findOne({
    $or: [
      { requesterId: uidA, receiverId: uidB },
      { requesterId: uidB, receiverId: uidA },
    ],
    status: 'blocked',
  });

  return Boolean(blockDoc);
}

/**
 * Checks if userA follows userB (one-way relationship).
 */
export async function isFollower(
  followerId: mongoose.Types.ObjectId | string,
  followingId: mongoose.Types.ObjectId | string
): Promise<boolean> {
  const fId = new mongoose.Types.ObjectId(followerId.toString());
  const targetId = new mongoose.Types.ObjectId(followingId.toString());

  const followDoc = await Follow.findOne({ followerId: fId, followingId: targetId });
  return Boolean(followDoc);
}

/**
 * Checks if userA and userB have an accepted mutual connection.
 */
export async function isConnected(
  userA: mongoose.Types.ObjectId | string,
  userB: mongoose.Types.ObjectId | string
): Promise<boolean> {
  const uidA = new mongoose.Types.ObjectId(userA.toString());
  const uidB = new mongoose.Types.ObjectId(userB.toString());

  const connDoc = await Connection.findOne({
    $or: [
      { requesterId: uidA, receiverId: uidB },
      { requesterId: uidB, receiverId: uidA },
    ],
    status: 'accepted',
  });

  return Boolean(connDoc);
}

/**
 * Checks if a user is an active member (or admin/owner) of a community.
 */
export async function isCommunityMember(
  communityId: mongoose.Types.ObjectId | string,
  userId: mongoose.Types.ObjectId | string
): Promise<boolean> {
  const cId = new mongoose.Types.ObjectId(communityId.toString());
  const uId = new mongoose.Types.ObjectId(userId.toString());

  const membership = await CommunityMember.findOne({
    communityId: cId,
    userId: uId,
    status: 'active',
  });

  return Boolean(membership);
}

/**
 * Retrieves the full membership document for a user in a community.
 */
export async function getCommunityMembership(
  communityId: mongoose.Types.ObjectId | string,
  userId: mongoose.Types.ObjectId | string
): Promise<ICommunityMember | null> {
  const cId = new mongoose.Types.ObjectId(communityId.toString());
  const uId = new mongoose.Types.ObjectId(userId.toString());

  return CommunityMember.findOne({ communityId: cId, userId: uId });
}

export function extractId(docOrId: any): mongoose.Types.ObjectId {
  if (!docOrId) return new mongoose.Types.ObjectId();
  if (docOrId._id) return new mongoose.Types.ObjectId(docOrId._id.toString());
  return new mongoose.Types.ObjectId(docOrId.toString());
}

/**
 * Evaluates whether a viewer can access a specific post.
 * Respects deleted state, moderation status, block relationships, parent community privacy, and post visibility.
 */
export async function canViewPost(
  post: IPost,
  viewerId?: mongoose.Types.ObjectId | string,
  viewerRole?: string
): Promise<{ allowed: boolean; status: number; reason?: string }> {
  const isAdmin = viewerRole === 'super_admin' || viewerRole === 'moderator';

  // 1. Soft-deleted content
  if (post.isDeleted && !isAdmin) {
    return { allowed: false, status: 404, reason: 'Post not found or has been deleted.' };
  }

  const authorId = extractId(post.authorId);
  const authorIdStr = authorId.toString();

  // 2. Moderation hidden content
  if (post.moderationStatus === 'hidden' && !isAdmin) {
    const isOwner = viewerId && authorIdStr === viewerId.toString();
    if (!isOwner) {
      return { allowed: false, status: 404, reason: 'Post is currently unavailable due to safety review.' };
    }
  }

  // 3. Mandatory Parent Community Authorization Gate (Directive Section 5 & 9)
  if (post.communityId) {
    const community = await Community.findById(post.communityId);
    if (!community || (community.status === 'suspended' && !isAdmin)) {
      return { allowed: false, status: 404, reason: 'Community not found or suspended.' };
    }

    if (community.privacy === 'private') {
      if (!viewerId) {
        return { allowed: false, status: 401, reason: 'Authentication required to view private community content.' };
      }
      const isMember = await isCommunityMember(community._id, viewerId);
      if (!isMember && !isAdmin) {
        return { allowed: false, status: 403, reason: 'This post is restricted to active community members only.' };
      }
    }
  }

  // 4. Unauthenticated requests
  if (!viewerId) {
    if (post.visibility === 'public') {
      return { allowed: true, status: 200 };
    }
    return { allowed: false, status: 401, reason: 'Authentication required to view this content.' };
  }

  const vIdStr = viewerId.toString();

  // Author and admin always have access
  if (vIdStr === authorIdStr || isAdmin) {
    return { allowed: true, status: 200 };
  }

  // 5. Block check (bidirectional)
  const blocked = await isBlocked(authorId, viewerId);
  if (blocked) {
    return { allowed: false, status: 403, reason: 'Access denied.' };
  }

  // 6. Visibility permission check
  switch (post.visibility) {
    case 'public':
      return { allowed: true, status: 200 };

    case 'followers': {
      const following = await isFollower(viewerId, authorId);
      if (following) return { allowed: true, status: 200 };
      return { allowed: false, status: 403, reason: 'This post is restricted to followers only.' };
    }

    case 'connections': {
      const connected = await isConnected(viewerId, authorId);
      if (connected) return { allowed: true, status: 200 };
      return { allowed: false, status: 403, reason: 'This post is restricted to mutual connections only.' };
    }

    case 'private':
      return { allowed: false, status: 403, reason: 'This post is private.' };

    default:
      return { allowed: false, status: 403, reason: 'Access restricted.' };
  }
}

/**
 * Evaluates whether a viewer can access a specific story.
 * Respects 24h expiration, deleted state, moderation status, blocks, and visibility.
 */
export async function canViewStory(
  story: IStory,
  viewerId?: mongoose.Types.ObjectId | string,
  viewerRole?: string
): Promise<{ allowed: boolean; status: number; reason?: string }> {
  const isAdmin = viewerRole === 'super_admin' || viewerRole === 'moderator';

  // 1. Expiration check (24 hours)
  if (new Date() > new Date(story.expiresAt) && !isAdmin) {
    return { allowed: false, status: 404, reason: 'Story has expired.' };
  }

  // 2. Soft-deleted check
  if (story.isDeleted && !isAdmin) {
    return { allowed: false, status: 404, reason: 'Story not found or deleted.' };
  }

  const authorId = extractId(story.authorId);
  const authorIdStr = authorId.toString();

  // 3. Moderation hidden check
  if (story.moderationStatus === 'hidden' && !isAdmin) {
    const isOwner = viewerId && authorIdStr === viewerId.toString();
    if (!isOwner) {
      return { allowed: false, status: 404, reason: 'Story unavailable.' };
    }
  }

  // 4. Unauthenticated requests
  if (!viewerId) {
    if (story.visibility === 'public') {
      return { allowed: true, status: 200 };
    }
    return { allowed: false, status: 401, reason: 'Authentication required.' };
  }

  const vIdStr = viewerId.toString();

  // Author and admin always have access
  if (vIdStr === authorIdStr || isAdmin) {
    return { allowed: true, status: 200 };
  }

  // 5. Block check
  const blocked = await isBlocked(authorId, viewerId);
  if (blocked) {
    return { allowed: false, status: 403, reason: 'Access denied.' };
  }

  // 6. Visibility check
  switch (story.visibility) {
    case 'public':
      return { allowed: true, status: 200 };

    case 'followers': {
      const following = await isFollower(viewerId, authorId);
      if (following) return { allowed: true, status: 200 };
      return { allowed: false, status: 403, reason: 'Story is restricted to followers.' };
    }

    case 'connections': {
      const connected = await isConnected(viewerId, authorId);
      if (connected) return { allowed: true, status: 200 };
      return { allowed: false, status: 403, reason: 'Story is restricted to connections.' };
    }

    default:
      return { allowed: false, status: 403, reason: 'Access denied.' };
  }
}

/**
 * Returns safe secure media URL DTO pointing through the authorization-aware gateway.
 */
export function formatMediaDto(storageKey: string, mediaType: 'image' | 'video', extra?: { width?: number; height?: number; duration?: number; thumbnail?: string }) {
  return {
    url: `/api/media/file/${storageKey}`,
    storageKey,
    mediaType,
    width: extra?.width,
    height: extra?.height,
    duration: extra?.duration,
    thumbnail: extra?.thumbnail,
  };
}
