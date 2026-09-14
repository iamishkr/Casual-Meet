import React, { useState, type ReactNode } from 'react';
import WebSidebar from './components/WebSidebar';
import WebTopBar from './components/WebTopBar';
import WebRightSidebar from './components/WebRightSidebar';

export interface WebLayoutProps {
  children: ReactNode;
  showRightSidebar?: boolean;
}

export default function WebLayout({
  children,
  showRightSidebar = true,
}: WebLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="scene-bg scene-grid min-h-screen text-ink flex">
      {/* Left Desktop & Mobile Sidebar Navigation */}
      <WebSidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Desktop Top Bar */}
        <WebTopBar onMenuToggle={() => setMobileOpen((prev) => !prev)} />

        {/* Dynamic Workspace */}
        <div className="flex-1 flex overflow-hidden">
          <main className="flex-1 p-6 overflow-y-auto max-w-7xl mx-auto w-full">
            {children}
          </main>

          {/* Right Safety & Activity Sidebar */}
          {showRightSidebar && <WebRightSidebar />}
        </div>
      </div>
    </div>
  );
}
