# Code Optimization Tasks - Scale to 100k Users

**Target:** 100,000 monthly users + 500 orders/month  
**Timeline:** 4 weeks  
**Developer Focus:** Performance, Security, Code Quality  

---

## 📋 Priority 1: Security Fixes (CRITICAL)

### Task 1.1: Remove Client-Side Bank Encryption
**Files to Delete:**
- `src/services/encryption.ts`

**Files to Update:**
- `env.example` - Remove `REACT_APP_BANK_ENCRYPTION_KEY`
- Any Railway/Vercel env vars - Remove `REACT_APP_BANK_ENCRYPTION_KEY`

**New Edge Function:** `supabase/functions/save-bank-info/index.ts`
```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const ENCRYPTION_KEY = Deno.env.get('BANK_ENCRYPTION_KEY'); // Server-side only!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple AES-256-GCM encryption
async function encrypt(text: string, key: string): Promise<{encrypted: string, iv: string}> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const keyData = encoder.encode(key.substring(0, 32)); // Use first 32 chars
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );
  
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    data
  );
  
  return {
    encrypted: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
    iv: btoa(String.fromCharCode(...iv))
  };
}

function maskAccountNumber(accountNumber: string): string {
  if (!accountNumber || accountNumber.length < 4) return '****';
  return '****' + accountNumber.slice(-4);
}

function maskRoutingNumber(routingNumber: string): string {
  if (!routingNumber || routingNumber.length < 4) return '****';
  return '****' + routingNumber.slice(-4);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { talent_id, account_holder_name, bank_name, account_number, routing_number, account_type } = await req.json();

    if (!talent_id || !account_number) {
      throw new Error('Missing required fields');
    }

    // Encrypt on server
    const encryptedAccount = await encrypt(account_number, ENCRYPTION_KEY!);
    const encryptedRouting = routing_number ? await encrypt(routing_number, ENCRYPTION_KEY!) : null;

    // Save to database with service role
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const { error } = await supabase
      .from('vendor_bank_info')
      .upsert({
        talent_id,
        account_holder_name,
        bank_name,
        account_type,
        account_number_encrypted: encryptedAccount.encrypted,
        account_number_iv: encryptedAccount.iv,
        routing_number_encrypted: encryptedRouting?.encrypted,
        routing_number_iv: encryptedRouting?.iv,
        account_number_masked: maskAccountNumber(account_number),
        routing_number_masked: maskRoutingNumber(routing_number),
        is_verified: false
      }, {
        onConflict: 'talent_id'
      });

    if (error) throw error;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error saving bank info:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
```

**Update:** `src/components/TalentDashboard.tsx` (or wherever bank info is entered)
```typescript
// OLD (DELETE THIS):
import { bankEncryption } from '../services/encryption';
const { encryptedAccount } = await bankEncryption.encryptBankInfo(...);

// NEW (USE THIS):
const { data, error } = await supabase.functions.invoke('save-bank-info', {
  body: {
    talent_id: talentProfile.id,
    account_holder_name: formData.account_holder_name,
    bank_name: formData.bank_name,
    account_number: formData.account_number,
    routing_number: formData.routing_number,
    account_type: formData.account_type
  }
});

if (error) throw error;
toast.success('Bank information saved securely');
```

**Deploy:**
```bash
supabase functions deploy save-bank-info
supabase secrets set BANK_ENCRYPTION_KEY=your_secure_key_here
```

**Time:** 2 hours  
**Impact:** CRITICAL - Removes security vulnerability

---

### Task 1.2: Add Input Validation with Zod
**Install:**
```bash
npm install zod
```

**New File:** `src/utils/validation.ts`
```typescript
import { z } from 'zod';

export const orderSchema = z.object({
  talent_id: z.string().uuid('Invalid talent ID'),
  recipient_name: z.string()
    .min(1, 'Recipient name is required')
    .max(100, 'Name too long'),
  recipient_email: z.string()
    .email('Invalid email address')
    .max(255, 'Email too long'),
  occasion: z.string()
    .min(1, 'Occasion is required')
    .max(100, 'Occasion too long'),
  message: z.string()
    .min(1, 'Message is required')
    .max(500, 'Message too long (max 500 characters)'),
  pricing: z.number()
    .positive('Price must be positive')
    .max(10000, 'Price exceeds maximum'),
  video_type: z.enum(['personal', 'business']),
  promotional_use: z.boolean().optional(),
});

export const talentProfileSchema = z.object({
  temp_full_name: z.string()
    .min(1, 'Name is required')
    .max(100, 'Name too long'),
  bio: z.string()
    .min(10, 'Bio must be at least 10 characters')
    .max(500, 'Bio too long (max 500 characters)'),
  pricing: z.number()
    .positive('Price must be positive')
    .min(5, 'Minimum price is $5')
    .max(10000, 'Price exceeds maximum'),
  category: z.string().min(1, 'Category is required'),
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username too long')
    .regex(/^[a-z0-9_]+$/, 'Username can only contain lowercase letters, numbers, and underscores'),
  fulfillment_time_hours: z.number()
    .int('Must be whole hours')
    .min(1, 'Minimum 1 hour')
    .max(168, 'Maximum 7 days (168 hours)'),
  charity_percentage: z.number()
    .min(0)
    .max(100)
    .optional(),
});

export const messageSchema = z.object({
  message: z.string()
    .min(1, 'Message is required')
    .max(1000, 'Message too long (max 1000 characters)'),
  user_id: z.string().uuid(),
});

export const emailSchema = z.string()
  .email('Invalid email address')
  .max(255, 'Email too long');

export const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain uppercase letter')
  .regex(/[a-z]/, 'Password must contain lowercase letter')
  .regex(/[0-9]/, 'Password must contain number');
```

