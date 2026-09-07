import React, { useEffect, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useData } from '../../../context/DataContext';
import { useToast } from '../../../context/ToastContext';
import { api } from '../../../lib/api';
import type { EmergencyContactDTO, SafeZoneDTO } from '../../../lib/types';
import {
  Shield,
  ShieldAlert,
  Clock,
  MapPin,
  Users,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  PhoneCall,
  Check,
} from 'lucide-react';
import { Button, Input, Modal } from '../../../components/ui';
import { fmtCountdown } from '../../../lib/utils';

export default function WebSafetyPage() {
  const { currentUser } = useAuth();
  const { activeSos, activeTimer, markTimerSafe, extendTimer, triggerSos, resolveSos } = useData();
  const { toast } = useToast();

  const [contacts, setContacts] = useState<EmergencyContactDTO[]>([]);
  const [safeZones, setSafeZones] = useState<SafeZoneDTO[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(true);

  // Modal states
  const [startTimerOpen, setStartTimerOpen] = useState(false);
  const [timerDuration, setTimerDuration] = useState(30);
  const [selectedLocation, setSelectedLocation] = useState('Central Perk Cafe');

  const [addContactOpen, setAddContactOpen] = useState(false);
  const [newContact, setNewContact] = useState({ name: '', phone: '', relationship: 'Friend' });

  const [visualClock, setVisualClock] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setVisualClock(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const loadSafetyData = async () => {
    try {
      const [cList, zList] = await Promise.all([
        api.contacts.list(),
        api.safeZones.list(),
      ]);
      setContacts(cList);
      setSafeZones(zList);
    } catch (err: any) {
      toast('err', 'Failed to Load Safety Data', err?.message);
    } finally {
      setLoadingContacts(false);
    }
  };

  useEffect(() => {
    loadSafetyData();
  }, [currentUser]);

  // Start Meeting Timer
  const handleStartTimer = async () => {
    try {
      await api.timers.start({
        durationMinutes: timerDuration,
        locationName: selectedLocation,
      });
      toast('ok', 'Meeting Timer Started', `Active check-in timer set for ${timerDuration} mins.`);
      setStartTimerOpen(false);
    } catch (err: any) {
      toast('err', 'Timer Start Error', err?.message);
    }
  };

  // Add Contact
  const handleAddContact = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newContact.name || !newContact.phone) return;

    try {
      const created = await api.contacts.create({
        name: newContact.name,
        phone: newContact.phone,
        relationship: newContact.relationship as any,
      });
      setContacts((prev) => [...prev, created]);
      setNewContact({ name: '', phone: '', relationship: 'Friend' });
      setAddContactOpen(false);
      toast('ok', 'Emergency Contact Added', `${created.name} will be notified in emergencies.`);
    } catch (err: any) {
      toast('err', 'Failed to Add Contact', err?.message);
    }
  };

  // Delete Contact
  const handleDeleteContact = async (id: string, name: string) => {
    try {
      await api.contacts.delete(id);
      setContacts((prev) => prev.filter((c) => c._id !== id));
      toast('ok', 'Contact Removed', `${name} deleted.`);
    } catch (err: any) {
      toast('err', 'Delete Error', err?.message);
    }
  };

  const timerRemain = activeTimer
    ? Math.max(0, new Date(activeTimer.expiresAt).getTime() - visualClock)
    : 0;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Page Header */}
      <div className="border-b border-line-soft/60 pb-5">
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink flex items-center gap-2.5">
          <Shield size={24} className="text-amber" />
          CasualMeet Safety Operations Center
        </h1>
        <p className="text-xs text-mute mt-1">
          Real-time personal safety controls: server-backed meeting timers, verified public Safe Zones, and instant emergency dispatch.
        </p>
      </div>

      {/* 1. ACTIVE EMERGENCY SOS SECTION */}
      {activeSos && (
        <div className="rounded-3xl border border-sos/60 bg-sos/15 p-6 shadow-2xl backdrop-blur-xl animate-pulse space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sos text-night-950 shadow-lg">
                <ShieldAlert size={28} />
              </div>
              <div>
                <h2 className="font-display text-lg font-black text-sos tracking-tight">
                  ACTIVE EMERGENCY SOS INCIDENT
                </h2>
                <p className="text-xs text-ink/90 font-mono">
                  Incident ID: {activeSos._id} • Location: {activeSos.locationName}
                </p>
              </div>
            </div>

            <Button
              variant="safe"
              size="md"
              onClick={() => resolveSos(activeSos._id, 'resolved')}
              leftIcon={<Check size={16} />}
            >
              Resolve & Mark Safe
            </Button>
          </div>

          <div className="rounded-2xl border border-sos/30 bg-night-950/70 p-4 font-mono text-xs text-mute space-y-1">
            <p className="text-ink font-bold">DISPATCH STATUS:</p>
            <p>• Automated safety alerts sent to saved Emergency Contacts ({activeSos.contactsNotified} notified).</p>
            <p>• SMS Sent: {activeSos.smsSent ? 'Yes' : 'Pending'}</p>
            <p>• Admin Authority Notified: {activeSos.adminNotified ? 'Yes' : 'Pending'}</p>
          </div>
        </div>
      )}

      {/* 2. MEETING TIMER CONTROLS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Active / Create Meeting Timer */}
        <div className="rounded-3xl border border-line-soft bg-night-850/80 p-6 shadow-md backdrop-blur-md flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber/40 bg-amber/15 text-amber">
                  <Clock size={20} />
                </div>
                <div>
                  <h3 className="font-display text-sm font-bold text-ink">
                    Server Meeting Timer
                  </h3>
                  <p className="text-[11px] text-mute">
                    Authoritative server-side expiration
                  </p>
                </div>
              </div>

              {activeTimer ? (
                <span className="rounded-full bg-amber/20 border border-amber/40 px-2.5 py-0.5 font-mono text-[10px] font-bold text-amber uppercase">
                  Active
                </span>
              ) : (
                <span className="rounded-full bg-night-800 border border-line px-2.5 py-0.5 font-mono text-[10px] text-dim uppercase">
                  Inactive
                </span>
              )}
            </div>

            {activeTimer ? (
              <div className="space-y-4 py-3">
                <div className="text-center py-4 rounded-2xl bg-night-900/80 border border-amber/30 shadow-inner">
                  <span className="font-mono text-4xl font-extrabold text-amber tracking-wider">
                    {fmtCountdown(timerRemain)}
                  </span>
                  <p className="text-xs text-mute mt-1">Remaining until automatic safety escalation</p>
                </div>

                {activeTimer.locationName && (
                  <p className="text-xs text-ink flex items-center gap-1.5 justify-center">
                    <MapPin size={14} className="text-amber" />
                    <span>Meeting Location: <strong>{activeTimer.locationName}</strong></span>
                  </p>
                )}

                <div className="flex gap-3 pt-2">
                  <Button
                    variant="outline"
                    size="md"
                    className="flex-1"
                    onClick={() => extendTimer(activeTimer._id, 15)}
                  >
                    Extend +15 Mins
                  </Button>
                  <Button
                    variant="safe"
                    size="md"
                    className="flex-1"
                    onClick={() => markTimerSafe(activeTimer._id)}
                  >
                    I Am Safe
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 py-4 text-center">
                <p className="text-xs text-mute leading-relaxed max-w-sm mx-auto">
                  Going on a real-world meetup? Start a timer. If you do not check in before expiration,
                  our server worker automatically escalates to emergency contacts.
                </p>
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => setStartTimerOpen(true)}
                  leftIcon={<Clock size={16} />}
                >
                  Start New Meetup Timer
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Emergency SOS Quick Trigger */}
        <div className="rounded-3xl border border-line-soft bg-night-850/80 p-6 shadow-md backdrop-blur-md flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-sos/40 bg-sos/15 text-sos">
                <ShieldAlert size={20} />
              </div>
              <div>
                <h3 className="font-display text-sm font-bold text-ink">
                  Instant Emergency SOS
                </h3>
                <p className="text-[11px] text-mute">
                  Direct escalation with SMS & admin dispatch
                </p>
              </div>
            </div>

            <p className="text-xs text-mute leading-relaxed py-2">
              Pressing the emergency button instantly triggers an active safety incident, notifies all registered emergency contacts, and broadcasts to local authorities and CasualMeet moderators.
            </p>
          </div>

          <div className="pt-4 border-t border-line-soft/60">
            <Button
              variant="danger"
              size="lg"
              className="w-full"
              disabled={!!activeSos}
              onClick={() => triggerSos({ locationName: 'Current User Location', source: 'manual' })}
              leftIcon={<ShieldAlert size={18} />}
            >
              {activeSos ? 'SOS Incident Already Active' : 'TRIGGER EMERGENCY SOS'}
            </Button>
          </div>
        </div>
      </div>

      {/* 3. EMERGENCY CONTACTS MANAGEMENT */}
      <div className="rounded-3xl border border-line-soft bg-night-850/80 p-6 shadow-md backdrop-blur-md space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-line-soft/60">
          <div>
            <h3 className="font-display text-base font-bold text-ink flex items-center gap-2">
              <Users size={18} className="text-amber" />
              Emergency Contacts
            </h3>
            <p className="text-xs text-mute mt-0.5">
              People who will receive your GPS context and SMS alert when SOS is triggered.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAddContactOpen(true)}
            leftIcon={<Plus size={14} />}
          >
            Add Contact
          </Button>
        </div>

        {loadingContacts ? (
          <div className="py-6 text-center text-xs text-mute">Loading emergency contacts...</div>
        ) : contacts.length === 0 ? (
          <div className="py-8 text-center text-xs text-mute">
            No emergency contacts saved yet. Add a family member or trusted friend.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-1">
            {contacts.map((c) => (
              <div
                key={c._id}
                className="flex items-center justify-between rounded-2xl border border-line-soft bg-night-900/60 p-4 shadow-sm"
              >
                <div>
                  <p className="font-display text-xs font-bold text-ink">{c.name}</p>
                  <p className="font-mono text-[11px] text-amber mt-0.5">{c.phone}</p>
                  <span className="font-mono text-[9px] uppercase text-dim">{c.relationship}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteContact(c._id, c.name)}
                  className="rounded-lg p-2 text-mute hover:bg-night-800 hover:text-sos transition-colors"
                  title="Delete Contact"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. VERIFIED COMMUNITY SAFE ZONES */}
      <div className="rounded-3xl border border-line-soft bg-night-850/80 p-6 shadow-md backdrop-blur-md space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-line-soft/60">
          <div>
            <h3 className="font-display text-base font-bold text-ink flex items-center gap-2">
              <MapPin size={18} className="text-safe" />
              Verified Public Safe Zones
            </h3>
            <p className="text-xs text-mute mt-0.5">
              Pre-vetted public venues with active CCTV, well-lit parking, and verified security presence.
            </p>
          </div>
          <span className="rounded-full bg-safe/10 border border-safe/30 px-3 py-1 font-mono text-[10px] font-bold text-safe uppercase">
            {safeZones.length} Safe Zones Available
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-1">
          {safeZones.map((z) => (
            <div
              key={z.id}
              className="rounded-2xl border border-line-soft bg-night-900/60 p-4 shadow-sm hover:border-amber/40 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="rounded-md border border-line bg-night-850 px-2 py-0.5 font-mono text-[9px] uppercase text-amber font-semibold">
                    {z.category.replace('_', ' ')}
                  </span>
                  <span className="font-mono text-[10px] text-safe font-bold">Verified</span>
                </div>
                <h4 className="font-display text-xs font-bold text-ink">{z.name}</h4>
                <p className="text-[11px] text-mute mt-1 leading-relaxed">{z.area}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* START TIMER MODAL */}
      <Modal
        open={startTimerOpen}
        onClose={() => setStartTimerOpen(false)}
        title="Start Meetup Check-In Timer"
        description="Select duration and meeting location for your meetup."
      >
        <div className="space-y-4 pt-2">
          <div>
            <label className="block font-mono text-[10px] uppercase text-dim mb-1.5">
              Timer Duration (Minutes)
            </label>
            <div className="flex gap-2">
              {[15, 30, 45, 60, 90].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setTimerDuration(mins)}
                  className={`flex-1 rounded-xl py-2 font-mono text-xs font-bold transition-all ${
                    timerDuration === mins
                      ? 'border border-amber/50 bg-amber/20 text-amber'
                      : 'border border-line bg-night-850 text-mute hover:text-ink'
                  }`}
                >
                  {mins}m
                </button>
              ))}
            </div>
          </div>

          <div>
            <Input
              label="Meeting Venue / Location"
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              placeholder="e.g. Third Wave Coffee, Koramangala"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-line-soft">
            <Button variant="ghost" size="sm" onClick={() => setStartTimerOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleStartTimer}>
              Start Timer
            </Button>
          </div>
        </div>
      </Modal>

      {/* ADD CONTACT MODAL */}
      <Modal
        open={addContactOpen}
        onClose={() => setAddContactOpen(false)}
        title="Add Emergency Contact"
        description="Add a trusted contact to receive notifications during emergencies."
      >
        <form onSubmit={handleAddContact} className="space-y-4 pt-2">
          <Input
            label="Contact Full Name"
            placeholder="e.g. Ramesh Reddy (Father)"
            value={newContact.name}
            onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
            required
          />
          <Input
            label="Phone Number (+91...)"
            placeholder="+919845012345"
            value={newContact.phone}
            onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
            required
          />
          <div>
            <label className="block font-mono text-[10px] uppercase text-dim mb-1.5">
              Relationship
            </label>
            <select
              value={newContact.relationship}
              onChange={(e) => setNewContact({ ...newContact, relationship: e.target.value })}
              className="w-full rounded-xl border border-line bg-night-850 p-2.5 text-xs text-ink outline-none focus:border-amber/50"
            >
              <option value="family">Family</option>
              <option value="friend">Friend</option>
              <option value="partner">Partner</option>
              <option value="colleague">Colleague</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-line-soft">
            <Button variant="ghost" size="sm" type="button" onClick={() => setAddContactOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit">
              Save Contact
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
