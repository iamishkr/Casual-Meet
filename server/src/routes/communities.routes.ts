import { Router, Response } from 'express';
import mongoose from 'mongoose';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import {
  communityCreationLimiter,
  communityActionLimiter,
  searchLimiter,
  postCreationLimiter,
} from '../middleware/rateLimiter.js';
import { Community, ICommunity } from '../models/Community.js';
import { CommunityMember, ICommunityMember } from '../models/CommunityMember.js';
import { Post, IPost } from '../models/Post.js';
import { PostLike } from '../models/PostLike.js';
import { MediaAsset } from '../models/MediaAsset.js';
import {
  SAFE_USER_FIELDS,
  getBlockedUserIds,
  isBlocked,
  formatMediaDto,
} from '../utils/socialAuth.js';
import { sendNotification } from '../services/notificationService.js';
import { emitToUser, emitToChat } from '../socket.js';

const router = Router();

router.use(authenticate);

function formatCommunityDto(
  community: ICommunity,
  membership?: { isMember: boolean; role?: string; status?: string }
) {
  return {
    id: community._id.toString(),
    name: community.name,
    slug: community.slug,
    description: community.description,
    avatar: community.avatar,
    coverImage: community.coverImage,
    ownerId: community.ownerId,
    privacy: community.privacy,
    status: community.status,
    memberCount: community.memberCount,
    postCount: community.postCount,
    createdAt: community.createdAt,
    updatedAt: community.updatedAt,
    isMember: membership ? membership.isMember : false,
    userRole: membership?.role,
    membershipStatus: membership?.status || 'none',
  };
}

function generateSlug(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || `community-${Date.now()}`;
}

// ============================================================================
// 1. CREATE COMMUNITY
// ============================================================================
router.post('/', communityCreationLimiter, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const { name, description, privacy, avatar, coverImage } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      res.status(400).json({ error: 'Community name is required (minimum 2 characters).' });
      return;
    }

    const safeName = name.trim().slice(0, 100);
    const safeDescription = typeof description === 'string' ? description.trim().slice(0, 1000) : '';
    const safePrivacy = privacy === 'private' ? 'private' : 'public';

    // Generate unique slug
    let baseSlug = generateSlug(safeName);
    let uniqueSlug = baseSlug;
    let count = 1;
    while (await Community.findOne({ slug: uniqueSlug })) {
      uniqueSlug = `${baseSlug}-${count}`;
      count++;
    }

    // Mass-assignment protection: server derives ownerId, status, memberCount, postCount
    const community = await Community.create({
      name: safeName,
      slug: uniqueSlug,
      description: safeDescription,
      avatar: typeof avatar === 'string' ? avatar : undefined,
      coverImage: typeof coverImage === 'string' ? coverImage : undefined,
      ownerId: user._id,
      privacy: safePrivacy,
      status: 'active',
      memberCount: 1,
      postCount: 0,
    });

    // Creator automatically becomes active OWNER
    await CommunityMember.create({
      communityId: community._id,
      userId: user._id,
      role: 'owner',
      status: 'active',
      joinedAt: new Date(),
    });

    res.status(201).json(formatCommunityDto(community, { isMember: true, role: 'owner', status: 'active' }));
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to create community.' });
  }
});

