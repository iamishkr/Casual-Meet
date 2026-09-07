import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './context/ToastContext';
import { DataProvider } from './context/DataContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';
import UserPortal from './pages/UserPortal';
import AdminPortal from './pages/AdminPortal';

export default function App() {
  return (
    <ToastProvider>
      <DataProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/register" element={<AuthPage mode="register" />} />

          {/* User Application Portal */}
          <Route
            path="/app/*"
            element={
              <ProtectedRoute allowedRoles={['user', 'moderator', 'super_admin']}>
                <UserPortal />
              </ProtectedRoute>
            }
          />

          {/* Creator Admin HQ Console */}
          <Route
            path="/admin/*"
            element={
              <ProtectedRoute allowedRoles={['moderator', 'super_admin']}>
                <AdminPortal />
              </ProtectedRoute>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </DataProvider>
    </ToastProvider>
  );
}
