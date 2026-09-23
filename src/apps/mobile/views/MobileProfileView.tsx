import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { api } from '../../../lib/api';
import type { PostDTO, RelationshipDTO } from '../../../lib/types';
import PostCard from '../../../components/social/PostCard';
import FollowButton from '../../../components/social/FollowButton';
import UserListModal from '../../../components/social/UserListModal';
import BlockModal from '../../../components/social/BlockModal';
import ReportModal from '../../../components/social/ReportModal';
import { Modal, Button, Badge } from '../../../components/ui';
import MeetupModal from '../../../components/social/MeetupModal';
import {
  Shield,
  MapPin,
  Briefcase,
  KeyRound,
  LogOut,
  UserPlus,
  MessageCircle,
  MoreVertical,
  ShieldAlert,
  Loader2,
  Calendar,
  Sparkles,
  Lock,
  ChevronRight,
  Trash2,
} from 'lucide-react';

export default function MobileProfileView() {
  const { userId: paramUserId } = useParams<{ userId?: string }>();
  const { currentUser, logout } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const effectiveUserId = paramUserId || currentUser?.id || '';
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

  // Delete account state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (deleteConfirmation.trim().toUpperCase() !== 'DELETE') {
      toast('err', 'Invalid confirmation', 'Please type DELETE in all capitals to confirm.');
      return;
    }
    setDeletingAccount(true);
    try {
      await api.auth.deleteAccount(deleteConfirmation);
      toast('ok', 'Account Deleted', 'Your account and personal data have been removed.');
      logout();
      navigate('/');
    } catch (err: any) {
      toast('err', 'Deletion Failed', err?.message || 'Could not delete account.');
    } finally {
      setDeletingAccount(false);
    }
  };

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
      toast('err', 'Request Failed', err?.message || 'Could not send connection request.');
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
    <div className="space-y-4">
      {/* Profile Identity Card */}
      <div className="rounded-3xl border border-line-soft bg-night-850/90 p-5 shadow-sm backdrop-blur-md space-y-4">
        <div className="flex items-center gap-4">
          {/* Avatar with Hue Gradient */}
          <div
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl font-display text-xl font-black text-night-950 shadow-md"
            style={{
              background: `linear-gradient(135deg, hsl(${u?.avatarHue ?? 210} 85% 68%), hsl(${((u?.avatarHue ?? 210) + 42) % 360} 80% 55%))`,
            }}
          >
            {u?.name?.slice(0, 2).toUpperCase()}
          </div>

          <div className="min-w-0 flex-1">
            <h2 className="font-display text-base font-bold text-ink truncate flex items-center gap-1.5">
              {u?.name}
              {u?.isVerified && (
                <span title="Verified ID" className="inline-flex items-center">
                  <Shield size={14} className="text-safe shrink-0" />
                </span>
              )}
            </h2>
            <p className="font-mono text-xs text-dim truncate">@{u?.username}</p>

            {(u?.city || u?.occupation) && (
              <div className="flex items-center gap-3 font-mono text-[11px] text-mute mt-1 truncate">
                {u?.occupation && (
                  <span className="flex items-center gap-1 truncate">
                    <Briefcase size={11} className="text-dim shrink-0" />
                    <span className="truncate">{u.occupation}</span>
                  </span>
                )}
                {u?.city && (
                  <span className="flex items-center gap-1 truncate">
                    <MapPin size={11} className="text-amber shrink-0" />
                    <span className="truncate">{u.city}</span>
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Bio */}
        {u?.bio && (
          <p className="text-xs text-ink/90 leading-relaxed pt-1">
            {u.bio}
          </p>
        )}

        {/* Stats Strip */}
        <div className={`grid ${profileUser?.mutualConnectionsCount ? 'grid-cols-4' : 'grid-cols-3'} gap-2 py-3 border-y border-line-soft text-center`}>
          <div>
            <span className="block font-display text-base font-extrabold text-ink">
              {postsTotal}
            </span>
            <span className="font-mono text-[10px] text-dim uppercase tracking-wider">Posts</span>
          </div>

          <button
            type="button"
            onClick={() => setFollowersModalOpen(true)}
            className="hover:bg-night-800/50 rounded-xl transition-colors py-0.5"
          >
            <span className="block font-display text-base font-extrabold text-amber">
              {followersCount}
            </span>
            <span className="font-mono text-[10px] text-dim uppercase tracking-wider">Followers</span>
          </button>

          <button
            type="button"
            onClick={() => setFollowingModalOpen(true)}
            className="hover:bg-night-800/50 rounded-xl transition-colors py-0.5"
          >
            <span className="block font-display text-base font-extrabold text-ink">
              {followingCount}
            </span>
            <span className="font-mono text-[10px] text-dim uppercase tracking-wider">Following</span>
          </button>

          {profileUser?.mutualConnectionsCount !== undefined && profileUser.mutualConnectionsCount > 0 && (
            <div>
              <span className="block font-display text-base font-extrabold text-safe">
                {profileUser.mutualConnectionsCount}
              </span>
              <span className="font-mono text-[10px] text-dim uppercase tracking-wider">Mutual</span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {isOwnProfile ? (
            <>
              {/* Privacy-Preserving Navigation to Emergency Contacts in Safety Center (Guardrail 3) */}
              <Link
                to="/mobile/safety"
                className="flex flex-1 items-center justify-between rounded-xl border border-line-soft bg-night-900 px-3.5 py-2 text-xs font-semibold text-ink hover:border-amber/40 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Shield size={14} className="text-safe" />
                  <span>Safety & Emergency Contacts</span>
                </span>
                <ChevronRight size={14} className="text-dim" />
              </Link>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setPwdModalOpen(true)}
                leftIcon={<KeyRound size={13} />}
              >
                Password
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={logout}
                className="text-mute hover:text-ink hover:bg-night-800"
                leftIcon={<LogOut size={13} />}
              >
                Logout
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDeleteConfirmation('');
                  setDeleteModalOpen(true);
                }}
                className="text-dim hover:text-sos hover:bg-sos/15"
                leftIcon={<Trash2 size={13} />}
              >
                Delete Account
              </Button>
            </>
          ) : (
            <>
              <FollowButton
                userId={effectiveUserId}
                initialIsFollowing={relationship?.isFollowing}
                onFollowChange={(isNowFollowing) => {
                  setFollowersCount((c) => (isNowFollowing ? c + 1 : Math.max(0, c - 1)));
                }}
                size="sm"
              />

              {relationship?.connectionStatus === 'connected' ? (
                <Badge tone="ok">Connected</Badge>
              ) : relationship?.connectionStatus === 'pending' ? (
                <Badge tone="warn">Pending</Badge>
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
                  Meet
                </Button>
              )}

              {relationship?.canMessage && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    try {
                      const chat = await api.chats.getWithUser(effectiveUserId);
                      navigate(`/mobile/messages?chatId=${chat._id}`);
                    } catch {
                      navigate('/mobile/messages');
                    }
                  }}
                  leftIcon={<MessageCircle size={13} />}
                >
                  Message
                </Button>
              )}

              <div className="ml-auto flex items-center gap-1">
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
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setBlockModalOpen(true)}
                    className="text-dim hover:text-sos"
                    title="Block User"
                  >
                    <Lock size={13} />
                  </Button>
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setReportModalOpen(true)}
                  className="text-dim hover:text-sos"
                  title="Report User"
                >
                  <ShieldAlert size={13} />
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* User Posts Stream */}
      <div className="space-y-3">
        <h3 className="font-display text-xs font-bold uppercase tracking-wider text-ink px-1 flex items-center gap-1.5">
          <Sparkles size={14} className="text-amber" />
          <span>{isOwnProfile ? 'Your Posts' : `${u?.name}'s Posts`}</span>
          <span className="font-mono text-[10px] text-dim">({postsTotal})</span>
        </h3>

        {posts.length === 0 ? (
          <div className="rounded-3xl border border-line-soft bg-night-850/60 p-8 text-center text-xs text-mute space-y-2">
            <p className="font-bold text-ink">No posts published yet</p>
            <p className="text-[11px]">
              {isOwnProfile
                ? 'Share your first photo, thought, or meetup plan!'
                : `${u?.name} hasn't posted anything publicly yet.`}
            </p>
          </div>
        ) : (
          posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onPostDeleted={handlePostDeleted}
            />
          ))
        )}
      </div>

      {/* Followers Modal */}
      {followersModalOpen && (
        <UserListModal
          open={followersModalOpen}
          onClose={() => setFollowersModalOpen(false)}
          title={`Followers of ${u?.name}`}
          userId={effectiveUserId}
          type="followers"
        />
      )}

      {/* Following Modal */}
      {followingModalOpen && (
        <UserListModal
          open={followingModalOpen}
          onClose={() => setFollowingModalOpen(false)}
          title={`People followed by ${u?.name}`}
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
          targetName={u?.name}
          onBlocked={() => navigate('/mobile')}
        />
      )}

      {/* Report Modal */}
      {reportModalOpen && (
        <ReportModal
          open={reportModalOpen}
          onClose={() => setReportModalOpen(false)}
          targetType="user"
          targetId={effectiveUserId}
          targetName={u?.name}
        />
      )}

      {/* Change Password Modal */}
      {pwdModalOpen && (
        <Modal
          open={pwdModalOpen}
          onClose={() => setPwdModalOpen(false)}
          title="Change Password"
          description="Update your account credentials"
        >
          <form onSubmit={handleChangePassword} className="space-y-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-ink mb-1">
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
              <label className="block text-xs font-semibold text-ink mb-1">
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

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setPwdModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={submittingPwd || !oldPassword || !newPassword}
              >
                {submittingPwd ? 'Saving...' : 'Update Password'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Account Modal */}
      {deleteModalOpen && (
        <Modal
          open={deleteModalOpen}
          onClose={() => setDeleteModalOpen(false)}
          title="Delete Account"
          description="Permanently delete your profile and data."
        >
          <form onSubmit={handleDeleteAccount} className="space-y-4 pt-1">
            <div className="rounded-xl border border-sos/30 bg-sos/10 p-3 text-xs text-sos leading-relaxed">
              <strong>Warning:</strong> This action cannot be undone. All your posts, conversations, active safety timers, and emergency contacts will be permanently purged.
            </div>
            <div>
              <label className="block font-mono text-[10px] uppercase text-dim mb-1">
                Type <span className="font-bold text-ink">DELETE</span> to confirm:
              </label>
              <input
                type="text"
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                placeholder="DELETE"
                required
                className="w-full rounded-xl border border-line bg-night-900 p-2.5 text-xs text-ink outline-none focus:border-sos"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-line-soft">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setDeleteModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={deletingAccount || deleteConfirmation.trim().toUpperCase() !== 'DELETE'}
                className="!bg-sos !text-white hover:!bg-sos/80"
              >
                {deletingAccount ? 'Deleting...' : 'Permanently Delete'}
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