// ============================================================================
// 2. DISCOVER / SEARCH COMMUNITIES
// ============================================================================
router.get('/', searchLimiter, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const query = typeof req.query.query === 'string' ? req.query.query.trim() : '';
    const privacy = req.query.privacy as string;
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);
    const page = Math.max(Number(req.query.page) || 1, 1);

    if (query && query.length > 50) {
      res.status(400).json({ error: 'Search query cannot exceed 50 characters.' });
      return;
    }

    const filter: any = { status: 'active' };

    if (privacy === 'public' || privacy === 'private') {
      filter.privacy = privacy;
    }

    if (query) {
      const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { name: { $regex: escaped, $options: 'i' } },
        { slug: { $regex: escaped, $options: 'i' } },
        { description: { $regex: escaped, $options: 'i' } },
      ];
    }

    const total = await Community.countDocuments(filter);
    const communities = await Community.find(filter)
      .sort({ memberCount: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    // Fetch user memberships for these communities
    const communityIds = communities.map((c) => c._id);
    const memberships = await CommunityMember.find({
      communityId: { $in: communityIds },
      userId: user._id,
    });

    const membershipMap = new Map<string, ICommunityMember>();
    for (const m of memberships) {
      membershipMap.set(m.communityId.toString(), m);
    }

    const dtos = communities.map((c) => {
      const m = membershipMap.get(c._id.toString());
      return formatCommunityDto(c, {
        isMember: m?.status === 'active',
        role: m?.role,
        status: m?.status || 'none',
      });
    });

    res.json({
      communities: dtos,
      total,
      page,
      limit,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to list communities.' });
  }
});

// ============================================================================
// 3. MY COMMUNITIES
// ============================================================================
router.get('/my', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);
    const page = Math.max(Number(req.query.page) || 1, 1);

    const userMemberships = await CommunityMember.find({
      userId: user._id,
      status: 'active',
    })
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await CommunityMember.countDocuments({
      userId: user._id,
      status: 'active',
    });

    const communityIds = userMemberships.map((m) => m.communityId);
    const communities = await Community.find({
      _id: { $in: communityIds },
      status: 'active',
    });

    const commMap = new Map<string, ICommunity>();
    for (const c of communities) {
      commMap.set(c._id.toString(), c);
    }

    const dtos = userMemberships
      .map((m) => {
        const c = commMap.get(m.communityId.toString());
        if (!c) return null;
        return formatCommunityDto(c, {
          isMember: true,
          role: m.role,
          status: 'active',
        });
      })
      .filter(Boolean);

    res.json({
      communities: dtos,
      total,
      page,
      limit,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch user communities.' });
  }
});

// ============================================================================
// 4. GET COMMUNITY BY ID OR SLUG
// ============================================================================
router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const { id } = req.params;

    const isOid = mongoose.Types.ObjectId.isValid(id);
    const filter = isOid ? { $or: [{ _id: id }, { slug: id }] } : { slug: id };

    const community = await Community.findOne(filter);
    if (!community) {
      res.status(404).json({ error: 'Community not found.' });
      return;
    }

    const isAdmin = user.role === 'super_admin' || user.role === 'moderator';
    if (community.status === 'suspended' && !isAdmin) {
      res.status(404).json({ error: 'Community not found or suspended.' });
      return;
    }

    const membership = await CommunityMember.findOne({
      communityId: community._id,
      userId: user._id,
    });

    res.json(
      formatCommunityDto(community, {
        isMember: membership?.status === 'active',
        role: membership?.role,
        status: membership?.status || 'none',
      })
    );
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch community.' });
  }
});

// ============================================================================
// 5. UPDATE COMMUNITY SETTINGS & PRIVACY TRANSITIONS
// ============================================================================
router.patch('/:id', communityActionLimiter, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid community ID format.' });
      return;
    }

    const community = await Community.findById(id);
    if (!community || community.status === 'suspended') {
      res.status(404).json({ error: 'Community not found.' });
      return;
    }

    // Authorization: Owner or Admin only
    const membership = await CommunityMember.findOne({
      communityId: community._id,
      userId: user._id,
      status: 'active',
    });

    const isOwner = community.ownerId.toString() === user._id.toString() || membership?.role === 'owner';
    const isCommunityAdmin = membership?.role === 'admin';
    const isPlatformAdmin = user.role === 'super_admin' || user.role === 'moderator';

    if (!isOwner && !isCommunityAdmin && !isPlatformAdmin) {
      res.status(403).json({ error: 'Access denied. Administrator or Owner privileges required.' });
      return;
    }

    const { name, description, privacy, avatar, coverImage } = req.body;

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length < 2) {
        res.status(400).json({ error: 'Community name must be at least 2 characters.' });
        return;
      }
      community.name = name.trim().slice(0, 100);
    }

    if (description !== undefined) {
      community.description = typeof description === 'string' ? description.trim().slice(0, 1000) : '';
    }

    if (avatar !== undefined) {
      community.avatar = typeof avatar === 'string' ? avatar : undefined;
    }

    if (coverImage !== undefined) {
      community.coverImage = typeof coverImage === 'string' ? coverImage : undefined;
    }

    // PRIVACY TRANSITIONS (Mandatory Directive Section 16 & Prompt Rule)
    if (privacy !== undefined && (privacy === 'public' || privacy === 'private')) {
      const oldPrivacy = community.privacy;
      const newPrivacy = privacy;

      if (oldPrivacy === 'private' && newPrivacy === 'public') {
        // PRIVATE -> PUBLIC Transition Rules:
        // 1. Existing ACTIVE members remain active members.
        // 2. Existing OWNER and ADMIN roles remain unchanged.
        // 3. Existing PENDING membership requests are automatically converted to ACTIVE membership.
        // 4. Each newly activated requester increases memberCount exactly once.
        // 5. No duplicate membership records may be created.
        // 6. The requester receives the existing community membership notification.
        // 7. After the transition, future users may join directly without approval.
        // 8. Existing community posts become subject to the public-community + Post visibility rules.
        // 9. No posts, comments, media, or memberships are deleted.

        const pendingRequests = await CommunityMember.find({
          communityId: community._id,
          status: 'pending',
        });

        if (pendingRequests.length > 0) {
          const newlyActivatedCount = pendingRequests.length;
          await CommunityMember.updateMany(
            { communityId: community._id, status: 'pending' },
            { $set: { status: 'active', joinedAt: new Date() } }
          );

          community.memberCount += newlyActivatedCount;

          // Notify each newly activated member
          for (const reqDoc of pendingRequests) {
            await sendNotification({
              recipientId: reqDoc.userId,
              actor: user,
              type: 'community_approved',
              title: 'Community Joined',
              message: `You are now an active member of ${community.name}.`,
              targetType: 'community',
              targetId: community._id,
            });
            emitToUser(reqDoc.userId.toString(), 'community_membership_updated', {
              communityId: community._id.toString(),
              status: 'active',
              role: reqDoc.role,
            });
          }
        }
      }

      community.privacy = newPrivacy;
    }

    await community.save();

    res.json(formatCommunityDto(community, {
      isMember: true,
      role: membership?.role || 'owner',
      status: 'active',
    }));
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update community.' });
  }
});

