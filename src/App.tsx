import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams, useSearchParams } from 'react-router-dom';
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

// Set first-party cookie for UTM (backup for localStorage)
const setUtmCookie = (utm: string) => {
  try {
    // Set cookie that expires in 30 days
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString();
    document.cookie = `promo_source=${encodeURIComponent(utm)}; expires=${expires}; path=/; SameSite=Lax`;
    console.log('🍪 UTM cookie set:', utm);
  } catch (e) {
    console.error('Error setting UTM cookie:', e);
  }
};

// Get UTM from cookie
const getUtmCookie = (): string | null => {
  try {
    const match = document.cookie.match(/(?:^|; )promo_source=([^;]*)/);
    return match ? decodeURIComponent(match[1]) : null;
  } catch (e) {
    return null;
  }
};

// Infer UTM source from referrer
const inferUtmFromReferrer = (): string | null => {
  try {
    const referrer = document.referrer.toLowerCase();
    if (!referrer) return null;
    
    // Map common referrers to UTM sources
    const referrerMap: Record<string, string> = {
      'facebook.com': 'fb',
      'fb.com': 'fb',
      'instagram.com': 'ig',
      'twitter.com': 'twitter',
      'x.com': 'twitter',
      't.co': 'twitter',
      'youtube.com': 'youtube',
      'youtu.be': 'youtube',
      'rumble.com': 'rumble',
      'tiktok.com': 'tiktok',
      'linkedin.com': 'linkedin',
      'reddit.com': 'reddit',
      'threads.net': 'threads',
      'truthsocial.com': 'truth',
      'gettr.com': 'gettr',
      'parler.com': 'parler',
      'gab.com': 'gab',
      'google.com': 'google',
      'bing.com': 'bing',
      'duckduckgo.com': 'ddg',
    };
    
    for (const [domain, utm] of Object.entries(referrerMap)) {
      if (referrer.includes(domain)) {
        console.log('🔍 UTM inferred from referrer:', utm, 'from', referrer);
        return `ref_${utm}`;
      }
    }
    
    return null;
  } catch (e) {
    return null;
  }
};

// Store UTM in all storage mechanisms
const storeUtm = (utm: string) => {
  // localStorage
  localStorage.setItem('promo_source_global', utm);
  localStorage.setItem('promo_source', utm);
  
  // sessionStorage
  try { 
    sessionStorage.setItem('promo_source_global', utm);
    sessionStorage.setItem('promo_source', utm);
  } catch (e) {}
  
  // First-party cookie
  setUtmCookie(utm);
};

