import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import WebLayout from './WebLayout';
import WebHomePage from './pages/WebHomePage';
import WebDiscoverPage from './pages/WebDiscoverPage';
import WebMessagesPage from './pages/WebMessagesPage';
import WebSafetyPage from './pages/WebSafetyPage';
import WebProfilePage from './pages/WebProfilePage';
import WebNotificationsPage from './pages/WebNotificationsPage';
import WebCommunitiesPage from './pages/WebCommunitiesPage';
import WebCommunityDetailPage from './pages/WebCommunityDetailPage';

export default function WebApp() {
  return (
    <WebLayout>
      <Routes>
        <Route path="/" element={<WebHomePage />} />
        <Route path="/discover" element={<WebDiscoverPage />} />
        <Route path="/communities" element={<WebCommunitiesPage />} />
        <Route path="/communities/:id" element={<WebCommunityDetailPage />} />
        <Route path="/messages" element={<WebMessagesPage />} />
        <Route path="/safety" element={<WebSafetyPage />} />
        <Route path="/profile" element={<WebProfilePage />} />
        <Route path="/profile/:userId" element={<WebProfilePage />} />
        <Route path="/notifications" element={<WebNotificationsPage />} />
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
    </WebLayout>
  );
}