**Update:** `src/pages/OrderPage.tsx`
```typescript
import { orderSchema } from '../utils/validation';

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  
  try {
    // Validate before processing
    const validatedData = orderSchema.parse({
      talent_id: talentId,
      recipient_name: formData.recipientName,
      recipient_email: formData.recipientEmail,
      occasion: formData.occasion,
      message: formData.message,
      pricing: pricing.total,
      video_type: formData.videoType,
      promotional_use: formData.promotionalUse,
    });
    
    // Continue with order processing...
  } catch (error) {
    if (error instanceof z.ZodError) {
      toast.error(error.errors[0].message);
      return;
    }
    // Handle other errors...
  }
};
```

**Update:** `src/pages/TalentOnboardingPage.tsx`
```typescript
import { talentProfileSchema } from '../utils/validation';

const handleStep2Submit = async (e: React.FormEvent) => {
  e.preventDefault();
  
  try {
    const validatedData = talentProfileSchema.parse({
      temp_full_name: profileData.fullName,
      bio: profileData.bio,
      pricing: Number(profileData.pricing),
      category: profileData.category,
      username: profileData.username,
      fulfillment_time_hours: Number(profileData.fulfillmentTime),
      charity_percentage: profileData.charityPercentage ? Number(profileData.charityPercentage) : 0,
    });
    
    // Continue with submission...
  } catch (error) {
    if (error instanceof z.ZodError) {
      toast.error(error.errors[0].message);
      return;
    }
  }
};
```

**Update:** `src/components/HelpDesk.tsx`
```typescript
import { messageSchema } from '../utils/validation';

const sendMessage = async (e: React.FormEvent) => {
  e.preventDefault();
  
  try {
    messageSchema.parse({
      message: newMessage,
      user_id: user.id,
    });
    
    // Continue with sending...
  } catch (error) {
    if (error instanceof z.ZodError) {
      toast.error(error.errors[0].message);
      return;
    }
  }
};
```

**Time:** 3 hours  
**Impact:** HIGH - Prevents bad data, improves security

---

### Task 1.3: Add Security Headers
**Update:** `server.js`
```javascript
const express = require('express');
const path = require('path');
const prerender = require('prerender-node');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// SECURITY HEADERS
// ============================================
app.use((req, res, next) => {
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Force HTTPS
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  
  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Permissions policy (disable unnecessary features)
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  // Content Security Policy (adjust for your specific needs)
  res.setHeader('Content-Security-Policy', 
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' *.supabase.co *.cloudinary.com https://js.stripe.com; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https: *.wasabisys.com *.cloudinary.com videos.shoutout.us images.shoutout.us; " +
    "font-src 'self' data:; " +
    "connect-src 'self' *.supabase.co *.wasabisys.com *.cloudinary.com *.mailgun.net *.lunarpay.com wss://*.supabase.co; " +
    "media-src 'self' *.wasabisys.com *.cloudinary.com videos.shoutout.us; " +
    "frame-src 'self' https://js.stripe.com; " +
    "object-src 'none'; " +
    "base-uri 'self';"
  );
  
  next();
});

// Prerender.io middleware
if (process.env.PRERENDER_TOKEN) {
  console.log('✅ Prerender.io middleware enabled');
  app.use(prerender.set('prerenderToken', process.env.PRERENDER_TOKEN));
}

// Serve static files
app.use(express.static(path.join(__dirname, 'build')));

// Catch-all route - serve index.html
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
```

**Time:** 30 minutes  
**Impact:** HIGH - Protects against XSS, clickjacking, MIME sniffing

---

### Task 1.4: Add Rate Limiting to Edge Functions
**Update ALL Edge Functions** (watermark-video, activecampaign-add, onboarding-complete-notification, etc.)

**Add to each function:**
```typescript
// Add at the top of each Edge Function

interface RateLimitEntry {
  key: string;
  count: number;
  window_start: string;
}

async function checkRateLimit(
  supabase: any, 
  identifier: string, 
  functionName: string, 
  maxRequests = 100, 
  windowMs = 60000
): Promise<boolean> {
  const rateLimitKey = `${functionName}:${identifier}`;
  const now = Date.now();
  
  // Get current rate limit entry
  const { data: existing } = await supabase
    .from('rate_limits')
    .select('*')
    .eq('key', rateLimitKey)
    .single();
  
  if (existing) {
    const windowStart = new Date(existing.window_start).getTime();
    
    // If still within window
    if (now - windowStart < windowMs) {
      if (existing.count >= maxRequests) {
        return false; // Rate limit exceeded
      }
      
      // Increment count
      await supabase
        .from('rate_limits')
        .update({ count: existing.count + 1 })
        .eq('key', rateLimitKey);
    } else {
      // New window
      await supabase
        .from('rate_limits')
        .update({ count: 1, window_start: new Date(now).toISOString() })
        .eq('key', rateLimitKey);
    }
  } else {
    // First request
    await supabase
      .from('rate_limits')
      .insert({
        key: rateLimitKey,
        count: 1,
        window_start: new Date(now).toISOString()
      });
  }
  
  return true; // Allowed
}

// In your serve() function:
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get client identifier (IP or user ID)
    const clientIP = req.headers.get('x-forwarded-for') || 'unknown';
    
    // Check rate limit
    const allowed = await checkRateLimit(supabase, clientIP, 'function-name', 100, 60000);
    if (!allowed) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Continue with function logic...
  } catch (error: any) {
    // Error handling...
  }
});
```

**Create Database Table:**
```sql
-- Run in Supabase SQL Editor
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for cleanup
CREATE INDEX idx_rate_limits_window_start ON rate_limits(window_start);

-- Cleanup old entries (run daily)
DELETE FROM rate_limits WHERE window_start < NOW() - INTERVAL '1 day';
```

**Time:** 4 hours (apply to all functions)  
**Impact:** HIGH - Prevents abuse, DoS attacks

---

## 📋 Priority 2: Performance Optimizations

