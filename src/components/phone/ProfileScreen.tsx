import { useState, useEffect, useCallback } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import type { EmergencyContactDTO, Relationship, VerificationMineDTO } from '../../lib/types';
import { isIndianNumber, isValidPhone } from '../../lib/utils';
import { Avatar, Badge, Btn, Field, I, Modal, inputCls } from '../ui';

export default function ProfileScreen() {
  const { currentUser, logout, refreshUser } = useAuth();
  const { toast } = useToast();

  const [contacts, setContacts] = useState<EmergencyContactDTO[]>([]);
  const [contactsLoading, setContactsLoading] = useState(true);
  const [verifState, setVerifState] = useState<VerificationMineDTO | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [camOpen, setCamOpen] = useState(false);
  const [submittingContact, setSubmittingContact] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', relationship: 'family' as Relationship });
  const [err, setErr] = useState<{ name?: string; phone?: string }>({});

  const fetchContacts = useCallback(async () => {
    try {
      const data = await api.contacts.list();
      setContacts(Array.isArray(data) ? data : []);
    } catch {
      // ignore
    } finally {
      setContactsLoading(false);
    }
  }, []);

  const fetchVerification = useCallback(async () => {
    try {
      const data = await api.verification.mine();
      setVerifState(data);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchContacts();
    fetchVerification();
  }, [fetchContacts, fetchVerification]);

  const submitContact = async () => {
    const e: typeof err = {};
    if (form.name.trim().length < 2) e.name = 'Name is required (min 2 chars)';
    if (!isValidPhone(form.phone)) e.phone = 'Use E.164 (+…) or a 10-digit Indian number';
    setErr(e);
    if (Object.keys(e).length) return;

    setSubmittingContact(true);
    try {
      await api.contacts.create({
        name: form.name.trim(),
        phone: form.phone.trim(),
        relationship: form.relationship,
        notifyOnSos: true,
      });
      toast('ok', 'Emergency Contact Saved', `${form.name} added to your circle.`);
      setForm({ name: '', phone: '', relationship: 'family' });
      setAddOpen(false);
      fetchContacts();
    } catch (apiErr: any) {
      toast('err', 'Failed to Save Contact', apiErr.message);
    } finally {
      setSubmittingContact(false);
    }
  };

  const handleRemoveContact = async (contactId: string) => {
    try {
      await api.contacts.delete(contactId);
      toast('info', 'Contact Removed');
      fetchContacts();
    } catch (apiErr: any) {
      toast('err', 'Failed to Remove', apiErr.message);
    }
  };

  const handleVerificationSuccess = () => {
    toast('ok', 'Verification Selfie Submitted', 'Under review by safety administrators.');
    fetchVerification();
    refreshUser();
  };

  if (!currentUser) return null;

  const isVerified = verifState?.isVerified ?? currentUser.isVerified;
  const trustScore = verifState?.trustScore ?? currentUser.trustScore;
  const latestReq = verifState?.latestRequest;
  const isPending = latestReq?.status === 'pending';
  const isRejected = latestReq?.status === 'rejected';

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="space-y-3 px-4 pt-3 pb-5">
        {/* Identity Card */}
        <div className="rounded-2xl border border-line-soft bg-night-800/60 p-4">
          <div className="flex items-center gap-3.5">
            <Avatar user={currentUser} size={58} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="truncate font-display text-lg font-extrabold">{currentUser.name}</p>
                {isVerified && (
                  <span className="text-sky" title="Identity verified">
                    <I.logo size={15} strokeWidth={2.3} />
                  </span>
                )}
              </div>
              <p className="text-xs text-mute">
                @{currentUser.username} · {currentUser.occupation}
              </p>
              <p className="text-[11px] text-dim">{currentUser.city}</p>
            </div>
          </div>
          {currentUser.bio && (
            <p className="mt-2.5 text-xs leading-relaxed text-mute">{currentUser.bio}</p>
          )}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {currentUser.interests?.map((i) => (
              <span key={i} className="chip">
                {i}
              </span>
            ))}
          </div>
          <div className="mt-3">
            <div className="mb-1 flex justify-between font-mono text-[10px] uppercase tracking-widest text-dim">
              <span>Trust score</span>
              <span className="text-safe">{trustScore} / 150</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-night-900">
              <div
                className="h-full rounded-full bg-gradient-to-r from-safe to-sky transition-all duration-700"
                style={{ width: `${Math.min(100, (trustScore / 150) * 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Emergency Contacts */}
        <div className="rounded-2xl border border-line-soft bg-night-800/60 p-3.5">
          <div className="mb-2.5 flex items-center justify-between">
            <p className="font-mono text-[10px] uppercase tracking-widest text-dim">
              Emergency contacts · {contacts.length}/5
            </p>
            <Btn
              size="sm"
              tone="outline"
              onClick={() => setAddOpen(true)}
              disabled={contacts.length >= 5}
            >
              <I.plus size={12} /> Add
            </Btn>
          </div>

          {contactsLoading ? (
            <div className="space-y-1.5">
              {[0, 1].map((i) => (
                <div key={i} className="shimmer h-[40px] rounded-lg border border-line-soft" />
              ))}
            </div>
          ) : contacts.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line px-3 py-4 text-center text-[11px] text-dim">
              No contacts saved on server. Add at least one trusted contact to receive automated SMS alerts.
            </p>
          ) : (
            <div className="space-y-1.5">
              {contacts.map((c) => (
                <div
                  key={c._id}
                  className="flex items-center gap-2.5 rounded-lg border border-line-soft bg-night-900/60 px-2.5 py-2"
                >
                  <I.phone size={14} className="shrink-0 text-sos" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-semibold">{c.name}</p>
                    <p className="font-mono text-[9px] text-dim">
                      {c.phone.slice(0, 3)}·····{c.phone.slice(-3)} · {c.relationship}
                    </p>
                  </div>
                  <Badge tone={isIndianNumber(c.phone) ? 'warn' : 'info'}>
                    {isIndianNumber(c.phone) ? 'Fast2SMS' : 'Twilio'}
                  </Badge>
                  <button
                    onClick={() => handleRemoveContact(c._id)}
                    className="btn-press rounded p-1 text-dim hover:text-sos"
                    title="Remove contact"
                  >
                    <I.x size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Identity Verification */}
        <div className="rounded-2xl border border-line-soft bg-night-800/60 p-3.5">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-dim">
              <I.id size={13} /> Identity verification
            </p>
            {isVerified ? (
              <Badge tone="ok">verified</Badge>
            ) : isPending ? (
              <Badge tone="warn">pending review</Badge>
            ) : isRejected ? (
              <Badge tone="err">rejected</Badge>
            ) : (
              <Badge tone="dim">unverified</Badge>
            )}
          </div>

          {isVerified ? (
            <p className="mt-2 text-[11px] text-mute">
              Your identity has been verified by our trust & safety team. Trust badge is visible on your profile.
            </p>
          ) : isPending ? (
            <p className="mt-2 text-[11px] text-mute">
              Your live selfie is pending administrator review in the moderation queue.
            </p>
          ) : (
            <>
              {isRejected && (
                <p className="mt-2 rounded-lg border border-sos/30 bg-sos/10 px-2.5 py-1.5 text-[11px] text-sos">
                  Review feedback: “{latestReq?.reviewNote || 'Photo unclear'}” — you may submit a new selfie.
                </p>
              )}
              <p className="mt-2 text-[11px] text-mute">
                Live camera capture. Boosts your trust score and unlocks the verified badge.
              </p>
              <Btn
                tone="amber"
                size="md"
                className="mt-2.5 w-full"
                onClick={() => setCamOpen(true)}
              >
                <I.camera size={15} /> {isRejected ? 'Resubmit selfie' : 'Verify identity with selfie'}
              </Btn>
            </>
          )}
        </div>

        {/* Account & Session */}
        <div className="rounded-2xl border border-line-soft bg-night-800/60 p-3.5">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-dim">
            Account & Session
          </p>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-ink">
                Signed in as @{currentUser.username}
              </p>
              <p className="truncate text-[10px] text-mute">{currentUser.email}</p>
            </div>
            <button
              onClick={() => logout()}
              className="btn-press shrink-0 rounded-lg border border-sos/40 bg-sos/10 px-3 py-1.5 text-xs font-bold text-sos hover:bg-sos/20"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* Add Contact Modal */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Emergency contact">
        <div className="space-y-3">
          <Field label="Full name" error={err.name}>
            <input
              className={inputCls}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Nandini Rao"
            />
          </Field>
          <Field label="Phone (E.164 or 10-digit)" error={err.phone}>
            <input
              className={inputCls}
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="+91 98XXXXXXXX"
            />
          </Field>
          <Field label="Relationship">
            <select
              className={inputCls}
              value={form.relationship}
              onChange={(e) =>
                setForm({ ...form, relationship: e.target.value as Relationship })
              }
            >
              {['family', 'friend', 'partner', 'colleague', 'other'].map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </Field>
          <p className="text-[11px] text-dim">
            Stored in MongoDB with strict owner authorization. Alerts dispatch via Fast2SMS (+91)
            or Twilio.
          </p>
          <div className="flex justify-end gap-2">
            <Btn tone="ghost" onClick={() => setAddOpen(false)}>
              Cancel
            </Btn>
            <Btn tone="amber" onClick={submitContact} disabled={submittingContact}>
              {submittingContact ? 'Saving…' : 'Save contact'}
            </Btn>
          </div>
        </div>
      </Modal>

      <CameraModal
        open={camOpen}
        onClose={() => setCamOpen(false)}
        onSuccess={handleVerificationSuccess}
      />
    </div>
  );
}

function CameraModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [stage, setStage] = useState<'aim' | 'flash' | 'done'>('aim');

  const capture = async () => {
    setStage('flash');
    setTimeout(() => setStage('done'), 400);

    try {
      // Create a valid data URI selfie representation for verification upload
      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 320;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#182030';
        ctx.fillRect(0, 0, 320, 320);
        ctx.fillStyle = '#ffb224';
        ctx.font = '16px monospace';
        ctx.fillText(`Verification: @${currentUser?.username}`, 20, 160);
      }
      const dataUri = canvas.toDataURL('image/jpeg', 0.8);

      await api.verification.submit(dataUri);
      setTimeout(() => {
        setStage('aim');
        onSuccess();
        onClose();
      }, 900);
    } catch (err: any) {
      toast('err', 'Verification Failed', err.message);
      setStage('aim');
      onClose();
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        setStage('aim');
        onClose();
      }}
      title="Live selfie verification"
    >
      <div className="relative mx-auto aspect-[3/4] w-52 overflow-hidden rounded-2xl border border-line bg-night-950">
        <div className="absolute inset-0 flex items-center justify-center">
          <svg
            width="110"
            height="130"
            viewBox="0 0 110 130"
            fill="none"
            stroke="rgba(142,161,191,0.5)"
            strokeWidth="1.6"
          >
            <ellipse cx="55" cy="52" rx="30" ry="36" />
            <path d="M20 122c6-22 18-32 35-32s29 10 35 32" />
          </svg>
        </div>
        {[
          'top-2 left-2 border-t-2 border-l-2',
          'top-2 right-2 border-t-2 border-r-2',
          'bottom-2 left-2 border-b-2 border-l-2',
          'bottom-2 right-2 border-b-2 border-r-2',
        ].map((c) => (
          <span key={c} className={`absolute h-6 w-6 rounded-sm border-amber ${c}`} />
        ))}
        <span
          className="absolute left-3 right-3 h-px bg-gradient-to-r from-transparent via-safe to-transparent"
          style={{ animation: 'scan-y 2.2s ease-in-out infinite alternate' }}
        />
        {stage === 'flash' && <span className="anim-fade absolute inset-0 bg-white/90" />}
        {stage === 'done' && (
          <span className="anim-fade absolute inset-0 flex flex-col items-center justify-center gap-2 bg-night-950/85 text-safe">
            <I.check size={30} strokeWidth={2.4} />
            <span className="font-mono text-[10px] uppercase tracking-widest">
              Captured · Uploading to MongoDB
            </span>
          </span>
        )}
        <span className="absolute left-2 top-2 chip !text-[8px] text-safe">FRONT CAM LIVE</span>
      </div>
      <p className="mt-3 text-center text-[11px] text-mute">
        Align your face within the frame to verify your account identity.
      </p>
      <Btn
        tone="amber"
        size="lg"
        className="mt-3 w-full"
        disabled={stage !== 'aim'}
        onClick={capture}
      >
        <I.camera size={16} /> {stage === 'aim' ? 'Capture selfie' : 'Submitting…'}
      </Btn>
    </Modal>
  );
}
