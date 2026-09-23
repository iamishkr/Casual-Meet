import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, Lock, Eye, Trash2, ArrowLeft, CheckCircle2, MapPin } from 'lucide-react';
import { I } from '../components/ui';

export default function PrivacyPage() {
  return (
    <div className="scene-bg scene-grid min-h-screen text-ink">
      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b border-line-soft bg-night-900/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="btn-press flex h-9 w-9 items-center justify-center rounded-xl border border-line-soft bg-night-850 text-mute hover:border-amber/40 hover:text-amber"
            >
              <ArrowLeft size={16} />
            </Link>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-amber/40 bg-amber/10 text-amber">
                <I.logo size={18} />
              </span>
              <span className="font-display font-extrabold tracking-tight">CasualMeet Privacy</span>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs font-semibold text-mute">
            <Link to="/terms" className="hover:text-amber transition-colors">
              Terms of Service
            </Link>
            <Link to="/login" className="hover:text-amber transition-colors">
              Login
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-4xl px-6 py-10">
        <div className="rounded-2xl border border-line-soft bg-night-850/80 p-8 shadow-xl space-y-8 backdrop-blur-sm">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-ink">
              Privacy Policy
            </h1>
            <p className="mt-2 text-xs font-mono text-dim">
              Last Updated: September 2026 · Compliant with Global Privacy Regulations & App Store Guidelines
            </p>
          </div>

          {/* Privacy Principles Banner */}
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="rounded-xl border border-safe/30 bg-safe/10 p-4">
              <div className="flex items-center gap-2 text-safe font-bold text-xs uppercase tracking-wider">
                <MapPin size={16} />
                <span>Zero GPS Leaks</span>
              </div>
              <p className="mt-2 text-xs text-mute leading-relaxed">
                Raw coordinates are never broadcast to other users. Only coarse distance ranges and neighborhood labels are displayed.
              </p>
            </div>
            <div className="rounded-xl border border-amber/30 bg-amber/10 p-4">
              <div className="flex items-center gap-2 text-amber font-bold text-xs uppercase tracking-wider">
                <Lock size={16} />
                <span>Scoped Emergency Data</span>
              </div>
              <p className="mt-2 text-xs text-mute leading-relaxed">
                Emergency contacts are strictly private to your account and only notified when an active SOS or expired timer triggers.
              </p>
            </div>
            <div className="rounded-xl border border-sky/30 bg-sky/10 p-4">
              <div className="flex items-center gap-2 text-sky font-bold text-xs uppercase tracking-wider">
                <Trash2 size={16} />
                <span>Instant Self Deletion</span>
              </div>
              <p className="mt-2 text-xs text-mute leading-relaxed">
                Self-service account deletion permanently purges all profile, location, contact, and timer history immediately.
              </p>
            </div>
          </div>

          {/* Section 1 */}
          <section className="space-y-3 border-t border-line-soft pt-6">
            <h3 className="font-display text-base font-bold text-amber">
              1. Information We Collect
            </h3>
            <div className="space-y-3 text-xs sm:text-sm text-mute leading-relaxed">
              <p>
                <strong>Account Information:</strong> When you register, we collect your name, username, email address, password hash, phone number, and optional bio/interests.
              </p>
              <p>
                <strong>Emergency Contacts:</strong> Up to 5 trusted emergency contacts (name, phone number, relationship) that you explicitly configure for SOS escalation.
              </p>
              <p>
                <strong>Location Data:</strong> With your explicit device permission, we collect location coordinates solely to compute proximity for local discovery and to format emergency dispatch tracking links during an active SOS event.
              </p>
              <p>
                <strong>User Content & Communications:</strong> Messages, posts, comments, community memberships, and ephemeral 24-hour stories you create on the platform.
              </p>
            </div>
          </section>

          {/* Section 2 */}
          <section className="space-y-3 border-t border-line-soft pt-6">
            <h3 className="font-display text-base font-bold text-amber">
              2. How We Protect Location Privacy
            </h3>
            <p className="text-xs sm:text-sm text-mute leading-relaxed">
              We employ strict <strong>Server-Side Privacy Sanitization</strong>:
            </p>
            <ul className="space-y-2 text-xs sm:text-sm text-mute leading-relaxed list-disc list-inside">
              <li>Raw latitude and longitude coordinates are <em>redacted</em> before API responses are returned to any other consumer client.</li>
              <li>Other members only see estimated relative distance (e.g. "1.5 km away") and city/neighborhood approximations.</li>
              <li>Exact GPS coordinates are attached only to active SOS alerts dispatched directly to your designated emergency contacts and Trust & Safety response team.</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="space-y-3 border-t border-line-soft pt-6">
            <h3 className="font-display text-base font-bold text-amber">
              3. How We Share Your Information
            </h3>
            <p className="text-xs sm:text-sm text-mute leading-relaxed">
              <strong>We do NOT sell your personal data or location to advertisers or data brokers.</strong> We share data strictly for core safety operations:
            </p>
            <ul className="space-y-2 text-xs sm:text-sm text-mute leading-relaxed list-disc list-inside">
              <li><strong>SMS Telecom Providers (Fast2SMS & Twilio):</strong> To transmit emergency SOS alerts to your designated contacts.</li>
              <li><strong>Cloud Infrastructure:</strong> Database and hosting services (MongoDB Atlas, Render) under strict confidentiality agreements.</li>
              <li><strong>Legal Compliance:</strong> Only when strictly required by enforceable lawful subpoenas or to protect human life in emergency situations.</li>
            </ul>
          </section>

          {/* Section 4 */}
          <section className="space-y-3 border-t border-line-soft pt-6">
            <h3 className="font-display text-base font-bold text-amber">
              4. Data Retention & Your Deletion Rights
            </h3>
            <p className="text-xs sm:text-sm text-mute leading-relaxed">
              You retain full control over your personal data:
            </p>
            <ul className="space-y-2 text-xs sm:text-sm text-mute leading-relaxed list-disc list-inside">
              <li><strong>Ephemeral Stories:</strong> Automatically expire and are purged after 24 hours.</li>
              <li><strong>Account Deletion:</strong> You can delete your account at any time via <em>Profile → Delete Account</em>. This permanently removes your profile, personal location records, emergency contacts, active timers, and notifications from our live databases.</li>
            </ul>
          </section>

          {/* Section 5 */}
          <section className="space-y-3 border-t border-line-soft pt-6">
            <h3 className="font-display text-base font-bold text-amber">
              5. Contact Our Data Protection Officer
            </h3>
            <p className="text-xs sm:text-sm text-mute leading-relaxed">
              If you have any questions about this Privacy Policy or wish to exercise your data rights, contact us at <span className="font-mono text-amber">privacy@casualmeet.app</span>.
            </p>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-line-soft bg-night-900 py-6 text-center text-xs text-dim">
        <p>© 2026 CasualMeet. All rights reserved. Peer Safety & Social Meetup Platform.</p>
      </footer>
    </div>
  );
}