// ============================================================================
// 6. JOIN COMMUNITY / REQUEST TO JOIN
// ============================================================================
router.post('/:id/join', communityActionLimiter, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid community ID format.' });
      return;
    }

    const community = await Community.findById(id);
    if (!community || community.status === 'suspended') {
      res.status(404).json({ error: 'Community not found or suspended.' });
      return;
    }

    // Check if blocked by community owner
    if (await isBlocked(user._id, community.ownerId)) {
      res.status(403).json({ error: 'You cannot join this community.' });
      return;
    }

    const existing = await CommunityMember.findOne({
      communityId: community._id,
      userId: user._id,
    });

    if (existing) {
      if (existing.status === 'active') {
        res.status(400).json({ error: 'You are already an active member of this community.' });
        return;
      }
      if (existing.status === 'pending') {
        res.status(400).json({ error: 'Your request to join this community is already pending approval.' });
        return;
      }
    }

    if (community.privacy === 'public') {
      // Direct join
      await CommunityMember.findOneAndUpdate(
        { communityId: community._id, userId: user._id },
        {
          $set: {
            role: 'member',
            status: 'active',
            joinedAt: new Date(),
          },
        },
        { upsert: true, new: true }
      );

      await Community.updateOne({ _id: community._id }, { $inc: { memberCount: 1 } });
      const updatedComm = await Community.findById(community._id);

      // Notify community owner
      if (community.ownerId.toString() !== user._id.toString()) {
        await sendNotification({
          recipientId: community.ownerId,
          actor: user,
          type: 'community_joined',
          title: 'New Community Member',
          message: `${user.name} joined ${community.name}.`,
          targetType: 'community',
          targetId: community._id,
        });
      }

      res.status(200).json({
        message: 'Joined community successfully.',
        membership: { isMember: true, role: 'member', status: 'active' },
        community: formatCommunityDto(updatedComm || community, { isMember: true, role: 'member', status: 'active' }),
      });
    } else {
      // Private community: request approval
      await CommunityMember.findOneAndUpdate(
        { communityId: community._id, userId: user._id },
        {
          $set: {
            role: 'member',
            status: 'pending',
            joinedAt: new Date(),
          },
        },
        { upsert: true, new: true }
      );

      // Notify community owner and admins
      const admins = await CommunityMember.find({
        communityId: community._id,
        role: { $in: ['owner', 'admin'] },
        status: 'active',
      }).select('userId');

      for (const adminDoc of admins) {
        await sendNotification({
          recipientId: adminDoc.userId,
          actor: user,
          type: 'community_join_request',
          title: 'Membership Request',
          message: `${user.name} requested to join ${community.name}.`,
          targetType: 'community',
          targetId: community._id,
        });
      }

      res.status(200).json({
        message: 'Membership request submitted for approval.',
        membership: { isMember: false, role: 'member', status: 'pending' },
        community: formatCommunityDto(community, { isMember: false, role: 'member', status: 'pending' }),
      });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to join community.' });
  }
});

