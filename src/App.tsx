import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import ScrollToTop from './components/ScrollToTop';
import HolidayPromoPopup from './components/HolidayPromoPopup';

// Capture Rumble Ad click ID on app load
// Rumble appends _raclid to URLs when users click on ads
const captureRumbleClickId = () => {
  if (typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search);
    const raclid = urlParams.get('_raclid');
    if (raclid) {
      sessionStorage.setItem('rumble_raclid', raclid);
      console.log('📢 Rumble click ID captured:', raclid);
    }
  }
};

// Capture UTM parameters globally on app load
// This ensures UTM is captured no matter what page they land on
const captureGlobalUtm = () => {
  if (typeof window !== 'undefined') {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      
      // Check for simple utm= param first
      const utmParam = urlParams.get('utm');
      // Then check for Facebook-style utm_source=
      const utmSource = urlParams.get('utm_source');
      
      // ALWAYS capture UTM if present in URL (most recent UTM wins)
      // This ensures we don't lose tracking when users come from different sources
      
      if (utmParam) {
        // Simple UTM - store it (including utm=1 for self-promo)
        localStorage.setItem('promo_source_global', utmParam);
        localStorage.setItem('promo_source', utmParam);
        // Also store in sessionStorage as backup
        try { 
          sessionStorage.setItem('promo_source_global', utmParam);
          sessionStorage.setItem('promo_source', utmParam);
        } catch (e) {}
        console.log('🎯 Global UTM captured from utm=:', utmParam);
      } else if (utmSource) {
        // Facebook-style UTM - normalize Facebook sources to 'fb'
        const fbSources = ['fb', 'facebook', 'ig', 'instagram', 'meta', 'audience_network', 'messenger', 'an'];
        const normalizedSource = utmSource.toLowerCase();
        const sourceToStore = fbSources.some(s => normalizedSource.includes(s)) ? 'fb' : utmSource;
        localStorage.setItem('promo_source_global', sourceToStore);
        localStorage.setItem('promo_source', sourceToStore);
        // Also store in sessionStorage as backup
        try { 
          sessionStorage.setItem('promo_source_global', sourceToStore);
          sessionStorage.setItem('promo_source', sourceToStore);
        } catch (e) {}
        console.log('🎯 Global UTM captured from utm_source=:', sourceToStore);
        
        // Also store full UTM details
        const utmDetails = {
          source: utmSource,
          medium: urlParams.get('utm_medium'),
          campaign: urlParams.get('utm_campaign'),
          content: urlParams.get('utm_content'),
          term: urlParams.get('utm_term'),
          capturedAt: new Date().toISOString(),
          landingPage: window.location.pathname
        };
        localStorage.setItem('utm_details', JSON.stringify(utmDetails));
        console.log('🎯 UTM details captured:', utmDetails);
      }
      
      // Log current UTM state for debugging
      const currentUtm = localStorage.getItem('promo_source_global');
      console.log('🎯 Current stored UTM:', currentUtm || 'none');
    } catch (e) {
      console.error('Error capturing UTM:', e);
    }
  }
};

// Run immediately on script load
captureRumbleClickId();
captureGlobalUtm();

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
const OrderSuccessPage = lazy(() => import('./pages/OrderSuccessPage'));
const PayoutSetupPage = lazy(() => import('./pages/PayoutSetupPage'));

// Redirect component for old /profile/ URLs
const ProfileRedirect: React.FC = () => {
  const { username } = useParams<{ username: string }>();
  return <Navigate to={`/${username}`} replace />;
};

// Promo redirect component - redirects short names to home with UTM
const PromoRedirect: React.FC<{ utm: string }> = ({ utm }) => {
  // Store the UTM before redirecting
  if (typeof window !== 'undefined') {
    localStorage.setItem('promo_source_global', utm);
    localStorage.setItem('promo_source', utm);
    try {
      sessionStorage.setItem('promo_source_global', utm);
      sessionStorage.setItem('promo_source', utm);
    } catch (e) {}
  }
  return <Navigate to={`/?utm=${utm}`} replace />;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <ScrollToTop />
        <div className="App">
          <Toaster 
            position="top-right" 
            toastOptions={{
              style: {
                zIndex: 99999,
              },
            }}
          />
          {/* Holiday Promo Popup - shows once per user with 24hr countdown */}
          <HolidayPromoPopup />
          <Suspense fallback={<PageLoader />}>
            <Routes>
            {/* Demo page - standalone without header/footer */}
            <Route path="/demo" element={<DemoPage />} />
            
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/onboard" element={<PublicTalentOnboardingPage />} />
            
            {/* Promo redirects - short name variations to home with UTM */}
            {/* Shawn variations */}
            <Route path="/shawn" element={<PromoRedirect utm="shawnlive" />} />
            <Route path="/shaun" element={<PromoRedirect utm="shawnlive" />} />
            <Route path="/sean" element={<PromoRedirect utm="shawnlive" />} />
            <Route path="/shon" element={<PromoRedirect utm="shawnlive" />} />
            {/* Hayley variations */}
            <Route path="/hayley" element={<PromoRedirect utm="hayleylive" />} />
            <Route path="/hailey" element={<PromoRedirect utm="hayleylive" />} />
            <Route path="/haley" element={<PromoRedirect utm="hayleylive" />} />
            <Route path="/hailee" element={<PromoRedirect utm="hayleylive" />} />
            <Route path="/haily" element={<PromoRedirect utm="hayleylive" />} />
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
              <Route index element={<HomePage />} />
              <Route path="/home" element={<Navigate to="/" replace />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/:username" element={<TalentProfilePage />} />
              <Route path="/talent/:id" element={<TalentProfilePage />} />
              <Route path="/order/:talentId" element={
                <ProtectedRoute>
                  <OrderPage />
                </ProtectedRoute>
              } />
              <Route path="/order-success" element={
                <ProtectedRoute>
                  <OrderSuccessPage />
                </ProtectedRoute>
              } />
              <Route path="/welcome" element={
                <ProtectedRoute requiredUserType="talent">
                  <WelcomePage />
                </ProtectedRoute>
              } />
              <Route path="/payout-setup" element={
                <ProtectedRoute requiredUserType="talent">
                  <PayoutSetupPage />
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
