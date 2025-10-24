import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import HomePage from './pages/HomePage';
import ComingSoonPage from './pages/ComingSoonPage';
import TalentProfilePage from './pages/TalentProfilePage';
import TalentOnboardingPage from './pages/TalentOnboardingPage';
import OrderPage from './pages/OrderPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import DashboardPage from './pages/DashboardPage';
import AdminDashboard from './pages/AdminDashboard';
import SeedDataPage from './pages/SeedDataPage';
import NotificationsPage from './pages/NotificationsPage';
import HelpPage from './pages/HelpPage';
import ReviewPage from './pages/ReviewPage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import TermsOfServicePage from './pages/TermsOfServicePage';
import EmailTestPage from './pages/EmailTestPage';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Toaster position="top-right" />
          <Routes>
            {/* Coming Soon page without layout */}
            <Route index element={<ComingSoonPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/seed" element={<SeedDataPage />} />
            <Route path="/email-test" element={<EmailTestPage />} />
            <Route path="/onboard/:token" element={<TalentOnboardingPage />} />
            <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
            <Route path="/terms-of-service" element={<TermsOfServicePage />} />
            
            {/* Main app routes with layout */}
            <Route path="/" element={<Layout />}>
              <Route path="/home" element={<HomePage />} />
              <Route path="/talent/:id" element={<TalentProfilePage />} />
              <Route path="/:username" element={<TalentProfilePage />} />
              <Route path="/order/:talentId" element={
                <ProtectedRoute>
                  <OrderPage />
                </ProtectedRoute>
              } />
              <Route path="/dashboard" element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              } />
              <Route path="/admin" element={
                <ProtectedRoute requiredUserType="admin">
                  <AdminDashboard />
                </ProtectedRoute>
              } />
              <Route path="/notifications" element={
                <ProtectedRoute>
                  <NotificationsPage />
                </ProtectedRoute>
              } />
              <Route path="/help" element={
                <ProtectedRoute>
                  <HelpPage />
                </ProtectedRoute>
              } />
              <Route path="/review/:orderId" element={
                <ProtectedRoute>
                  <ReviewPage />
                </ProtectedRoute>
              } />
            </Route>
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