// ============================================================================
// 7. LEAVE COMMUNITY
// ============================================================================
router.delete('/:id/leave', communityActionLimiter, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid community ID format.' });
      return;
    }

    const community = await Community.findById(id);
    if (!community) {
      res.status(404).json({ error: 'Community not found.' });
      return;
    }

    const membership = await CommunityMember.findOne({
      communityId: community._id,
      userId: user._id,
    });

    if (!membership) {
      res.status(404).json({ error: 'You are not a member of this community.' });
      return;
    }

    // Owner protection: Sole owner cannot leave without deleting or transferring
    if (membership.role === 'owner') {
      const otherOwners = await CommunityMember.countDocuments({
        communityId: community._id,
        role: 'owner',
        status: 'active',
        userId: { $ne: user._id },
      });
      if (otherOwners === 0 && community.memberCount > 1) {
        res.status(400).json({
          error: 'Community owner cannot leave while other members exist. Please transfer ownership or delete the community.',
        });
        return;
      }
    }

    const wasActive = membership.status === 'active';
    await membership.deleteOne();

    if (wasActive) {
      await Community.updateOne({ _id: community._id, memberCount: { $gt: 0 } }, { $inc: { memberCount: -1 } });
    }

    res.json({ success: true, message: 'You have left the community.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to leave community.' });
  }
});

// ============================================================================
// 8. LIST COMMUNITY MEMBERS
// ============================================================================
router.get('/:id/members', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);
    const page = Math.max(Number(req.query.page) || 1, 1);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid community ID format.' });
      return;
    }

    const community = await Community.findById(id);
    if (!community || community.status === 'suspended') {
      res.status(404).json({ error: 'Community not found or suspended.' });
      return;
    }

    // Privacy rule (Section 10 & 18): Private community member lists require active membership
    const isAdmin = user.role === 'super_admin' || user.role === 'moderator';
    if (community.privacy === 'private') {
      const membership = await CommunityMember.findOne({
        communityId: community._id,
        userId: user._id,
        status: 'active',
      });
      if (!membership && !isAdmin) {
        res.status(403).json({ error: 'This is a private community. Member list is restricted to active members.' });
        return;
      }
    }

    // Filter out blocked users
    const blockedUserIds = await getBlockedUserIds(user._id);

    const filter: any = {
      communityId: community._id,
      status: 'active',
      userId: { $nin: blockedUserIds },
    };

    const total = await CommunityMember.countDocuments(filter);
    const members = await CommunityMember.find(filter)
      .sort({ role: 1, joinedAt: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('userId', SAFE_USER_FIELDS);

    const safeMembers = members.map((m: any) => ({
      id: m._id.toString(),
      user: m.userId,
      role: m.role,
      joinedAt: m.joinedAt,
    }));

    res.json({
      members: safeMembers,
      total,
      page,
      limit,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch members.' });
  }
});

// ============================================================================
// 9. LIST PENDING MEMBERSHIP REQUESTS (Owner/Admin only)
// ============================================================================
router.get('/:id/membership-requests', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);
    const page = Math.max(Number(req.query.page) || 1, 1);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid community ID format.' });
      return;
    }

    const community = await Community.findById(id);
    if (!community || community.status === 'suspended') {
      res.status(404).json({ error: 'Community not found or suspended.' });
      return;
    }

    const membership = await CommunityMember.findOne({
      communityId: community._id,
      userId: user._id,
      status: 'active',
    });

    const isAuthorized =
      community.ownerId.toString() === user._id.toString() ||
      membership?.role === 'owner' ||
      membership?.role === 'admin' ||
      user.role === 'super_admin';

    if (!isAuthorized) {
      res.status(403).json({ error: 'Access denied. Administrator or Owner privileges required.' });
      return;
    }

    const filter = {
      communityId: community._id,
      status: 'pending',
    };

    const total = await CommunityMember.countDocuments(filter);
    const requests = await CommunityMember.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('userId', SAFE_USER_FIELDS);

    const safeRequests = requests.map((r: any) => ({
      id: r._id.toString(),
      user: r.userId,
      requestedAt: r.createdAt,
    }));

    res.json({
      requests: safeRequests,
      total,
      page,
      limit,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to list membership requests.' });
  }
});