// Capture UTM parameters globally on app load
// This ensures UTM is captured no matter what page they land on
const captureGlobalUtm = () => {
  if (typeof window !== 'undefined') {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      
      // Check for simple utm= param first (also check typo 'umt')
      const utmParam = urlParams.get('utm') || urlParams.get('umt');
      // Then check for Facebook-style utm_source=
      const utmSource = urlParams.get('utm_source');
      
      // ALWAYS capture UTM if present in URL (most recent UTM wins)
      // This ensures we don't lose tracking when users come from different sources
      
      if (utmParam) {
        // Simple UTM - store it (including utm=1 for self-promo)
        storeUtm(utmParam);
        console.log('🎯 Global UTM captured from utm=:', utmParam);
      } else if (utmSource) {
        // Facebook-style UTM - normalize Facebook sources to 'fb'
        const fbSources = ['fb', 'facebook', 'ig', 'instagram', 'meta', 'audience_network', 'messenger', 'an'];
        const normalizedSource = utmSource.toLowerCase();
        const sourceToStore = fbSources.some(s => normalizedSource.includes(s)) ? 'fb' : utmSource;
        storeUtm(sourceToStore);
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
      } else {
        // No UTM in URL - try to infer from referrer if we don't already have one
        const existingUtm = localStorage.getItem('promo_source_global') || getUtmCookie();
        if (!existingUtm) {
          const inferredUtm = inferUtmFromReferrer();
          if (inferredUtm) {
            storeUtm(inferredUtm);
            console.log('🎯 UTM inferred from referrer:', inferredUtm);
          }
        }
      }
      
      // Log current UTM state for debugging
      const currentUtm = localStorage.getItem('promo_source_global') || getUtmCookie();
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
const HomePage = lazy(() => import('./pages/HomePageNew'));
const DemoPage = lazy(() => import('./pages/DemoPage'));
const TalentOnboardingPage = lazy(() => import('./pages/TalentOnboardingPage'));
const PublicTalentOnboardingPage = lazy(() => import('./pages/PublicTalentOnboardingPage'));
const OrderFulfillmentPage = lazy(() => import('./pages/OrderFulfillmentPage'));
const OrderPage = lazy(() => import('./pages/OrderPage'));
const TalentProfilePage = lazy(() => import('./pages/TalentProfilePage'));
const SignupPage = lazy(() => import('./pages/SignupPage')); // Unified login/register page
const AdminLoginPage = lazy(() => import('./pages/AdminLoginPage')); // Admin-only login
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const SeedDataPage = lazy(() => import('./pages/SeedDataPage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const HelpPage = lazy(() => import('./pages/HelpPage'));
const ReviewPage = lazy(() => import('./pages/ReviewPage'));
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage'));
const TermsOfServicePage = lazy(() => import('./pages/TermsOfServicePage'));
const CommunityGuidelinesPage = lazy(() => import('./pages/CommunityGuidelinesPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const EmailTestPage = lazy(() => import('./pages/EmailTestPage'));
const InstagramCallbackPage = lazy(() => import('./pages/InstagramCallbackPage'));
const WelcomePage = lazy(() => import('./pages/WelcomePage'));
const ShortLinkRedirectPage = lazy(() => import('./pages/ShortLinkRedirectPage'));
const OrderSuccessPage = lazy(() => import('./pages/OrderSuccessPage'));
const PayoutSetupPage = lazy(() => import('./pages/PayoutSetupPage'));
const CreatorsPage = lazy(() => import('./pages/CreatorsPage'));
const TalentStartPage = lazy(() => import('./pages/TalentStartPage'));
const OccasionLandingPage = lazy(() => import('./pages/OccasionLandingPage'));
const ChangePhonePage = lazy(() => import('./pages/ChangePhonePage'));

// Redirect component for old /profile/ URLs
const ProfileRedirect: React.FC = () => {
  const { username } = useParams<{ username: string }>();
  return <Navigate to={`/${username}`} replace />;
};

// Redirect /signup to /login while preserving query params
const SignupRedirect: React.FC = () => {
  const [searchParams] = useSearchParams();
  const queryString = searchParams.toString();
  return <Navigate to={`/login${queryString ? `?${queryString}` : ''}`} replace />;
};

// Promo redirect component - redirects short names to talent profiles with UTM and coupon
const PromoRedirect: React.FC<{ utm: string; destination?: string; coupon?: string }> = ({ utm, destination = '/', coupon }) => {
  React.useEffect(() => {
    // Store the UTM and coupon before redirecting
    if (typeof window !== 'undefined') {
      localStorage.setItem('promo_source_global', utm);
      localStorage.setItem('promo_source', utm);
      try {
        sessionStorage.setItem('promo_source_global', utm);
        sessionStorage.setItem('promo_source', utm);
      } catch (e) {}
      
      // Store coupon for auto-apply
      if (coupon) {
        localStorage.setItem('auto_coupon', coupon);
        try {
          sessionStorage.setItem('auto_coupon', coupon);
        } catch (e) {}
      }
      
      // Build redirect URL with UTM and coupon
      const params = new URLSearchParams();
      params.set('utm', utm);
      if (coupon) {
        params.set('coupon', coupon);
      }
      
      // Use full page navigation to ensure proper loading
      window.location.href = `${destination}?${params.toString()}`;
    }
  }, [utm, destination, coupon]);
  
  // Show loading while redirecting
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Redirecting...</p>
      </div>
    </div>
  );
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
            
            {/* Unified login/register - both routes use same component */}
            <Route path="/login" element={<SignupPage />} />
            <Route path="/signup" element={<SignupRedirect />} />
            <Route path="/admin/login" element={<AdminLoginPage />} />
            <Route path="/change-phone/:token" element={<ChangePhonePage />} />
            <Route path="/onboarding" element={<PublicTalentOnboardingPage />} />
            <Route path="/start" element={<TalentStartPage />} />
            
            {/* Promo redirects - short name variations to talent profiles with UTM and auto-discount */}
            {/* Shawn variations -> shawnfarash profile with 15% off */}
            <Route path="/shawn" element={<PromoRedirect utm="shawnlive" destination="/shawnfarash" coupon="SAVE15" />} />
            <Route path="/shaun" element={<PromoRedirect utm="shawnlive" destination="/shawnfarash" coupon="SAVE15" />} />
            <Route path="/sean" element={<PromoRedirect utm="shawnlive" destination="/shawnfarash" coupon="SAVE15" />} />
            <Route path="/shon" element={<PromoRedirect utm="shawnlive" destination="/shawnfarash" coupon="SAVE15" />} />
            {/* Hayley variations -> hayleycaronia profile with 15% off */}
            <Route path="/hayley" element={<PromoRedirect utm="hayleylive" destination="/hayleycaronia" coupon="SAVE15" />} />
            <Route path="/hailey" element={<PromoRedirect utm="hayleylive" destination="/hayleycaronia" coupon="SAVE15" />} />
            <Route path="/haley" element={<PromoRedirect utm="hayleylive" destination="/hayleycaronia" coupon="SAVE15" />} />
            <Route path="/hailee" element={<PromoRedirect utm="hayleylive" destination="/hayleycaronia" coupon="SAVE15" />} />
            <Route path="/haily" element={<PromoRedirect utm="hayleylive" destination="/hayleycaronia" coupon="SAVE15" />} />
            {/* Jeremy variations -> jeremyherrell profile with 15% off */}
            <Route path="/jeremy" element={<PromoRedirect utm="jeremylive" destination="/jeremyherrell" coupon="SAVE15" />} />
            <Route path="/jeramy" element={<PromoRedirect utm="jeremylive" destination="/jeremyherrell" coupon="SAVE15" />} />
            <Route path="/jeremey" element={<PromoRedirect utm="jeremylive" destination="/jeremyherrell" coupon="SAVE15" />} />
            <Route path="/jeremiah" element={<PromoRedirect utm="jeremylive" destination="/jeremyherrell" coupon="SAVE15" />} />
            {/* Melonie variations -> meloniemac profile with 15% off */}
            <Route path="/melonie" element={<PromoRedirect utm="melonielive" destination="/meloniemac" coupon="SAVE15" />} />
            <Route path="/melony" element={<PromoRedirect utm="melonielive" destination="/meloniemac" coupon="SAVE15" />} />
            <Route path="/melody" element={<PromoRedirect utm="melonielive" destination="/meloniemac" coupon="SAVE15" />} />
            <Route path="/melanie" element={<PromoRedirect utm="melonielive" destination="/meloniemac" coupon="SAVE15" />} />
            <Route path="/meloni" element={<PromoRedirect utm="melonielive" destination="/meloniemac" coupon="SAVE15" />} />
            {/* Chris variations -> chrissalcedo profile with 15% off */}
            <Route path="/chris" element={<PromoRedirect utm="chrislive" destination="/chrissalcedo" coupon="SAVE15" />} />
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
            <Route path="/community-guidelines" element={<CommunityGuidelinesPage />} />
            
            {/* Main app routes with layout */}
            <Route path="/" element={<Layout />}>
              <Route index element={<HomePage />} />
              <Route path="/home" element={<Navigate to="/" replace />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/creators" element={<CreatorsPage />} />
              
              {/* Occasion landing pages - must be before /:username catch-all */}
              <Route path="/birthday" element={<OccasionLandingPage />} />
              <Route path="/roast" element={<OccasionLandingPage />} />
              <Route path="/encourage" element={<OccasionLandingPage />} />
              <Route path="/advice" element={<OccasionLandingPage />} />
              <Route path="/celebrate" element={<OccasionLandingPage />} />
              <Route path="/announcement" element={<OccasionLandingPage />} />
              <Route path="/debate" element={<OccasionLandingPage />} />
              <Route path="/corporate" element={<OccasionLandingPage />} />
              
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