### Task 2.1: Add React Code Splitting
**Update:** `src/App.tsx`
```typescript
import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import { Toaster } from 'react-hot-toast';

// ============================================
// LOADING COMPONENT
// ============================================
const LoadingSpinner = () => (
  <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #111827 0%, #1a1f35 25%, #1f1b2e 50%, #1a1f35 75%, #111827 100%)' }}>
    <div className="text-center">
      <div className="animate-spin rounded-full h-32 w-32 border-b-4 border-white mx-auto mb-4"></div>
      <p className="text-white text-lg">Loading...</p>
    </div>
  </div>
);

// ============================================
// LAZY LOAD ALL PAGES (Code Splitting)
// ============================================
const ComingSoonPage = lazy(() => import('./pages/ComingSoonPage'));
const HomePage = lazy(() => import('./pages/HomePage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const SignupPage = lazy(() => import('./pages/SignupPage'));
const TalentProfilePage = lazy(() => import('./pages/TalentProfilePage'));
const OrderPage = lazy(() => import('./pages/OrderPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ReviewPage = lazy(() => import('./pages/ReviewPage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const HelpPage = lazy(() => import('./pages/HelpPage'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage'));
const TermsOfServicePage = lazy(() => import('./pages/TermsOfServicePage'));
const TalentOnboardingPage = lazy(() => import('./pages/TalentOnboardingPage'));
const SeedDataPage = lazy(() => import('./pages/SeedDataPage'));

function App() {
  return (
    <Router>
      <AuthProvider>
        <Suspense fallback={<LoadingSpinner />}>
          <Routes>
            <Route path="/" element={<ComingSoonPage />} />
            <Route path="/home" element={<Layout><HomePage /></Layout>} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            
            {/* Talent routes - username first for priority matching */}
            <Route path="/:username" element={<Layout><TalentProfilePage /></Layout>} />
            <Route path="/talent/:id" element={<Layout><TalentProfilePage /></Layout>} />
            
            <Route path="/order/:id" element={
              <ProtectedRoute>
                <Layout><OrderPage /></Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <Layout><DashboardPage /></Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/review/:orderId" element={
              <ProtectedRoute>
                <Layout><ReviewPage /></Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/notifications" element={
              <ProtectedRoute>
                <Layout><NotificationsPage /></Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/help" element={
              <ProtectedRoute>
                <Layout><HelpPage /></Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/admin" element={
              <ProtectedRoute adminOnly>
                <Layout><AdminDashboard /></Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/privacy" element={<Layout><PrivacyPolicyPage /></Layout>} />
            <Route path="/terms" element={<Layout><TermsOfServicePage /></Layout>} />
            <Route path="/onboarding/:token" element={<TalentOnboardingPage />} />
            <Route path="/seed-data" element={
              <ProtectedRoute adminOnly>
                <SeedDataPage />
              </ProtectedRoute>
            } />
            
            <Route path="*" element={<Navigate to="/home" replace />} />
          </Routes>
        </Suspense>
        <Toaster position="top-right" />
      </AuthProvider>
    </Router>
  );
}

export default App;
```

**Result:**
- Initial bundle size reduced by 60-70%
- Faster initial page load
- Each route loads on-demand

**Time:** 1 hour  
**Impact:** HIGH - Faster load times

---

### Task 2.2: Memoize Heavy Components
**Update:** `src/components/TalentCard.tsx`
```typescript
import React, { memo } from 'react';

const TalentCard: React.FC<TalentCardProps> = memo(({ talent }) => {
  // ... existing code (no changes needed inside)
}, (prevProps, nextProps) => {
  // Only re-render if these specific fields changed
  return (
    prevProps.talent.id === nextProps.talent.id &&
    prevProps.talent.average_rating === nextProps.talent.average_rating &&
    prevProps.talent.total_orders === nextProps.talent.total_orders &&
    prevProps.talent.temp_avatar_url === nextProps.talent.temp_avatar_url
  );
});

TalentCard.displayName = 'TalentCard';

export default TalentCard;
```

**Apply memo() to these components:**
- `src/components/TalentCard.tsx` ✅ (above)
- `src/components/VideoPlayer.tsx`
- `src/components/NotificationCenter.tsx`
- `src/components/FeaturedCarousel.tsx`

**Example for VideoPlayer:**
```typescript
import React, { memo } from 'react';

const VideoPlayer: React.FC<VideoPlayerProps> = memo(({ videoUrl, thumbnail }) => {
  // ... existing code
}, (prevProps, nextProps) => {
  return prevProps.videoUrl === nextProps.videoUrl;
});

VideoPlayer.displayName = 'VideoPlayer';
export default VideoPlayer;
```

**Time:** 2 hours  
**Impact:** MEDIUM - Reduces unnecessary re-renders

---

