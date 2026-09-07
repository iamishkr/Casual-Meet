import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { engine, useEngine } from '../../lib/engine';
import type { Relationship } from '../../lib/types';
import { isIndianNumber, isValidPhone } from '../../lib/utils';
import { Avatar, Badge, Btn, Field, I, Modal, Seg, Toggle, inputCls } from '../ui';

export default function ProfileScreen() {
  const { logout } = useAuth();
  const state = useEngine();
  const me = engine.persona();
  const myContacts = state.contacts.filter((c) => c.userId === me.id);
  const verif = state.verifications.find((v) => v.userId === me.id && v.status === 'pending');
  const rejected = state.verifications.find((v) => v.userId === me.id && v.status === 'rejected');
  const [addOpen, setAddOpen] = useState(false);
  const [camOpen, setCamOpen] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', relationship: 'family' as Relationship });
  const [err, setErr] = useState<{ name?: string; phone?: string }>({});

  const submitContact = () => {
    const e: typeof err = {};
    if (form.name.trim().length < 2) e.name = 'Name is required';
    if (!isValidPhone(form.phone)) e.phone = 'Use E.164 (+…) or a 10-digit Indian number';
    setErr(e);
    if (Object.keys(e).length) return;
    engine.addContact(form);
    setForm({ name: '', phone: '', relationship: 'family' });
    setAddOpen(false);
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="space-y-3 px-4 pt-3 pb-5">
        {/* identity card */}
        <div className="rounded-2xl border border-line-soft bg-night-800/60 p-4">
          <div className="flex items-center gap-3.5">
            <Avatar user={me} size={58} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="truncate font-display text-lg font-extrabold">{me.name}</p>
                {me.isVerified && <span className="text-sky" title="Identity verified"><I.logo size={15} strokeWidth={2.3} /></span>}
              </div>
              <p className="text-xs text-mute">@{me.username} · {me.occupation}</p>
              <p className="text-[11px] text-dim">{me.city}</p>
            </div>
          </div>
          <p className="mt-2.5 text-xs leading-relaxed text-mute">{me.bio}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">{me.interests.map((i) => <span key={i} className="chip">{i}</span>)}</div>
          <div className="mt-3">
            <div className="mb-1 flex justify-between font-mono text-[10px] uppercase tracking-widest text-dim">
              <span>Trust score</span><span className="text-safe">{me.trustScore} / 150</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-night-900">
              <div className="h-full rounded-full bg-gradient-to-r from-safe to-sky transition-all duration-700" style={{ width: `${Math.min(100, (me.trustScore / 150) * 100)}%` }} />
            </div>
          </div>
        </div>

        {/* privacy */}
        <div className="rounded-2xl border border-line-soft bg-night-800/60 p-3.5">
          <p className="mb-2.5 font-mono text-[10px] uppercase tracking-widest text-dim">Location & message privacy</p>
          <div className="flex items-center justify-between rounded-lg border border-line-soft bg-night-900/60 px-3 py-2.5">
            <div>
              <p className="flex items-center gap-1.5 text-xs font-bold">{me.showLocation ? <I.eye size={13} className="text-safe" /> : <I.eyeOff size={13} className="text-amber" />} Visible in discovery</p>
              <p className="text-[10px] text-dim">{me.showLocation ? 'Included in $geoNear results' : 'Excluded from every discovery feed'}</p>
            </div>
            <Toggle on={me.showLocation} onChange={(v) => engine.toggleShowLocation(v)} />
          </div>
          <div className="mt-2.5 flex items-center justify-between gap-2 rounded-lg border border-line-soft bg-night-900/60 px-3 py-2.5">
            <div>
              <p className="text-xs font-bold">Who can message me</p>
              <p className="text-[10px] text-dim">Gate enforced server-side on every send</p>
            </div>
            <Seg size="sm" value={me.allowMessages} onChange={(v) => engine.setAllowMessages(v)} options={[
              { value: 'everyone', label: 'All' }, { value: 'connections', label: 'Conns' }, { value: 'none', label: 'None' },
            ]} />
          </div>
        </div>

        {/* emergency contacts */}
        <div className="rounded-2xl border border-line-soft bg-night-800/60 p-3.5">
          <div className="mb-2.5 flex items-center justify-between">
            <p className="font-mono text-[10px] uppercase tracking-widest text-dim">Emergency contacts · {myContacts.length}/5</p>
            <Btn size="sm" tone="outline" onClick={() => setAddOpen(true)} disabled={myContacts.length >= 5}><I.plus size={12} /> Add</Btn>
          </div>
          {myContacts.length === 0 && <p className="rounded-lg border border-dashed border-line px-3 py-4 text-center text-[11px] text-dim">No contacts yet — an SOS without contacts can only alert admins.</p>}
          <div className="space-y-1.5">
            {myContacts.map((c) => (
              <div key={c.id} className="flex items-center gap-2.5 rounded-lg border border-line-soft bg-night-900/60 px-2.5 py-2">
                <I.phone size={14} className="shrink-0 text-sos" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-semibold">{c.name}</p>
                  <p className="font-mono text-[9px] text-dim">{c.phone.slice(0, 3)}·····{c.phone.slice(-3)} · {c.relationship}</p>
                </div>
                <Badge tone={isIndianNumber(c.phone) ? 'warn' : 'info'}>{isIndianNumber(c.phone) ? 'Fast2SMS' : 'Twilio'}</Badge>
                <button onClick={() => engine.removeContact(c.id)} className="btn-press rounded p-1 text-dim hover:text-sos"><I.x size={13} /></button>
              </div>
            ))}
          </div>
        </div>

        {/* verification */}
        <div className="rounded-2xl border border-line-soft bg-night-800/60 p-3.5">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-dim"><I.id size={13} /> Identity verification</p>
            {me.isVerified ? <Badge tone="ok">verified</Badge> : verif ? <Badge tone="warn">in review</Badge> : rejected ? <Badge tone="err">rejected</Badge> : <Badge tone="dim">unverified</Badge>}
          </div>
          {me.isVerified ? (
            <p className="mt-2 text-[11px] text-mute">Selfie matched your profile photo. Trust score boosted +20. Badge visible on your cards.</p>
          ) : verif ? (
            <p className="mt-2 text-[11px] text-mute">Your live selfie is in the admin moderation queue. Only one pending request is allowed — enforced by a partial unique index.</p>
          ) : (
            <>
              {rejected && <p className="mt-2 rounded-lg border border-sos/30 bg-sos/10 px-2.5 py-1.5 text-[11px] text-sos">Rejected: “{rejected.reviewNote}” — you can submit a new selfie.</p>}
              <p className="mt-2 text-[11px] text-mute">Front-camera live capture only (gallery uploads refused). Max 5MB, JPEG/PNG.</p>
              <Btn tone="amber" size="md" className="mt-2.5 w-full" onClick={() => setCamOpen(true)}><I.camera size={15} /> {rejected ? 'Resubmit selfie' : 'Verify with a live selfie'}</Btn>
            </>
          )}
        </div>

        {/* Account & Session */}
        <div className="rounded-2xl border border-line-soft bg-night-800/60 p-3.5">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-dim">Account & Session</p>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-ink">Signed in as @{me.username}</p>
              <p className="truncate text-[10px] text-mute">{me.email}</p>
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

      {/* add contact modal */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Emergency contact">
        <div className="space-y-3">
          <Field label="Full name" error={err.name}>
            <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Nandini Rao (Sister)" />
          </Field>
          <Field label="Phone (E.164 or 10-digit)" error={err.phone}>
            <input className={inputCls} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91 98XXXXXXXX or +1 415…" />
          </Field>
          <Field label="Relationship">
            <select className={inputCls} value={form.relationship} onChange={(e) => setForm({ ...form, relationship: e.target.value as Relationship })}>
              {['family', 'friend', 'partner', 'colleague', 'other'].map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </Field>
          <p className="text-[11px] text-dim">+91 numbers route through Fast2SMS; everything else goes out via Twilio. Delivery is logged per contact with retries.</p>
          <div className="flex justify-end gap-2">
            <Btn tone="ghost" onClick={() => setAddOpen(false)}>Cancel</Btn>
            <Btn tone="amber" onClick={submitContact}>Save contact</Btn>
          </div>
        </div>
      </Modal>

      <CameraModal open={camOpen} onClose={() => setCamOpen(false)} />
    </div>
  );
}

function CameraModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [stage, setStage] = useState<'aim' | 'flash' | 'done'>('aim');
  const me = engine.persona();
  const capture = () => {
    setStage('flash');
    setTimeout(() => setStage('done'), 450);
    setTimeout(() => {
      engine.submitVerification();
      setStage('aim');
      onClose();
    }, 1300);
  };
  return (
    <Modal open={open} onClose={() => { setStage('aim'); onClose(); }} title="Live selfie check">
      <div className="relative mx-auto aspect-[3/4] w-52 overflow-hidden rounded-2xl border border-line bg-night-950">
        {/* viewfinder */}
        <div className="absolute inset-0 flex items-center justify-center">
          <svg width="110" height="130" viewBox="0 0 110 130" fill="none" stroke="rgba(142,161,191,0.5)" strokeWidth="1.6">
            <ellipse cx="55" cy="52" rx="30" ry="36" />
            <path d="M20 122c6-22 18-32 35-32s29 10 35 32" />
          </svg>
        </div>
        {/* corner brackets */}
        {['top-2 left-2 border-t-2 border-l-2', 'top-2 right-2 border-t-2 border-r-2', 'bottom-2 left-2 border-b-2 border-l-2', 'bottom-2 right-2 border-b-2 border-r-2'].map((c) => (
          <span key={c} className={`absolute h-6 w-6 rounded-sm border-amber ${c}`} />
        ))}
        {/* scan line */}
        <span className="absolute left-3 right-3 h-px bg-gradient-to-r from-transparent via-safe to-transparent"
          style={{ animation: 'scan-y 2.2s ease-in-out infinite alternate' }} />
        {stage === 'flash' && <span className="anim-fade absolute inset-0 bg-white/90" />}
        {stage === 'done' && (
          <span className="anim-fade absolute inset-0 flex flex-col items-center justify-center gap-2 bg-night-950/85 text-safe">
            <I.check size={30} strokeWidth={2.4} />
            <span className="font-mono text-[10px] uppercase tracking-widest">liveness passed · uploading</span>
          </span>
        )}
        <span className="absolute left-2 top-2 chip !text-[8px] text-safe">FRONT CAM ONLY</span>
      </div>
      <p className="mt-3 text-center text-[11px] text-mute">Hi {me.name.split(' ')[0]} — align your face inside the frame. Gallery uploads are rejected by the uploader.</p>
      <Btn tone="amber" size="lg" className="mt-3 w-full" disabled={stage !== 'aim'} onClick={capture}>
        <I.camera size={16} /> {stage === 'aim' ? 'Capture selfie' : 'Processing…'}
      </Btn>
    </Modal>
  );
}
