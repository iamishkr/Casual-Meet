import React, { useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { ToastProvider } from './context/ToastContext';
import { DataProvider } from './context/DataContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';
import TermsPage from './pages/TermsPage';
import PrivacyPage from './pages/PrivacyPage';
import WebApp from './apps/web/WebApp';
import MobileApp from './apps/mobile/MobileApp';
import AdminApp from './apps/admin/AdminApp';

function PlatformRouter() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // If running inside Capacitor Native App (Android/iOS) and on root or web path, route to mobile app
    if (Capacitor.isNativePlatform()) {
      if (location.pathname === '/' || location.pathname.startsWith('/app')) {
        navigate('/mobile', { replace: true });
      }
    }
  }, [location.pathname, navigate]);

  return (
    <Routes>
      {/* Public Pages */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/register" element={<AuthPage mode="register" />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />

      {/* 1. CASUALMEET CONSUMER WEB (Desktop / Laptop / Tablet) */}
      <Route
        path="/app/*"
        element={
          <ProtectedRoute allowedRoles={['user', 'moderator', 'super_admin']}>
            <WebApp />
          </ProtectedRoute>
        }
      />

      {/* 2. CASUALMEET CONSUMER MOBILE (Real Mobile Shell / Capacitor Android) */}
      <Route
        path="/mobile/*"
        element={
          <ProtectedRoute allowedRoles={['user', 'moderator', 'super_admin']}>
            <MobileApp />
          </ProtectedRoute>
        }
      />

      {/* 3. CASUALMEET CREATOR / ADMIN (Trust & Safety Operations Console) */}
      <Route
        path="/admin/*"
        element={
          <ProtectedRoute allowedRoles={['moderator', 'super_admin']}>
            <AdminApp />
          </ProtectedRoute>
        }
      />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <DataProvider>
        <PlatformRouter />
      </DataProvider>
    </ToastProvider>
  );
}
