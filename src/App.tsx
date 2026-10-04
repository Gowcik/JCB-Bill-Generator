import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { App as CapApp } from '@capacitor/app';
import { initBackButton } from './services/backButtonService';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import { LanguageProvider } from './i18n';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { DashboardPage } from './pages/Dashboard/DashboardPage';
import { CreateBillPage } from './pages/CreateBill/CreateBillPage';
import { CreateLoadingBillPage } from './pages/CreateBill/CreateLoadingBillPage';
import { BillHistoryPage } from './pages/BillHistory/BillHistoryPage';
import { CustomersPage } from './pages/Customers/CustomersPage';
import { ReportsPage } from './pages/Reports/ReportsPage';
import { OwnerDetailsPage } from './pages/OwnerDetails/OwnerDetailsPage';
import { SettingsPage } from './pages/Settings/SettingsPage';
import { LoginPage } from './pages/Login/LoginPage';
import { RegisterPage } from './pages/Login/RegisterPage';
import { ForgotPasswordPage } from './pages/Login/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/Login/ResetPasswordPage';

const BackButtonManager: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    initBackButton(
      () => {
        if (window.history.length > 1) {
          navigate(-1);
        } else {
          navigate('/');
        }
      },
      () => {
        CapApp.exitApp();
      }
    );
  }, [navigate]);

  return null;
};

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <BrowserRouter>
          <BackButtonManager />
          <Routes>
          {/* Public Auth Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          {/* Protected Routes for Authenticated Users */}
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/dashboard" element={<Navigate to="/" replace />} />
            <Route path="/create-bill" element={<CreateBillPage />} />
            <Route path="/create-loading-bill" element={<CreateLoadingBillPage />} />
            <Route path="/bill-history" element={<BillHistoryPage />} />
            <Route path="/customers" element={<CustomersPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/owner-details" element={<OwnerDetailsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>

          {/* Fallback route */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </LanguageProvider>
</ThemeProvider>
  );
};

export default App;
