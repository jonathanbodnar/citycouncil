import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';

// Loading fallback component
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="text-center">
      <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
      <p className="text-gray-400">Loading...</p>
    </div>
  </div>
);

// Lazy load all pages for code splitting
const HomePage = lazy(() => import('./pages/HomePage'));
const DemoPage = lazy(() => import('./pages/DemoPage'));
const ComingSoonPage = lazy(() => import('./pages/ComingSoonPage'));
const TalentOnboardingPage = lazy(() => import('./pages/TalentOnboardingPage'));
const PublicTalentOnboardingPage = lazy(() => import('./pages/PublicTalentOnboardingPage'));
const OrderFulfillmentPage = lazy(() => import('./pages/OrderFulfillmentPage'));
const OrderPage = lazy(() => import('./pages/OrderPage'));
const TalentProfilePage = lazy(() => import('./pages/TalentProfilePage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const SignupPage = lazy(() => import('./pages/SignupPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const SeedDataPage = lazy(() => import('./pages/SeedDataPage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const HelpPage = lazy(() => import('./pages/HelpPage'));
const ReviewPage = lazy(() => import('./pages/ReviewPage'));
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage'));
const TermsOfServicePage = lazy(() => import('./pages/TermsOfServicePage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const EmailTestPage = lazy(() => import('./pages/EmailTestPage'));
const InstagramCallbackPage = lazy(() => import('./pages/InstagramCallbackPage'));
const WelcomePage = lazy(() => import('./pages/WelcomePage'));
const ShortLinkRedirectPage = lazy(() => import('./pages/ShortLinkRedirectPage'));

// Redirect component for old /profile/ URLs
const ProfileRedirect: React.FC = () => {
  const { username } = useParams<{ username: string }>();
  return <Navigate to={`/${username}`} replace />;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Toaster 
            position="top-right" 
            toastOptions={{
              style: {
                zIndex: 99999,
              },
            }}
          />
          <Suspense fallback={<PageLoader />}>
            <Routes>
            {/* Coming Soon page without layout */}
            <Route index element={<ComingSoonPage />} />
            
            {/* Demo page - standalone without header/footer */}
            <Route path="/demo" element={<DemoPage />} />
            
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/onboard" element={<PublicTalentOnboardingPage />} />
            <Route path="/s/:code" element={<ShortLinkRedirectPage />} />
            <Route path="/fulfill/:token" element={<OrderFulfillmentPage />} />
            
            {/* Redirect old /profile/ URLs to new format */}
            <Route path="/profile/:username" element={<ProfileRedirect />} />
            <Route path="/talent/:slug" element={<TalentProfilePage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/seed" element={<SeedDataPage />} />
            <Route path="/email-test" element={<EmailTestPage />} />
            <Route path="/onboard/:token" element={<TalentOnboardingPage />} />
            <Route path="/instagram/callback" element={<InstagramCallbackPage />} />
            <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
            <Route path="/terms-of-service" element={<TermsOfServicePage />} />
            
            {/* Main app routes with layout */}
            <Route path="/" element={<Layout />}>
              <Route path="/home" element={<HomePage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/:username" element={<TalentProfilePage />} />
              <Route path="/talent/:id" element={<TalentProfilePage />} />
              <Route path="/order/:talentId" element={
                <ProtectedRoute>
                  <OrderPage />
                </ProtectedRoute>
              } />
              <Route path="/welcome" element={
                <ProtectedRoute requiredUserType="talent">
                  <WelcomePage />
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
          </Suspense>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
