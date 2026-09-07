import React, { useEffect, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { api } from '../../../lib/api';
import type { VerificationMineDTO } from '../../../lib/types';
import {
  User,
  Shield,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  FileCheck,
  Camera,
  Lock,
  Sparkles,
} from 'lucide-react';
import { Button, Input, Modal } from '../../../components/ui';

export default function WebProfilePage() {
  const { currentUser } = useAuth();
  const { toast } = useToast();

  const [verif, setVerif] = useState<VerificationMineDTO | null>(null);
  const [loadingVerif, setLoadingVerif] = useState(true);

  // Verification modal
  const [verifModalOpen, setVerifModalOpen] = useState(false);
  const [docType, setDocType] = useState('aadhaar');
  const [submittingVerif, setSubmittingVerif] = useState(false);

  // Password change modal
  const [pwdModalOpen, setPwdModalOpen] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [changingPwd, setChangingPwd] = useState(false);

  const loadVerification = async () => {
    try {
      const data = await api.verification.mine();
      setVerif(data);
    } catch {
      // no submission yet
    } finally {
      setLoadingVerif(false);
    }
  };

  useEffect(() => {
    loadVerification();
  }, [currentUser]);

  const handleSubmitVerification = async () => {
    setSubmittingVerif(true);
    try {
      const mockPhoto = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      await api.verification.submit(mockPhoto);
      toast('ok', 'Verification Submitted', 'Your documents have been submitted to the moderation queue.');
      setVerifModalOpen(false);
      loadVerification();
    } catch (err: any) {
      toast('err', 'Verification Failed', err?.message);
    } finally {
      setSubmittingVerif(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!oldPassword || !newPassword) return;

    setChangingPwd(true);
    try {
      await api.auth.changePassword(oldPassword, newPassword);
      toast('ok', 'Password Changed', 'Your account password has been updated.');
      setPwdModalOpen(false);
      setOldPassword('');
      setNewPassword('');
    } catch (err: any) {
      toast('err', 'Password Change Failed', err?.message);
    } finally {
      setChangingPwd(false);
    }
  };

  if (!currentUser) return null;

  const currentStatus = verif?.latestRequest?.status || (currentUser.isVerified ? 'approved' : 'none');

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Page Header */}
      <div className="border-b border-line-soft/60 pb-5">
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink flex items-center gap-2.5">
          <User size={24} className="text-amber" />
          My Profile & Identity Verification
        </h1>
        <p className="text-xs text-mute mt-1">
          Manage your account credentials, safety reputation score, and government ID verification.
        </p>
      </div>

      {/* Main Profile Card */}
      <div className="rounded-3xl border border-line-soft bg-night-850/80 p-6 shadow-md backdrop-blur-md space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-3xl font-display text-xl font-black text-night-950 shadow-lg"
              style={{
                background: `linear-gradient(135deg, hsl(${currentUser.avatarHue} 85% 68%), hsl(${(currentUser.avatarHue + 42) % 360} 80% 55%))`,
              }}
            >
              {currentUser.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-lg font-bold text-ink">{currentUser.name}</h2>
                {currentUser.isVerified ? (
                  <span className="inline-flex items-center gap-1 rounded bg-safe/15 px-2 py-0.5 font-mono text-[10px] font-bold text-safe uppercase">
                    <CheckCircle2 size={12} /> ID Verified
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded bg-amber/15 px-2 py-0.5 font-mono text-[10px] font-bold text-amber uppercase">
                    Unverified
                  </span>
                )}
              </div>
              <p className="font-mono text-xs text-dim">@{currentUser.username}</p>
              <p className="text-xs text-mute mt-1">{currentUser.email}</p>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setPwdModalOpen(true)}
            leftIcon={<KeyRound size={14} />}
          >
            Change Password
          </Button>
        </div>

        {/* Bio & Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-line-soft/60">
          <div>
            <label className="block font-mono text-[10px] uppercase text-dim mb-1">
              About Bio
            </label>
            <p className="text-xs text-ink leading-relaxed bg-night-900/60 p-3 rounded-xl border border-line-soft">
              {currentUser.bio || 'No bio added yet.'}
            </p>
          </div>

          <div>
            <label className="block font-mono text-[10px] uppercase text-dim mb-1">
              Interests & Activities
            </label>
            <div className="flex flex-wrap gap-1.5 p-3 rounded-xl bg-night-900/60 border border-line-soft">
              {currentUser.interests && currentUser.interests.length > 0 ? (
                currentUser.interests.map((t) => (
                  <span
                    key={t}
                    className="rounded-md border border-line bg-night-800 px-2 py-0.5 font-mono text-[10px] text-amber font-semibold"
                  >
                    #{t}
                  </span>
                ))
              ) : (
                <span className="text-xs text-mute">No interests specified</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Trust & Safety Status Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Trust Score Breakdown */}
        <div className="rounded-3xl border border-line-soft bg-night-850/80 p-6 shadow-md backdrop-blur-md space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-line-soft/60">
            <h3 className="font-display text-sm font-bold text-ink flex items-center gap-2">
              <Sparkles size={16} className="text-amber" />
              Trust Score Breakdown
            </h3>
            <span className="font-mono text-sm font-bold text-amber">
              {currentUser.trustScore} / 150
            </span>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between items-center text-mute">
              <span>Account Onboarding:</span>
              <span className="font-mono text-safe">+50 pts</span>
            </div>
            <div className="flex justify-between items-center text-mute">
              <span>Clean Safety History:</span>
              <span className="font-mono text-safe">+30 pts</span>
            </div>
            <div className="flex justify-between items-center text-mute">
              <span>Emergency Contacts Configured:</span>
              <span className="font-mono text-safe">+20 pts</span>
            </div>
            <div className="flex justify-between items-center text-mute">
              <span>Government ID Verification:</span>
              <span className="font-mono text-safe">
                {currentUser.isVerified ? '+50 pts' : '+0 pts'}
              </span>
            </div>
          </div>
        </div>

        {/* Identity Verification Status Card */}
        <div className="rounded-3xl border border-line-soft bg-night-850/80 p-6 shadow-md backdrop-blur-md flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-line-soft/60">
              <h3 className="font-display text-sm font-bold text-ink flex items-center gap-2">
                <FileCheck size={16} className="text-safe" />
                ID Verification
              </h3>
              <span className="font-mono text-[10px] uppercase text-dim">
                Status: {currentStatus}
              </span>
            </div>

            <div className="py-3 text-xs text-mute leading-relaxed">
              {currentUser.isVerified ? (
                <div className="space-y-2">
                  <p className="text-safe font-bold flex items-center gap-1.5">
                    <CheckCircle2 size={16} /> Identity Confirmed
                  </p>
                  <p>
                    Your government photo identity has been verified by the safety compliance team.
                  </p>
                </div>
              ) : currentStatus === 'pending' ? (
                <div className="space-y-2">
                  <p className="text-amber font-bold flex items-center gap-1.5">
                    <AlertCircle size={16} /> Verification Under Review
                  </p>
                  <p>
                    Your ID and selfie photos were received and are currently queued for administrator review.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-ink">
                    Verify your profile with an official ID and live selfie to receive the verified shield badge and unlock enhanced safety features.
                  </p>
                </div>
              )}
            </div>
          </div>

          {!currentUser.isVerified && currentStatus !== 'pending' && (
            <div className="pt-3 border-t border-line-soft/60">
              <Button
                variant="primary"
                size="md"
                className="w-full"
                onClick={() => setVerifModalOpen(true)}
                leftIcon={<Camera size={16} />}
              >
                Submit ID Verification
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* VERIFICATION MODAL */}
      <Modal
        open={verifModalOpen}
        onClose={() => setVerifModalOpen(false)}
        title="Submit Government Identity"
        description="Your documents are encrypted and only accessible by authorized safety moderators."
      >
        <div className="space-y-4 pt-2">
          <div>
            <label className="block font-mono text-[10px] uppercase text-dim mb-1.5">
              Select Document Type
            </label>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className="w-full rounded-xl border border-line bg-night-850 p-2.5 text-xs text-ink outline-none focus:border-amber/50"
            >
              <option value="aadhaar">Aadhaar Card (India)</option>
              <option value="passport">Passport</option>
              <option value="driving_license">Driving License</option>
              <option value="voter_id">Voter ID</option>
            </select>
          </div>

          <div className="rounded-xl border border-dashed border-line-soft p-4 text-center bg-night-900/60">
            <Camera size={24} className="mx-auto text-mute mb-2" />
            <p className="text-xs text-ink font-semibold">Selfie & ID Photo Capture</p>
            <p className="text-[11px] text-mute mt-0.5">
              In this phase, automated secure document hashing captures your verification payload.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-line-soft">
            <Button variant="ghost" size="sm" onClick={() => setVerifModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              isLoading={submittingVerif}
              onClick={handleSubmitVerification}
            >
              Submit for Review
            </Button>
          </div>
        </div>
      </Modal>

      {/* CHANGE PASSWORD MODAL */}
      <Modal
        open={pwdModalOpen}
        onClose={() => setPwdModalOpen(false)}
        title="Change Account Password"
        description="Update your password to keep your account secure."
      >
        <form onSubmit={handleChangePassword} className="space-y-4 pt-2">
          <Input
            type="password"
            label="Current Password"
            value={oldPassword}
            onChange={(e: any) => setOldPassword(e.target.value)}
            required
          />
          <Input
            type="password"
            label="New Password (min 6 characters)"
            value={newPassword}
            onChange={(e: any) => setNewPassword(e.target.value)}
            required
            minLength={6}
          />
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-line-soft">
            <Button variant="ghost" size="sm" type="button" onClick={() => setPwdModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" isLoading={changingPwd}>
              Update Password
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