### Task 2.3: Add Pagination to HomePage
**Update:** `src/pages/HomePage.tsx`
```typescript
import React, { useState, useEffect } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

const HomePage: React.FC = () => {
  const [talent, setTalent] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  
  const TALENTS_PER_PAGE = 20;

  const fetchTalent = async () => {
    setLoading(true);
    try {
      // Get count
      const { count } = await supabase
        .from('talent_profiles')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)
        .eq('onboarding_completed', true);

      // Get page of results
      const { data, error } = await supabase
        .from('talent_profiles')
        .select(`
          id,
          username,
          temp_full_name,
          temp_avatar_url,
          bio,
          pricing,
          average_rating,
          total_orders,
          fulfilled_orders,
          category,
          categories,
          position,
          charity_name,
          charity_percentage,
          allow_corporate_pricing,
          corporate_pricing,
          users:user_id(id, full_name, avatar_url)
        `)
        .eq('is_active', true)
        .eq('onboarding_completed', true)
        .range((currentPage - 1) * TALENTS_PER_PAGE, currentPage * TALENTS_PER_PAGE - 1)
        .order('total_orders', { ascending: false });

      if (error) throw error;
      
      setTalent(data || []);
      setTotalPages(Math.ceil((count || 0) / TALENTS_PER_PAGE));
    } catch (error) {
      console.error('Error fetching talent:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTalent();
  }, [currentPage]);

  // ... existing code for categories, featured, etc.

  return (
    <div className="min-h-screen">
      {/* ... existing hero section ... */}

      {/* Talent Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="glass rounded-3xl h-96 animate-pulse"></div>
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {talent.map((t) => (
                <TalentCard key={t.id} talent={t} />
              ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center mt-12 space-x-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="glass-strong p-3 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:glass transition-all border border-white/30"
                >
                  <ChevronLeftIcon className="h-5 w-5 text-white" />
                </button>
                
                <div className="flex items-center space-x-1">
                  {[...Array(totalPages)].map((_, i) => {
                    const pageNum = i + 1;
                    // Show first, last, current, and adjacent pages
                    if (
                      pageNum === 1 ||
                      pageNum === totalPages ||
                      Math.abs(pageNum - currentPage) <= 1
                    ) {
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`px-4 py-2 rounded-xl font-medium transition-all border border-white/30 ${
                            currentPage === pageNum
                              ? 'bg-blue-600 text-white'
                              : 'glass-strong text-white hover:glass'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    } else if (Math.abs(pageNum - currentPage) === 2) {
                      return <span key={pageNum} className="text-white px-2">...</span>;
                    }
                    return null;
                  })}
                </div>

                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="glass-strong p-3 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:glass transition-all border border-white/30"
                >
                  <ChevronRightIcon className="h-5 w-5 text-white" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
```

**Time:** 1 hour  
**Impact:** HIGH - Reduces data transfer, faster page loads

---

### Task 2.4: Optimize Supabase Queries
**Create:** `src/utils/queries.ts`
```typescript
import { supabase } from '../services/supabase';

// ============================================
// CENTRALIZED, OPTIMIZED QUERIES
// ============================================

export const getTalentList = (page = 1, limit = 20) => 
  supabase
    .from('talent_profiles')
    .select(`
      id,
      username,
      temp_full_name,
      temp_avatar_url,
      bio,
      pricing,
      average_rating,
      total_orders,
      fulfilled_orders,
      category,
      categories,
      position,
      charity_name,
      charity_percentage,
      allow_corporate_pricing,
      corporate_pricing,
      users:user_id(id, full_name, avatar_url)
    `)
    .eq('is_active', true)
    .eq('onboarding_completed', true)
    .range((page - 1) * limit, page * limit - 1)
    .order('total_orders', { ascending: false });

export const getFeaturedTalent = () =>
  supabase
    .from('talent_profiles')
    .select(`
      id,
      username,
      temp_full_name,
      temp_avatar_url,
      bio,
      pricing,
      fulfillment_time_hours,
      charity_name,
      charity_percentage,
      users:user_id(id, full_name, avatar_url)
    `)
    .eq('is_featured', true)
    .eq('is_active', true)
    .eq('onboarding_completed', true)
    .limit(5);

export const getTalentProfile = (username: string) =>
  supabase
    .from('talent_profiles')
    .select(`
      *,
      users:user_id(*),
      social_accounts(*),
      reviews:reviews(
        id,
        rating,
        comment,
        created_at,
        users:user_id(full_name)
      )
    `)
    .eq('username', username)
    .single();

export const getUserOrders = (userId: string, page = 1, limit = 10) =>
  supabase
    .from('orders')
    .select(`
      id,
      created_at,
      status,
      recipient_name,
      occasion,
      pricing,
      video_url,
      review_id,
      talent_profiles:talent_id(
        id,
        temp_full_name,
        temp_avatar_url,
        username
      )
    `)
    .eq('user_id', userId)
    .range((page - 1) * limit, page * limit - 1)
    .order('created_at', { ascending: false });

export const getTalentOrders = (talentId: string, status?: string, page = 1, limit = 10) => {
  let query = supabase
    .from('orders')
    .select(`
      id,
      created_at,
      status,
      recipient_name,
      occasion,
      message,
      pricing,
      video_url,
      users:user_id(id, full_name, email)
    `)
    .eq('talent_id', talentId)
    .range((page - 1) * limit, page * limit - 1)
    .order('created_at', { ascending: false });
  
  if (status) {
    query = query.eq('status', status);
  }
  
  return query;
};

export const getNotifications = (userId: string, limit = 20) =>
  supabase
    .from('notifications')
    .select('id, type, title, message, is_read, created_at, order_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

export const getHelpMessages = (userId: string) =>
  supabase
    .from('help_messages')
    .select('id, message, response, is_human_takeover, is_resolved, created_at, updated_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

// ============================================
// SEARCH QUERIES
// ============================================

export const searchTalent = (query: string, category?: string, page = 1, limit = 20) => {
  let search = supabase
    .from('talent_profiles')
    .select(`
      id,
      username,
      temp_full_name,
      temp_avatar_url,
      bio,
      pricing,
      average_rating,
      total_orders,
      category,
      categories,
      users:user_id(id, full_name, avatar_url)
    `)
    .eq('is_active', true)
    .eq('onboarding_completed', true)
    .or(`temp_full_name.ilike.%${query}%,bio.ilike.%${query}%,position.ilike.%${query}%`)
    .range((page - 1) * limit, page * limit - 1);
  
  if (category) {
    search = search.eq('category', category);
  }
  
  return search.order('total_orders', { ascending: false });
};
```

**Update all files to use these:**
- `src/pages/HomePage.tsx` → Use `getTalentList()`, `getFeaturedTalent()`
- `src/pages/TalentProfilePage.tsx` → Use `getTalentProfile()`
- `src/pages/DashboardPage.tsx` → Use `getUserOrders()`, `getTalentOrders()`
- `src/pages/NotificationsPage.tsx` → Use `getNotifications()`
- `src/pages/HelpPage.tsx` → Use `getHelpMessages()`

**Time:** 3 hours  
**Impact:** HIGH - Reduces data transfer by 40-60%

---

### Task 2.5: Add Image Optimization
**Update:** `src/components/TalentCard.tsx`
```typescript
// Add loading="lazy" to all images for lazy loading
<img
  src={talent.temp_avatar_url || talent.users.avatar_url}
  alt={talent.temp_full_name || talent.users.full_name}
  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
  loading="lazy"
  decoding="async"
/>
```

**Apply to all image tags in:**
- `TalentCard.tsx`
- `TalentProfilePage.tsx`
- `FeaturedCarousel.tsx`
- `UserDashboard.tsx`
- `TalentDashboard.tsx`

**Time:** 30 minutes  
**Impact:** MEDIUM - Faster initial page load

---

## 📋 Priority 3: Monitoring & Error Tracking

### Task 3.1: Add Sentry Integration
**Install:**
```bash
npm install @sentry/react @sentry/tracing
```

**Update:** `src/index.tsx`
```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import * as Sentry from "@sentry/react";
import { BrowserTracing } from "@sentry/tracing";

// ============================================
// SENTRY ERROR TRACKING
// ============================================
if (process.env.REACT_APP_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.REACT_APP_SENTRY_DSN,
    integrations: [
      new BrowserTracing(),
    ],
    tracesSampleRate: 0.1, // 10% of transactions
    environment: process.env.NODE_ENV,
    beforeSend(event) {
      // Don't send errors in development
      if (process.env.NODE_ENV === 'development') {
        return null;
      }
      return event;
    },
  });
}

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <Sentry.ErrorBoundary fallback={<ErrorFallback />}>
      <App />
    </Sentry.ErrorBoundary>
  </React.StrictMode>
);

