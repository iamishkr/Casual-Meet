import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, AlertTriangle, ArrowLeft, CheckCircle2, Lock, Flame } from 'lucide-react';
import { I } from '../components/ui';

export default function TermsPage() {
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
              <span className="font-display font-extrabold tracking-tight">CasualMeet Legal</span>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs font-semibold text-mute">
            <Link to="/privacy" className="hover:text-amber transition-colors">
              Privacy Policy
            </Link>
            <Link to="/login" className="hover:text-amber transition-colors">
              Login
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-4xl px-6 py-10">
        {/* CRITICAL EMERGENCY DISCLAIMER BANNER (APP STORE & PLAY STORE COMPLIANCE) */}
        <div className="rounded-2xl border-2 border-sos/50 bg-sos/10 p-6 shadow-[0_10px_30px_-10px_rgba(255,93,100,0.3)] mb-10">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sos text-night-950 font-black shadow-lg">
              <AlertTriangle size={24} />
            </div>
            <div className="space-y-2">
              <h2 className="font-display text-lg font-black text-sos tracking-wide uppercase">
                Emergency Services Disclaimer & Advisory
              </h2>
              <p className="text-xs sm:text-sm text-ink/90 leading-relaxed">
                <strong>CasualMeet is NOT an official replacement for government 911, 112, 100, or local emergency response services.</strong>
              </p>
              <p className="text-xs text-mute leading-relaxed">
                The automated meeting timers and SOS beacons provided within CasualMeet are supplemental peer-to-peer notification tools that attempt to alert your configured personal emergency contacts and platform safety personnel via SMS and digital gateways. If you are in immediate physical danger, experiencing medical distress, or facing a life-threatening crisis, you must contact official local law enforcement and emergency responders immediately.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-line-soft bg-night-850/80 p-8 shadow-xl space-y-8 backdrop-blur-sm">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-ink">
              Terms of Service
            </h1>
            <p className="mt-2 text-xs font-mono text-dim">
              Last Updated: September 2026 · Effective Immediately for All Users
            </p>
          </div>

          {/* Section 1 */}
          <section className="space-y-3 border-t border-line-soft pt-6">
            <h3 className="font-display text-base font-bold text-amber flex items-center gap-2">
              <span>1. Acceptance of Terms</span>
            </h3>
            <p className="text-xs sm:text-sm text-mute leading-relaxed">
              By accessing or using CasualMeet (including our Web Application, Mobile Android Application, and APIs), you agree to be bound by these Terms of Service. If you do not agree to these terms, do not create an account or use the service.
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-3 border-t border-line-soft pt-6">
            <h3 className="font-display text-base font-bold text-amber flex items-center gap-2">
              <span>2. Eligibility & Account Security</span>
            </h3>
            <ul className="space-y-2 text-xs sm:text-sm text-mute leading-relaxed list-disc list-inside">
              <li>You must be at least 18 years of age to register and use CasualMeet.</li>
              <li>You agree to provide accurate, truthful personal information during registration and identity verification.</li>
              <li>You are strictly responsible for maintaining the confidentiality of your credentials and all activity under your account.</li>
              <li>Impersonation, deceptive identity claims, or operating accounts on behalf of unauthorized third parties is strictly prohibited and results in immediate account suspension.</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="space-y-3 border-t border-line-soft pt-6">
            <h3 className="font-display text-base font-bold text-amber flex items-center gap-2">
              <span>3. User-Generated Content & Code of Conduct</span>
            </h3>
            <p className="text-xs sm:text-sm text-mute leading-relaxed">
              CasualMeet enforces a zero-tolerance policy against abusive behavior. You strictly agree NOT to upload, post, transmit, or share:
            </p>
            <div className="grid sm:grid-cols-2 gap-3 pt-1">
              <div className="rounded-xl border border-line-soft bg-night-900/60 p-3 text-xs text-mute">
                ❌ Harassment, stalking, threats of violence, hate speech, or defamation.
              </div>
              <div className="rounded-xl border border-line-soft bg-night-900/60 p-3 text-xs text-mute">
                ❌ Non-consensual sexual content, explicit adult material, or child exploitation.
              </div>
              <div className="rounded-xl border border-line-soft bg-night-900/60 p-3 text-xs text-mute">
                ❌ Fraudulent financial schemes, unsolicited commercial solicitation, or spam.
              </div>
              <div className="rounded-xl border border-line-soft bg-night-900/60 p-3 text-xs text-mute">
                ❌ Unauthorized sharing of third-party personal addresses, phone numbers, or private data.
              </div>
            </div>
            <p className="text-xs text-dim">
              All reported content is immediately routed to our Trust & Safety Moderation queue. Violation of these rules leads to immediate content removal, penalty points, or permanent account bans.
            </p>
          </section>

          {/* Section 4 */}
          <section className="space-y-3 border-t border-line-soft pt-6">
            <h3 className="font-display text-base font-bold text-amber flex items-center gap-2">
              <span>4. Meeting Timers & Safety Escort Tools</span>
            </h3>
            <p className="text-xs sm:text-sm text-mute leading-relaxed">
              CasualMeet provides autonomous background workers that monitor user-initiated meeting countdowns. You acknowledge that:
            </p>
            <ul className="space-y-2 text-xs sm:text-sm text-mute leading-relaxed list-disc list-inside">
              <li>Cellular connectivity, battery levels, device GPS signal, and third-party SMS carrier delivery may impact the delivery speed of automated notifications.</li>
              <li>You are responsible for reviewing and keeping your designated emergency contacts up-to-date.</li>
              <li>CasualMeet is not liable for carrier SMS delivery delays or network outages caused by telecom providers.</li>
            </ul>
          </section>

          {/* Section 5 */}
          <section className="space-y-3 border-t border-line-soft pt-6">
            <h3 className="font-display text-base font-bold text-amber flex items-center gap-2">
              <span>5. Account Deletion & Termination</span>
            </h3>
            <p className="text-xs sm:text-sm text-mute leading-relaxed">
              In full compliance with Apple App Store and Google Play mandates, you may permanently delete your account and all associated personal data at any time from your Profile Settings. Upon confirmation, active timers, locations, and personal profiles are purged immediately.
            </p>
          </section>

          {/* Section 6 */}
          <section className="space-y-3 border-t border-line-soft pt-6">
            <h3 className="font-display text-base font-bold text-amber flex items-center gap-2">
              <span>6. Contact Information</span>
            </h3>
            <p className="text-xs sm:text-sm text-mute leading-relaxed">
              For questions regarding these Terms or legal inquiries, reach out to our Trust & Safety team at <span className="font-mono text-amber">safety@casualmeet.app</span>.
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
