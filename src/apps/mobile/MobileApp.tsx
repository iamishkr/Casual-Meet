import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import MobileLayout from './MobileLayout';
import MobileHomeView from './views/MobileHomeView';
import MobileDiscoverView from './views/MobileDiscoverView';
import MobileMessagesView from './views/MobileMessagesView';
import MobileSafetyView from './views/MobileSafetyView';
import MobileProfileView from './views/MobileProfileView';
import MobileNotificationsView from './views/MobileNotificationsView';
import MobileCommunitiesView from './views/MobileCommunitiesView';
import MobileCommunityDetailView from './views/MobileCommunityDetailView';

export default function MobileApp() {
  return (
    <MobileLayout>
      <Routes>
        <Route path="/" element={<MobileHomeView />} />
        <Route path="/discover" element={<MobileDiscoverView />} />
        <Route path="/communities" element={<MobileCommunitiesView />} />
        <Route path="/communities/:id" element={<MobileCommunityDetailView />} />
        <Route path="/messages" element={<MobileMessagesView />} />
        <Route path="/safety" element={<MobileSafetyView />} />
        <Route path="/profile" element={<MobileProfileView />} />
        <Route path="/profile/:userId" element={<MobileProfileView />} />
        <Route path="/notifications" element={<MobileNotificationsView />} />
        <Route path="*" element={<Navigate to="/mobile" replace />} />
      </Routes>
    </MobileLayout>
  );
}