// Error Fallback Component
function ErrorFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="text-center p-8">
        <h1 className="text-4xl font-bold text-white mb-4">Oops! Something went wrong</h1>
        <p className="text-gray-400 mb-6">We're sorry for the inconvenience. Our team has been notified.</p>
        <button
          onClick={() => window.location.href = '/home'}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Go to Homepage
        </button>
      </div>
    </div>
  );
}

reportWebVitals();
```

**Add error tracking to async operations:**
```typescript
// Example in any component
import * as Sentry from "@sentry/react";

try {
  const result = await someAsyncOperation();
} catch (error) {
  Sentry.captureException(error, {
    tags: { component: 'OrderPage', action: 'submitOrder' },
    extra: { userId: user.id, orderId: orderId }
  });
  toast.error('An error occurred. Our team has been notified.');
}
```

**Time:** 2 hours  
**Impact:** HIGH - Proactive error detection

---

### Task 3.2: Add ErrorBoundary Component
**New File:** `src/components/ErrorBoundary.tsx`
```typescript
import React, { Component, ErrorInfo, ReactNode } from 'react';
import * as Sentry from "@sentry/react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught error:', error, errorInfo);
    
    // Send to Sentry
    if (process.env.REACT_APP_SENTRY_DSN) {
      Sentry.captureException(error, {
        contexts: {
          react: {
            componentStack: errorInfo.componentStack,
          },
        },
      });
    }
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #111827 0%, #1a1f35 100%)' }}>
          <div className="glass-strong rounded-3xl p-8 max-w-md text-center border border-white/30">
            <div className="text-6xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold text-white mb-4">Something went wrong</h1>
            <p className="text-gray-300 mb-6">
              We're sorry for the inconvenience. Our team has been notified and is working on a fix.
            </p>
            <div className="space-y-3">
              <button
                onClick={() => window.location.reload()}
                className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Reload Page
              </button>
              <button
                onClick={() => window.location.href = '/home'}
                className="w-full glass text-white px-6 py-3 rounded-lg hover:glass-strong transition-colors font-medium border border-white/30"
              >
                Go to Homepage
              </button>
            </div>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-6 text-left">
                <summary className="text-sm text-gray-400 cursor-pointer">Error Details (Dev Only)</summary>
                <pre className="text-xs text-red-400 mt-2 overflow-auto p-2 bg-black/30 rounded">
                  {this.state.error.stack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
```

**Wrap components in:** `src/App.tsx`
```typescript
import ErrorBoundary from './components/ErrorBoundary';

// Wrap routes in ErrorBoundary
<ErrorBoundary>
  <Routes>
    {/* ... routes ... */}
  </Routes>
</ErrorBoundary>
```

**Time:** 1 hour  
**Impact:** MEDIUM - Graceful error handling

---

### Task 3.3: Add Performance Monitoring
**New File:** `src/utils/analytics.ts`
```typescript
import * as Sentry from "@sentry/react";

// ============================================
// ANALYTICS & PERFORMANCE TRACKING
// ============================================

export const trackPageView = (pageName: string, properties?: object) => {
  console.log(`📊 Page view: ${pageName}`, properties);
  
  // Google Analytics (if configured)
  if (window.gtag) {
    window.gtag('event', 'page_view', {
      page_title: pageName,
      page_location: window.location.href,
      ...properties
    });
  }
  
  // PostHog (if configured)
  if (window.posthog) {
    window.posthog.capture('$pageview', { page: pageName, ...properties });
  }
};

export const trackEvent = (eventName: string, properties?: object) => {
  console.log(`📊 Event: ${eventName}`, properties);
  
  // Google Analytics
  if (window.gtag) {
    window.gtag('event', eventName, properties);
  }
  
  // PostHog
  if (window.posthog) {
    window.posthog.capture(eventName, properties);
  }
  
  // Sentry breadcrumb
  Sentry.addBreadcrumb({
    category: 'user-action',
    message: eventName,
    level: 'info',
    data: properties,
  });
};

export const trackError = (error: Error, context?: string, extra?: object) => {
  console.error(`❌ Error in ${context}:`, error);
  
  // Send to Sentry
  if (process.env.REACT_APP_SENTRY_DSN) {
    Sentry.captureException(error, {
      tags: { context },
      extra
    });
  }
};

export const trackTiming = (category: string, variable: string, timeMs: number) => {
  console.log(`⏱️ Timing: ${category}.${variable} = ${timeMs}ms`);
  
  // Google Analytics
  if (window.gtag) {
    window.gtag('event', 'timing_complete', {
      name: variable,
      value: timeMs,
      event_category: category,
    });
  }
  
  // Sentry transaction
  const transaction = Sentry.startTransaction({
    name: `${category}.${variable}`,
  });
  setTimeout(() => transaction.finish(), timeMs);
};

// Performance utilities
export const measureAsync = async <T,>(
  name: string,
  asyncFn: () => Promise<T>
): Promise<T> => {
  const start = performance.now();
  try {
    const result = await asyncFn();
    const duration = performance.now() - start;
    trackTiming('async', name, duration);
    return result;
  } catch (error) {
    trackError(error as Error, name);
    throw error;
  }
};

// Web Vitals tracking
export const trackWebVitals = () => {
  if ('web-vital' in window) {
    import('web-vitals').then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
      getCLS((metric) => trackTiming('web-vitals', 'CLS', metric.value));
      getFID((metric) => trackTiming('web-vitals', 'FID', metric.value));
      getFCP((metric) => trackTiming('web-vitals', 'FCP', metric.value));
      getLCP((metric) => trackTiming('web-vitals', 'LCP', metric.value));
      getTTFB((metric) => trackTiming('web-vitals', 'TTFB', metric.value));
    });
  }
};

