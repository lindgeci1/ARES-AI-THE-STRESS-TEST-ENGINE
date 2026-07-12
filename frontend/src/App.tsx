import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { Layout } from './components/Layout';
import { AdminLayout } from './components/AdminLayout';
import { SessionExpiredModal } from './components/SessionExpiredModal';
import { ProtectedRoute } from './components/ProtectedRoute';
import { PublicRoute } from './components/PublicRoute';
import { Landing } from './pages/Landing';
import { Auth } from './pages/Auth';
import { ForgotPassword } from './pages/ForgotPassword';
import { Dashboard } from './pages/Dashboard';
import { AuditLab } from './pages/AuditLab';
import { Checkout } from './pages/Checkout';
import { NewAudit } from './pages/NewAudit';
import { Billing } from './pages/Billing';
import { CompareDocuments } from './pages/CompareDocuments';
import { AdminDashboard } from './pages/AdminDashboard';
import { AdminUsers } from './pages/AdminUsers';
import { AdminDocuments } from './pages/AdminDocuments';
import { AdminAudioDebates } from './pages/AdminAudioDebates';
import { AdminPackages } from './pages/AdminPackages';
import { AdminPayments } from './pages/AdminPayments';
import { AdminSessions } from './pages/AdminSessions';
import { ToastProvider } from './context/ToastContext';
export function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <SessionExpiredModal />
          <Routes>
          <Route path="/" element={<Landing />} />
          <Route
            path="/auth"
            element={
              <PublicRoute>
                <Auth />
              </PublicRoute>
            }
          />
          <Route
            path="/forgot-password"
            element={
              <PublicRoute>
                <ForgotPassword />
              </PublicRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Layout>
                  <Dashboard />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/audit/new"
            element={
              <ProtectedRoute>
                <Layout>
                  <NewAudit />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route path="/checkout/:plan" element={<Checkout />} />
          <Route
            path="/audit/:id"
            element={
              <ProtectedRoute>
                <Layout>
                  <AuditLab />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/billing"
            element={
              <ProtectedRoute>
                <Layout>
                  <Billing />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/compare"
            element={
              <ProtectedRoute>
                <Layout>
                  <CompareDocuments />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/packages"
            element={
              <ProtectedRoute requiredRole="Admin">
                <AdminLayout>
                  <AdminPackages />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/payments"
            element={
              <ProtectedRoute requiredRole="Admin">
                <AdminLayout>
                  <AdminPayments />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/sessions"
            element={
              <ProtectedRoute requiredRole="Admin">
                <AdminLayout>
                  <AdminSessions />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute requiredRole="Admin">
                <AdminLayout>
                  <AdminDashboard />
                </AdminLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/users"
            element={
              <ProtectedRoute requiredRole="Admin">
                <AdminLayout>
                  <AdminUsers />
                </AdminLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/documents"
            element={
              <ProtectedRoute requiredRole="Admin">
                <AdminLayout>
                  <AdminDocuments />
                </AdminLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/audio-debates"
            element={
              <ProtectedRoute requiredRole="Admin">
                <AdminLayout>
                  <AdminAudioDebates />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  );
}