// ============================================================================
// 10. APPROVE MEMBERSHIP REQUEST
// ============================================================================
router.post('/:id/membership-requests/:targetUserId/approve', communityActionLimiter, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const { id, targetUserId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(targetUserId)) {
      res.status(400).json({ error: 'Invalid ID format.' });
      return;
    }

    const community = await Community.findById(id);
    if (!community || community.status === 'suspended') {
      res.status(404).json({ error: 'Community not found or suspended.' });
      return;
    }

    // Authorization check
    const membership = await CommunityMember.findOne({
      communityId: community._id,
      userId: user._id,
      status: 'active',
    });

    const isAuthorized =
      community.ownerId.toString() === user._id.toString() ||
      membership?.role === 'owner' ||
      membership?.role === 'admin' ||
      user.role === 'super_admin';

    if (!isAuthorized) {
      res.status(403).json({ error: 'Access denied. Administrator or Owner privileges required.' });
      return;
    }

    // Cannot approve self
    if (user._id.toString() === targetUserId) {
      res.status(400).json({ error: 'You cannot approve your own membership request.' });
      return;
    }

    const targetReq = await CommunityMember.findOne({
      communityId: community._id,
      userId: targetUserId,
      status: 'pending',
    });

    if (!targetReq) {
      res.status(404).json({ error: 'Pending membership request not found.' });
      return;
    }

    targetReq.status = 'active';
    targetReq.joinedAt = new Date();
    await targetReq.save();

    await Community.updateOne({ _id: community._id }, { $inc: { memberCount: 1 } });

    // Send notification and emit socket event
    await sendNotification({
      recipientId: new mongoose.Types.ObjectId(targetUserId),
      actor: user,
      type: 'community_approved',
      title: 'Membership Approved',
      message: `Your request to join ${community.name} has been approved.`,
      targetType: 'community',
      targetId: community._id,
    });

    emitToUser(targetUserId, 'community_membership_updated', {
      communityId: community._id.toString(),
      status: 'active',
      role: targetReq.role,
    });

    res.json({ success: true, message: 'Membership request approved.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to approve request.' });
  }
});

// ============================================================================
// 11. REJECT MEMBERSHIP REQUEST
// ============================================================================
router.post('/:id/membership-requests/:targetUserId/reject', communityActionLimiter, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const { id, targetUserId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(targetUserId)) {
      res.status(400).json({ error: 'Invalid ID format.' });
      return;
    }

    const community = await Community.findById(id);
    if (!community || community.status === 'suspended') {
      res.status(404).json({ error: 'Community not found or suspended.' });
      return;
    }

    const membership = await CommunityMember.findOne({
      communityId: community._id,
      userId: user._id,
      status: 'active',
    });

    const isAuthorized =
      community.ownerId.toString() === user._id.toString() ||
      membership?.role === 'owner' ||
      membership?.role === 'admin' ||
      user.role === 'super_admin';

    if (!isAuthorized) {
      res.status(403).json({ error: 'Access denied. Administrator or Owner privileges required.' });
      return;
    }

    const targetReq = await CommunityMember.findOne({
      communityId: community._id,
      userId: targetUserId,
      status: 'pending',
    });

    if (!targetReq) {
      res.status(404).json({ error: 'Pending membership request not found.' });
      return;
    }

    await targetReq.deleteOne();

    await sendNotification({
      recipientId: new mongoose.Types.ObjectId(targetUserId),
      actor: user,
      type: 'community_rejected',
      title: 'Membership Request Declined',
      message: `Your request to join ${community.name} was not approved.`,
      targetType: 'community',
      targetId: community._id,
    });

    emitToUser(targetUserId, 'community_membership_updated', {
      communityId: community._id.toString(),
      status: 'none',
    });

    res.json({ success: true, message: 'Membership request rejected.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to reject request.' });
  }
});

