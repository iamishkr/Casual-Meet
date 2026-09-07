import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AdminLayout from './AdminLayout';
import AdminConsole from '../../components/admin/AdminConsole';

export default function AdminApp() {
  return (
    <AdminLayout>
      <Routes>
        <Route path="/" element={<AdminConsole />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </AdminLayout>
  );
}
