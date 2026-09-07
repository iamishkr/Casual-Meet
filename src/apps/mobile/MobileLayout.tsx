import React, { useState, type ReactNode } from 'react';
import MobileHeader from './components/MobileHeader';
import MobileBottomNav from './components/MobileBottomNav';
import MobileCreateSheet from './components/MobileCreateSheet';

export interface MobileLayoutProps {
  children: ReactNode;
}

export default function MobileLayout({ children }: MobileLayoutProps) {
  const [createSheetOpen, setCreateSheetOpen] = useState(false);

  return (
    <div className="scene-bg min-h-screen text-ink flex flex-col">
      {/* Mobile Sticky Top Header */}
      <MobileHeader />

      {/* Main Viewport Container */}
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-4 pb-28">
        {children}
      </main>

      {/* Fixed Bottom Navigation Bar */}
      <MobileBottomNav onCreateClick={() => setCreateSheetOpen(true)} />

      {/* Slide-Up Post Creator Sheet */}
      <MobileCreateSheet
        open={createSheetOpen}
        onClose={() => setCreateSheetOpen(false)}
      />
    </div>
  );
}