// ============================================================================
// 12. UPDATE MEMBER ROLE (Owner only)
// ============================================================================
router.patch('/:id/members/:targetUserId/role', communityActionLimiter, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const { id, targetUserId } = req.params;
    const { role } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(targetUserId)) {
      res.status(400).json({ error: 'Invalid ID format.' });
      return;
    }

    if (role !== 'admin' && role !== 'member') {
      res.status(400).json({ error: 'Role must be either "admin" or "member".' });
      return;
    }

    const community = await Community.findById(id);
    if (!community || community.status === 'suspended') {
      res.status(404).json({ error: 'Community not found or suspended.' });
      return;
    }

    // Role protection (Directive Section 19 & 20): ONLY OWNER can manage admin roles
    const callerMembership = await CommunityMember.findOne({
      communityId: community._id,
      userId: user._id,
      status: 'active',
    });

    const isOwner = community.ownerId.toString() === user._id.toString() || callerMembership?.role === 'owner';
    const isPlatformAdmin = user.role === 'super_admin';

    if (!isOwner && !isPlatformAdmin) {
      res.status(403).json({ error: 'Access denied. Only the community owner may modify member roles.' });
      return;
    }

    // Cannot demote or modify community owner
    if (community.ownerId.toString() === targetUserId) {
      res.status(403).json({ error: 'Cannot modify role of the community owner.' });
      return;
    }

    const targetMembership = await CommunityMember.findOne({
      communityId: community._id,
      userId: targetUserId,
      status: 'active',
    });

    if (!targetMembership) {
      res.status(404).json({ error: 'Active member not found in this community.' });
      return;
    }

    targetMembership.role = role;
    await targetMembership.save();

    await sendNotification({
      recipientId: new mongoose.Types.ObjectId(targetUserId),
      actor: user,
      type: 'community_role_updated',
      title: 'Community Role Updated',
      message: `Your role in ${community.name} has been updated to ${role}.`,
      targetType: 'community',
      targetId: community._id,
    });

    emitToUser(targetUserId, 'community_membership_updated', {
      communityId: community._id.toString(),
      role,
      status: 'active',
    });

    res.json({ success: true, message: `Member role updated to ${role}.` });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update member role.' });
  }
});

// ============================================================================
// 13. REMOVE / KICK MEMBER
// ============================================================================
router.delete('/:id/members/:targetUserId', communityActionLimiter, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const { id, targetUserId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(targetUserId)) {
      res.status(400).json({ error: 'Invalid ID format.' });
      return;
    }

    const community = await Community.findById(id);
    if (!community || community.status === 'suspended') {
      res.status(404).json({ error: 'Community not found or suspended.' });
      return;
    }

    const callerMembership = await CommunityMember.findOne({
      communityId: community._id,
      userId: user._id,
      status: 'active',
    });

    const isOwner = community.ownerId.toString() === user._id.toString() || callerMembership?.role === 'owner';
    const isCallerAdmin = callerMembership?.role === 'admin';
    const isPlatformAdmin = user.role === 'super_admin' || user.role === 'moderator';

    if (!isOwner && !isCallerAdmin && !isPlatformAdmin) {
      res.status(403).json({ error: 'Access denied. Administrator or Owner privileges required.' });
      return;
    }

    // Owner protection: Owner cannot be kicked
    if (community.ownerId.toString() === targetUserId) {
      res.status(403).json({ error: 'Cannot remove the community owner.' });
      return;
    }

    const targetMembership = await CommunityMember.findOne({
      communityId: community._id,
      userId: targetUserId,
    });

    if (!targetMembership) {
      res.status(404).json({ error: 'Member not found.' });
      return;
    }

    // Admin hierarchy: Community admin cannot kick another admin or owner
    if (isCallerAdmin && !isOwner && !isPlatformAdmin) {
      if (targetMembership.role === 'admin' || targetMembership.role === 'owner') {
        res.status(403).json({ error: 'Admins cannot remove other admins or the owner.' });
        return;
      }
    }

    const wasActive = targetMembership.status === 'active';
    await targetMembership.deleteOne();

    if (wasActive) {
      await Community.updateOne({ _id: community._id, memberCount: { $gt: 0 } }, { $inc: { memberCount: -1 } });
    }

    emitToUser(targetUserId, 'community_membership_updated', {
      communityId: community._id.toString(),
      status: 'none',
    });

    res.json({ success: true, message: 'Member removed from community.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to remove member.' });
  }
});