// TypeScript declarations
declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    posthog?: any;
  }
}
```

**Use in components:**
```typescript
import { trackPageView, trackEvent, trackError, measureAsync } from '../utils/analytics';

// Track page views
useEffect(() => {
  trackPageView('HomePage', { category: selectedCategory });
}, [selectedCategory]);

// Track events
const handleOrderSubmit = async () => {
  trackEvent('order_submitted', { 
    talent_id: talentId, 
    amount: pricing.total 
  });
  // ... submit logic
};

// Track errors
try {
  await submitOrder();
} catch (error) {
  trackError(error as Error, 'OrderPage.submitOrder', { 
    talentId, 
    userId: user.id 
  });
}

// Measure performance
const talent = await measureAsync('fetchTalent', () => 
  supabase.from('talent_profiles').select('*')
);
```

**Time:** 2 hours  
**Impact:** MEDIUM - Visibility into user experience

---

## 📋 Priority 4: Code Quality Improvements

### Task 4.1: Add TypeScript Strict Mode
**Update:** `tsconfig.json`
```json
{
  "compilerOptions": {
    "target": "es5",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "noFallthroughCasesInSwitch": true,
    "module": "esnext",
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    
    // ENABLE STRICT MODE
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitAny": true,
    "noImplicitThis": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true
  },
  "include": ["src"]
}
```

**Fix type errors that arise** (will need to add proper types throughout)

**Time:** 4-6 hours  
**Impact:** MEDIUM - Catches bugs at compile time

---

### Task 4.2: Add ESLint Rules
**Install:**
```bash
npm install --save-dev eslint-plugin-react-hooks eslint-plugin-jsx-a11y
```

**Update:** `package.json`
```json
{
  "eslintConfig": {
    "extends": [
      "react-app",
      "react-app/jest"
    ],
    "plugins": ["react-hooks", "jsx-a11y"],
    "rules": {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "no-console": ["warn", { "allow": ["warn", "error"] }],
      "no-unused-vars": "warn",
      "prefer-const": "error",
      "no-var": "error",
      "jsx-a11y/alt-text": "error",
      "jsx-a11y/anchor-is-valid": "warn"
    }
  }
}
```

**Run linter:**
```bash
npm run lint
```

**Fix all errors and warnings**

**Time:** 2 hours  
**Impact:** MEDIUM - Code quality, accessibility

---

### Task 4.3: Add Loading States
**Update components to show better loading states:**

**Example:** `src/pages/HomePage.tsx`
```typescript
const HomePage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {loading ? (
        // Skeleton loaders
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="glass rounded-3xl overflow-hidden animate-pulse">
              <div className="aspect-square bg-white/10"></div>
              <div className="p-6 space-y-3">
                <div className="h-4 bg-white/10 rounded w-3/4"></div>
                <div className="h-4 bg-white/10 rounded w-1/2"></div>
                <div className="h-8 bg-white/10 rounded w-1/3"></div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        // Actual content
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {talent.map((t) => <TalentCard key={t.id} talent={t} />)}
        </div>
      )}
    </div>
  );
};
```

**Apply skeleton loaders to:**
- `HomePage.tsx`
- `TalentProfilePage.tsx`
- `DashboardPage.tsx`
- `NotificationsPage.tsx`

**Time:** 2 hours  
**Impact:** LOW - Better UX, perceived performance

---

## 📋 Priority 5: Database Interaction Improvements

### Task 5.1: Add Request Caching
**New File:** `src/utils/cache.ts`
```typescript
// Simple in-memory cache with TTL
class Cache {
  private cache: Map<string, { data: any; expiry: number }> = new Map();

  set(key: string, data: any, ttlMs: number = 60000) {
    this.cache.set(key, {
      data,
      expiry: Date.now() + ttlMs,
    });
  }

  get(key: string): any | null {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }

    return item.data;
  }

  clear() {
    this.cache.clear();
  }

  delete(key: string) {
    this.cache.delete(key);
  }
}

export const cache = new Cache();

// Usage wrapper for Supabase queries
export async function cachedQuery<T>(
  cacheKey: string,
  queryFn: () => Promise<T>,
  ttlMs: number = 60000
): Promise<T> {
  // Check cache first
  const cached = cache.get(cacheKey);
  if (cached !== null) {
    console.log(`✅ Cache hit: ${cacheKey}`);
    return cached as T;
  }

  // Execute query
  console.log(`⏳ Cache miss: ${cacheKey} - fetching...`);
  const result = await queryFn();
  
  // Store in cache
  cache.set(cacheKey, result, ttlMs);
  
  return result;
}

