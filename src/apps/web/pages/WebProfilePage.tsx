import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { api } from '../../../lib/api';
import type { PostDTO, RelationshipDTO } from '../../../lib/types';
import PostCard from '../../../components/social/PostCard';
import FollowButton from '../../../components/social/FollowButton';
import UserListModal from '../../../components/social/UserListModal';
import BlockModal from '../../../components/social/BlockModal';
import ReportModal from '../../../components/social/ReportModal';
import {
  Shield,
  MapPin,
  Briefcase,
  Calendar,
  MessageCircle,
  UserPlus,
  ShieldAlert,
  Flag,
  KeyRound,
  FileCheck,
  Loader2,
  Grid,
  Lock,
} from 'lucide-react';
import { Button, Modal, EmptyState, Badge } from '../../../components/ui';
import MeetupModal from '../../../components/social/MeetupModal';

export default function WebProfilePage() {
  const { userId: paramUserId } = useParams<{ userId?: string }>();
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Determine if viewing own profile or other user
  const effectiveUserId =
    paramUserId || currentUser?.id || '';
  const isOwnProfile =
    Boolean(currentUser) &&
    Boolean(currentUser?.id) &&
    effectiveUserId === currentUser?.id;

  const [profileUser, setProfileUser] = useState<any>(null);
  const [relationship, setRelationship] = useState<RelationshipDTO | null>(null);
  const [posts, setPosts] = useState<PostDTO[]>([]);
  const [postsTotal, setPostsTotal] = useState(0);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Modals
  const [followersModalOpen, setFollowersModalOpen] = useState(false);
  const [followingModalOpen, setFollowingModalOpen] = useState(false);
  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [meetupModalOpen, setMeetupModalOpen] = useState(false);
  const [pwdModalOpen, setPwdModalOpen] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [submittingPwd, setSubmittingPwd] = useState(false);

  const loadProfileData = useCallback(async () => {
    if (!effectiveUserId) return;
    setLoading(true);

    try {
      // 1. Fetch user profile and posts in parallel
      const [profileData, postsRes] = await Promise.all([
        api.social.getProfile(effectiveUserId),
        api.social.getUserPosts(effectiveUserId, 1, 30),
      ]);

      setProfileUser(profileData);
      setRelationship(profileData.relationship || null);
      setPosts(postsRes.posts || []);
      setPostsTotal(profileData.postsCount ?? postsRes.total ?? 0);
      setFollowersCount(profileData.followersCount ?? 0);
      setFollowingCount(profileData.followingCount ?? 0);
    } catch (err: any) {
      toast('err', 'Profile Error', err?.message || 'Could not load profile information.');
    } finally {
      setLoading(false);
    }
  }, [effectiveUserId, toast]);

  useEffect(() => {
    loadProfileData();
  }, [loadProfileData]);

  const handleConnect = async () => {
    if (!effectiveUserId) return;
    try {
      await api.connections.request(effectiveUserId);
      toast('ok', 'Connection Request Sent', `Request sent to ${profileUser?.name}.`);
    } catch (err: any) {
      toast('err', 'Connection Failed', err?.message || 'Could not send connection request.');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oldPassword || !newPassword) return;

    setSubmittingPwd(true);
    try {
      await api.auth.changePassword(oldPassword, newPassword);
      toast('ok', 'Password Updated', 'Your password was changed successfully.');
      setPwdModalOpen(false);
      setOldPassword('');
      setNewPassword('');
    } catch (err: any) {
      toast('err', 'Failed', err?.message || 'Could not update password.');
    } finally {
      setSubmittingPwd(false);
    }
  };

  const handlePostDeleted = (postId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    setPostsTotal((c) => Math.max(0, c - 1));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-mute text-xs">
        <Loader2 size={24} className="animate-spin text-amber mr-2" />
        <span>Loading profile...</span>
      </div>
    );
  }

  const u = profileUser || currentUser;

  return (
    <div className="space-y-6 max-w-3xl mx-auto w-full pb-10">
      {/* Profile Header Card */}
      <div className="rounded-3xl border border-line-soft bg-night-850/90 p-6 shadow-sm backdrop-blur-md space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
          {/* Avatar and Identity */}
          <div className="flex items-center gap-4 min-w-0">
            <div
              className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl font-display text-2xl font-black text-night-950 shadow-lg"
              style={{
                background: `linear-gradient(135deg, hsl(${u.avatarHue ?? 210} 85% 68%), hsl(${((u.avatarHue ?? 210) + 42) % 360} 80% 55%))`,
              }}
            >
              {u.name?.slice(0, 2).toUpperCase()}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-display text-xl sm:text-2xl font-extrabold text-ink truncate">
                  {u.name}
                </h1>
                {u.isVerified && (
                  <span className="inline-flex items-center gap-1 rounded bg-safe/15 px-2 py-0.5 font-mono text-[10px] font-bold text-safe uppercase">
                    <Shield size={12} /> ID Verified
                  </span>
                )}
              </div>

              <p className="font-mono text-xs text-dim">@{u.username}</p>

              <div className="flex items-center gap-3 text-xs text-mute mt-1.5 flex-wrap">
                {u.city && (
                  <span className="flex items-center gap-1">
                    <MapPin size={12} className="text-amber" />
                    <span>{u.city}</span>
                  </span>
                )}
                {u.occupation && (
                  <span className="flex items-center gap-1">
                    <Briefcase size={12} className="text-mute" />
                    <span>{u.occupation}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end flex-wrap">
            {isOwnProfile ? (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/app/safety')}
                  leftIcon={<Shield size={13} className="text-safe" />}
                >
                  Safety Center
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPwdModalOpen(true)}
                  leftIcon={<KeyRound size={13} />}
                >
                  Password
                </Button>
              </div>
            ) : (
              <>
                <FollowButton
                  userId={effectiveUserId}
                  initialIsFollowing={relationship?.isFollowing}
                  onFollowChange={(isNowFollowing) => {
                    setFollowersCount((c) => (isNowFollowing ? c + 1 : Math.max(0, c - 1)));
                  }}
                  size="md"
                />

                {relationship?.connectionStatus === 'connected' ? (
                  <Badge tone="ok">Connected</Badge>
                ) : relationship?.connectionStatus === 'pending' ? (
                  <Badge tone="warn">Request Pending</Badge>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleConnect}
                    leftIcon={<UserPlus size={13} />}
                  >
                    Connect
                  </Button>
                )}

                {relationship?.canMeet && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setMeetupModalOpen(true)}
                    leftIcon={<Shield size={13} />}
                  >
                    Meet Safely
                  </Button>
                )}

                {relationship?.canMessage && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      try {
                        const chat = await api.chats.getWithUser(effectiveUserId);
                        navigate(`/app/messages?chatId=${chat._id}`);
                      } catch {
                        navigate('/app/messages');
                      }
                    }}
                    leftIcon={<MessageCircle size={13} />}
                  >
                    Message
                  </Button>
                )}

                {relationship?.isBlocked ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      try {
                        await api.connections.unblock(effectiveUserId);
                        toast('ok', 'Member unblocked');
                        loadProfileData();
                      } catch (err: any) {
                        toast('err', 'Failed to unblock', err?.message);
                      }
                    }}
                  >
                    Unblock
                  </Button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setBlockModalOpen(true)}
                    className="rounded-xl border border-line-soft bg-night-800 p-2 text-mute hover:text-sos transition-colors"
                    title="Block member"
                  >
                    <ShieldAlert size={16} />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setReportModalOpen(true)}
                  className="rounded-xl border border-line-soft bg-night-800 p-2 text-mute hover:text-amber transition-colors"
                  title="Report member"
                >
                  <Flag size={16} />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Bio Text */}
        {u.bio && (
          <p className="text-xs sm:text-sm text-ink leading-relaxed border-t border-line-soft/60 pt-3">
            {u.bio}
          </p>
        )}

        {/* Stats Row */}
        <div className="flex items-center gap-6 border-t border-line-soft/60 pt-4 font-mono text-xs flex-wrap">
          <div className="flex items-center gap-1.5">
            <strong className="text-ink text-sm font-display font-black">{postsTotal}</strong>
            <span className="text-dim">Posts</span>
          </div>

          <button
            type="button"
            onClick={() => setFollowersModalOpen(true)}
            className="flex items-center gap-1.5 hover:text-amber transition-colors"
          >
            <strong className="text-ink text-sm font-display font-black">{followersCount}</strong>
            <span className="text-dim">Followers</span>
          </button>

          <button
            type="button"
            onClick={() => setFollowingModalOpen(true)}
            className="flex items-center gap-1.5 hover:text-amber transition-colors"
          >
            <strong className="text-ink text-sm font-display font-black">{followingCount}</strong>
            <span className="text-dim">Following</span>
          </button>

          {profileUser?.mutualConnectionsCount !== undefined && profileUser.mutualConnectionsCount > 0 && (
            <div className="flex items-center gap-1.5">
              <strong className="text-safe text-sm font-display font-black">
                {profileUser.mutualConnectionsCount}
              </strong>
              <span className="text-dim">Mutual</span>
            </div>
          )}
        </div>
      </div>

      {/* Profile Posts Feed Header */}
      <div className="flex items-center justify-between border-b border-line-soft/60 pb-3">
        <h3 className="font-display text-sm font-bold text-ink flex items-center gap-2">
          <Grid size={16} className="text-amber" />
          <span>Posts by {isOwnProfile ? 'You' : u.name}</span>
        </h3>
      </div>

      {/* Posts Feed */}
      <div className="space-y-4">
        {posts.length === 0 ? (
          <EmptyState
            icon={<Grid size={28} className="text-amber" />}
            title="No posts published"
            description={
              isOwnProfile
                ? 'Share your first post using the composer on the home feed!'
                : `${u.name} has not published any posts visible to you.`
            }
          />
        ) : (
          posts.map((post) => (
            <PostCard key={post.id} post={post} onPostDeleted={handlePostDeleted} />
          ))
        )}
      </div>

      {/* Followers Modal */}
      {followersModalOpen && (
        <UserListModal
          open={followersModalOpen}
          onClose={() => setFollowersModalOpen(false)}
          title={`Followers of ${u.name}`}
          userId={effectiveUserId}
          type="followers"
        />
      )}

      {/* Following Modal */}
      {followingModalOpen && (
        <UserListModal
          open={followingModalOpen}
          onClose={() => setFollowingModalOpen(false)}
          title={`People followed by ${u.name}`}
          userId={effectiveUserId}
          type="following"
        />
      )}

      {/* Block Modal */}
      {blockModalOpen && (
        <BlockModal
          open={blockModalOpen}
          onClose={() => setBlockModalOpen(false)}
          targetUserId={effectiveUserId}
          targetName={u.name}
          onBlocked={() => navigate('/app')}
        />
      )}

      {/* Report Modal */}
      {reportModalOpen && (
        <ReportModal
          open={reportModalOpen}
          onClose={() => setReportModalOpen(false)}
          targetType="user"
          targetId={effectiveUserId}
          targetName={u.name}
        />
      )}

      {/* Change Password Modal */}
      {pwdModalOpen && (
        <Modal
          open={pwdModalOpen}
          onClose={() => setPwdModalOpen(false)}
          title="Change Password"
          description="Update your account login password."
        >
          <form onSubmit={handleChangePassword} className="space-y-4 pt-1">
            <div>
              <label className="block font-mono text-[10px] uppercase text-dim mb-1">
                Current Password
              </label>
              <input
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                required
                className="w-full rounded-xl border border-line bg-night-900 p-2.5 text-xs text-ink outline-none focus:border-amber"
              />
            </div>
            <div>
              <label className="block font-mono text-[10px] uppercase text-dim mb-1">
                New Password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
                className="w-full rounded-xl border border-line bg-night-900 p-2.5 text-xs text-ink outline-none focus:border-amber"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-line-soft">
              <Button variant="ghost" size="sm" onClick={() => setPwdModalOpen(false)} type="button">
                Cancel
              </Button>
              <Button variant="primary" size="sm" type="submit" disabled={submittingPwd}>
                {submittingPwd ? 'Updating...' : 'Save Password'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Meetup Modal */}
      {meetupModalOpen && profileUser && (
        <MeetupModal
          open={meetupModalOpen}
          onClose={() => setMeetupModalOpen(false)}
          targetUser={{
            id: profileUser._id || profileUser.id,
            name: profileUser.name,
            username: profileUser.username,
            avatarHue: profileUser.avatarHue,
          }}
        />
      )}
    </div>
  );
}