// ============================================================================
// 14. GET COMMUNITY FEED
// ============================================================================
router.get('/:id/posts', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);
    const page = Math.max(Number(req.query.page) || 1, 1);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid community ID format.' });
      return;
    }

    const community = await Community.findById(id);
    if (!community || community.status === 'suspended') {
      res.status(404).json({ error: 'Community not found or suspended.' });
      return;
    }

    const isAdmin = user.role === 'super_admin' || user.role === 'moderator';

    // Privacy rule (Section 9 & 24): Private community feed requires active membership
    if (community.privacy === 'private') {
      const membership = await CommunityMember.findOne({
        communityId: community._id,
        userId: user._id,
        status: 'active',
      });
      if (!membership && !isAdmin) {
        res.status(403).json({ error: 'This is a private community. Content is restricted to active members only.' });
        return;
      }
    }

    // Filter out blocked authors and moderated content
    const blockedUserIds = await getBlockedUserIds(user._id);

    const filter: any = {
      communityId: community._id,
      isDeleted: false,
      moderationStatus: { $ne: 'hidden' },
      authorId: { $nin: blockedUserIds },
    };

    const total = await Post.countDocuments(filter);
    const posts = await Post.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('authorId', SAFE_USER_FIELDS);

    // Fetch user likes for these posts
    const postIds = posts.map((p) => p._id);
    const userLikes = await PostLike.find({
      postId: { $in: postIds },
      userId: user._id,
    });
    const likedSet = new Set(userLikes.map((l) => l.postId.toString()));

    const safePosts = posts.map((p) => ({
      id: p._id.toString(),
      communityId: community._id.toString(),
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
    }));

    res.json({
      posts: safePosts,
      total,
      page,
      limit,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch community posts.' });
  }
});

// ============================================================================
// 15. CREATE COMMUNITY POST
// ============================================================================
router.post('/:id/posts', postCreationLimiter, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const { caption, media, locationName } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid community ID format.' });
      return;
    }

    const community = await Community.findById(id);
    if (!community || community.status === 'suspended') {
      res.status(404).json({ error: 'Community not found or suspended.' });
      return;
    }

    // Membership requirement: Only ACTIVE members may create posts (Directive Section 23)
    const membership = await CommunityMember.findOne({
      communityId: community._id,
      userId: user._id,
      status: 'active',
    });

    if (!membership) {
      res.status(403).json({ error: 'You must be an active member of this community to create posts.' });
      return;
    }

    const safeCaption = typeof caption === 'string' ? caption.trim().slice(0, 2200) : '';
    const safeLocation = typeof locationName === 'string' ? locationName.trim().slice(0, 100) : undefined;

    // Media verification
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

        if (asset.uploaderId.toString() !== user._id.toString()) {
          res.status(403).json({ error: 'Unauthorized. You cannot attach media uploaded by another user.' });
          return;
        }

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

    if (!safeCaption && verifiedMedia.length === 0) {
      res.status(400).json({ error: 'Community post must contain either text caption or media.' });
      return;
    }

    const post = await Post.create({
      authorId: user._id,
      communityId: community._id,
      caption: safeCaption,
      media: verifiedMedia,
      visibility: 'public', // In a community, community privacy is the upper gate
      locationName: safeLocation,
      likeCount: 0,
      commentCount: 0,
      isEdited: false,
      isDeleted: false,
      moderationStatus: 'visible',
    });

    // Mark media as attached
    if (mediaAssetIdsToUpdate.length > 0) {
      await MediaAsset.updateMany(
        { _id: { $in: mediaAssetIdsToUpdate } },
        { $set: { isAttached: true, attachedToType: 'post', attachedToId: post._id } }
      );
    }

    await Community.updateOne({ _id: community._id }, { $inc: { postCount: 1 } });
    await post.populate('authorId', SAFE_USER_FIELDS);

    const postDto = {
      id: post._id.toString(),
      communityId: community._id.toString(),
      author: post.authorId,
      caption: post.caption,
      media: post.media.map((m) => formatMediaDto(m.storageKey, m.mediaType, m)),
      visibility: post.visibility,
      locationName: post.locationName || undefined,
      likeCount: 0,
      commentCount: 0,
      isLiked: false,
      isEdited: false,
      moderationStatus: post.moderationStatus,
      createdAt: post.createdAt,
    };

    res.status(201).json(postDto);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to create community post.' });
  }
});

export default router;
