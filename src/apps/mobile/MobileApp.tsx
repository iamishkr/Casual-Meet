import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import MobileLayout from './MobileLayout';
import MobileHomeView from './views/MobileHomeView';
import MobileDiscoverView from './views/MobileDiscoverView';
import MobileMessagesView from './views/MobileMessagesView';
import MobileSafetyView from './views/MobileSafetyView';
import MobileProfileView from './views/MobileProfileView';

export default function MobileApp() {
  return (
    <MobileLayout>
      <Routes>
        <Route path="/" element={<MobileHomeView />} />
        <Route path="/discover" element={<MobileDiscoverView />} />
        <Route path="/messages" element={<MobileMessagesView />} />
        <Route path="/safety" element={<MobileSafetyView />} />
        <Route path="/profile" element={<MobileProfileView />} />
        <Route path="*" element={<Navigate to="/mobile" replace />} />
      </Routes>
    </MobileLayout>
  );
}