// Invalidate cache on mutations
export function invalidateCache(pattern: string) {
  // Invalidate all keys matching pattern
  cache.clear(); // Simple: clear all (or implement pattern matching)
}
```

**Use in queries:**
```typescript
import { cachedQuery, invalidateCache } from '../utils/cache';

// Cache talent list for 1 minute
const fetchTalent = async () => {
  const data = await cachedQuery(
    `talent-list-page-${currentPage}-cat-${selectedCategory}`,
    async () => {
      const { data } = await getTalentList(currentPage, 20);
      return data;
    },
    60000 // 1 minute
  );
  setTalent(data);
};

// Invalidate when data changes
const handleOrderSubmit = async () => {
  await submitOrder();
  invalidateCache('talent-list'); // Clear talent list cache
  invalidateCache('talent-profile'); // Clear profile cache
};
```

**Time:** 2 hours  
**Impact:** MEDIUM - Reduces database queries by 30-50%

---

### Task 5.2: Add Optimistic Updates
**Update:** `src/components/TalentDashboard.tsx`
```typescript
const handleStatusUpdate = async (orderId: string, newStatus: string) => {
  // Optimistic update - update UI immediately
  setOrders(prevOrders =>
    prevOrders.map(order =>
      order.id === orderId ? { ...order, status: newStatus } : order
    )
  );
  
  try {
    // Update database
    const { error } = await supabase
      .from('orders')
      .update({ status: newStatus })
      .eq('id', orderId);
    
    if (error) throw error;
    
    toast.success('Order updated');
  } catch (error) {
    // Rollback on error
    fetchOrders(); // Re-fetch to get correct state
    toast.error('Failed to update order');
  }
};
```

**Apply to:**
- Order status updates
- Notification read status
- Review submissions
- Help message sends

**Time:** 2 hours  
**Impact:** LOW - Better perceived performance

---

## 📋 Priority 6: Video Processing Optimization

### Task 6.1: Add Video Compression
**Update:** `src/services/videoUpload.ts`
```typescript
// Add before upload
const compressVideo = async (file: File): Promise<File> => {
  // Only compress if > 100MB
  if (file.size < 100 * 1024 * 1024) {
    return file;
  }
  
  // Use browser-based compression (or skip and compress server-side)
  toast.info('Compressing video for faster upload...');
  
  // For now, just return original
  // TODO: Implement actual compression or do server-side
  return file;
};

export const uploadVideoToWasabi = async (file: File, orderId: string) => {
  const compressedFile = await compressVideo(file);
  // ... continue with upload
};
```

**Better approach: Server-side compression in Edge Function**
- Videos compress after upload
- Don't block user experience
- Use FFmpeg in Edge Function or Cloudinary

**Time:** 4 hours (if implementing client-side) OR delegate to Edge Function  
**Impact:** MEDIUM - Faster uploads, less bandwidth

---

### Task 6.2: Add Video Progress Tracking
**Update:** `src/services/videoUpload.ts`
```typescript
export const uploadVideoToWasabi = async (
  file: File, 
  orderId: string,
  onProgress?: (progress: number) => void
): Promise<UploadResult> => {
  // ... existing S3 setup ...

  // Add progress tracking
  const upload = s3.upload({
    Bucket: bucketName,
    Key: key,
    Body: file,
    ContentType: file.type,
  });

  upload.on('httpUploadProgress', (progress) => {
    const percentComplete = Math.round((progress.loaded / progress.total) * 100);
    console.log(`Upload progress: ${percentComplete}%`);
    if (onProgress) {
      onProgress(percentComplete);
    }
  });

  const result = await upload.promise();
  // ... rest of code
};
```

**Update components:**
```typescript
const [uploadProgress, setUploadProgress] = useState(0);

const handleUpload = async () => {
  await uploadVideoToWasabi(file, orderId, (progress) => {
    setUploadProgress(progress);
  });
};

// Show progress bar
{uploading && (
  <div className="w-full bg-gray-200 rounded-full h-2">
    <div 
      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
      style={{ width: `${uploadProgress}%` }}
    ></div>
  </div>
)}
```

**Time:** 1 hour  
**Impact:** LOW - Better UX during uploads

---

## 📋 Priority 7: Testing & Quality Assurance

### Task 7.1: Add Unit Tests for Critical Functions
**Install:**
```bash
npm install --save-dev @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

**Create:** `src/utils/__tests__/validation.test.ts`
```typescript
import { orderSchema, talentProfileSchema } from '../validation';

describe('Validation Schemas', () => {
  describe('orderSchema', () => {
    it('should validate valid order data', () => {
      const validOrder = {
        talent_id: '123e4567-e89b-12d3-a456-426614174000',
        recipient_name: 'John Doe',
        recipient_email: 'john@example.com',
        occasion: 'Birthday',
        message: 'Happy birthday!',
        pricing: 50,
        video_type: 'personal' as const,
      };
      
      expect(() => orderSchema.parse(validOrder)).not.toThrow();
    });

    it('should reject invalid email', () => {
      const invalidOrder = {
        talent_id: '123e4567-e89b-12d3-a456-426614174000',
        recipient_name: 'John Doe',
        recipient_email: 'not-an-email',
        occasion: 'Birthday',
        message: 'Happy birthday!',
        pricing: 50,
        video_type: 'personal' as const,
      };
      
      expect(() => orderSchema.parse(invalidOrder)).toThrow();
    });
  });
});
```

**Add tests for:**
- Validation schemas
- Analytics utilities
- Query utilities
- Cache utilities

**Run tests:**
```bash
npm test
```

**Time:** 4 hours  
**Impact:** LOW - Prevents regressions

---

### Task 7.2: Add E2E Tests (Optional)
**Install Playwright:**
```bash
npm install --save-dev @playwright/test
```

**Create:** `tests/e2e/order-flow.spec.ts`
```typescript
import { test, expect } from '@playwright/test';

test('complete order flow', async ({ page }) => {
  // Navigate to homepage
  await page.goto('https://shoutout.us/home');
  
  // Find and click a talent
  await page.click('text=Tucker Carlson');
  
  // Verify profile page loaded
  await expect(page.locator('h1')).toContainText('Tucker Carlson');
  
  // Click Order button
  await page.click('text=Order ShoutOut');
  
  // Fill order form
  await page.fill('[name="recipient_name"]', 'Test User');
  await page.fill('[name="recipient_email"]', 'test@example.com');
  await page.fill('[name="occasion"]', 'Birthday');
  await page.fill('[name="message"]', 'Happy birthday from automated test!');
  
  // Submit order (skip payment in test)
  await page.click('text=Skip Payment');
  
  // Verify success
  await expect(page.locator('text=Order placed successfully')).toBeVisible();
});
```

**Time:** 6 hours  
**Impact:** LOW - Catches integration bugs

---

## 📋 Summary Checklist

### Week 1-2: Critical Security (MUST DO)
- [ ] Task 1.1: Remove client-side bank encryption (2 hours) ⚠️ CRITICAL
- [ ] Task 1.2: Add Zod input validation (3 hours) ⚠️ CRITICAL
- [ ] Task 1.3: Add security headers to server.js (30 min) ⚠️ CRITICAL
- [ ] Task 1.4: Add rate limiting to Edge Functions (4 hours)

**Total:** ~9.5 hours

---

### Week 3-4: Performance Optimization
- [ ] Task 2.1: Add React code splitting (1 hour)
- [ ] Task 2.2: Memoize heavy components (2 hours)
- [ ] Task 2.3: Add pagination to HomePage (1 hour)
- [ ] Task 2.4: Optimize Supabase queries (3 hours)
- [ ] Task 2.5: Add image lazy loading (30 min)
- [ ] Task 5.1: Add request caching (2 hours)
- [ ] Task 5.2: Add optimistic updates (2 hours)

**Total:** ~11.5 hours

---

### Week 5-6: Monitoring & Quality
- [ ] Task 3.1: Add Sentry integration (2 hours)
- [ ] Task 3.2: Add ErrorBoundary (1 hour)
- [ ] Task 3.3: Add performance monitoring (2 hours)
- [ ] Task 4.1: Enable TypeScript strict mode (4-6 hours)
- [ ] Task 4.2: Add ESLint rules (2 hours)
- [ ] Task 6.1: Add video compression (4 hours, optional)
- [ ] Task 6.2: Add upload progress (1 hour)

**Total:** ~16-18 hours

---

### Optional: Testing & Quality Assurance
- [ ] Task 4.3: Add loading states (2 hours)
- [ ] Task 7.1: Add unit tests (4 hours)
- [ ] Task 7.2: Add E2E tests (6 hours, optional)

**Total:** ~12 hours

---

## 🎯 Implementation Priority

### Must Have (Before 100k users):
1. ⚠️ Remove client-side bank encryption
2. ⚠️ Add input validation
3. ⚠️ Add security headers
4. ⚠️ Add React code splitting
5. ⚠️ Add pagination
6. ⚠️ Optimize queries
7. ⚠️ Add Sentry

### Should Have:
- Rate limiting
- Memoization
- Request caching
- Error boundaries
- Performance monitoring

### Nice to Have:
- TypeScript strict mode
- Video compression
- Upload progress
- E2E tests

---

## 📝 Testing Checklist

**After Each Change:**
- [ ] Test locally in development
- [ ] Check for TypeScript errors
- [ ] Run ESLint
- [ ] Test in production-like environment
- [ ] Check browser console for errors
- [ ] Verify no performance regression

**Before Deploying:**
- [ ] All tests pass
- [ ] No console errors
- [ ] Page load time < 3s
- [ ] No memory leaks (check Chrome DevTools)
- [ ] Mobile responsive
- [ ] Accessibility check (Lighthouse)

---

## 🚀 Deployment Process

### Development Workflow
```bash
# 1. Create feature branch
git checkout -b feature/add-pagination

# 2. Make changes
# ... code ...

# 3. Test locally
npm run dev

# 4. Commit
git add .
git commit -m "Add pagination to homepage"

# 5. Push
git push origin feature/add-pagination

# 6. Create PR on GitHub
# 7. Review on Vercel preview deployment
# 8. Merge to main
# 9. Auto-deploys to production
```

### Rollback Procedure
```bash
# If issues in production:

# Option 1: Revert commit
git revert HEAD
git push

# Option 2: Deploy previous version in Vercel
# Vercel Dashboard → Deployments → [Previous successful] → Promote to Production
```

---

## 📊 Success Metrics

### Code Performance
- [ ] Initial bundle size < 500KB (currently ~2MB)
- [ ] Code split into 5+ chunks
- [ ] Page load time < 2s (LCP)
- [ ] Time to Interactive < 3s

### Code Quality
- [ ] 0 TypeScript errors
- [ ] 0 ESLint errors
- [ ] Test coverage > 60% (critical paths)
- [ ] Lighthouse score > 90

### Security
- [ ] No secrets in client code
- [ ] All inputs validated
- [ ] Rate limiting on all endpoints
- [ ] Security headers configured

---

## 💡 Best Practices Going Forward

### Code Standards
- Always validate user input
- Never trust client data
- Keep secrets server-side only
- Use TypeScript strictly
- Write tests for critical flows
- Code review all PRs

### Performance
- Lazy load everything possible
- Memoize expensive components
- Cache API responses
- Paginate all lists
- Optimize images

### Security
- Assume all input is malicious
- Validate on both client and server
- Rate limit all endpoints
- Log all security events
- Rotate keys regularly

---

**Estimated Total Time:** 40-50 hours over 4-6 weeks  
**Impact:** Production-ready, scalable codebase for 100k+ users

