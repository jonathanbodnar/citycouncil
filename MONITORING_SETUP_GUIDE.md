# Error & Performance Monitoring Setup Guide

## Overview
This guide covers setting up Sentry for error tracking and performance monitoring in production.

## 🎯 Why Monitoring?

### Without Monitoring:
- ❌ Users encounter errors silently
- ❌ No visibility into production issues
- ❌ Can't reproduce bugs
- ❌ Don't know which errors are most common
- ❌ No performance bottleneck identification

### With Monitoring:
- ✅ Real-time error alerts
- ✅ Full error context & stack traces
- ✅ User session replay
- ✅ Performance metrics (LCP, FID, CLS)
- ✅ Release tracking
- ✅ User impact assessment

## 📦 Sentry Integration (Recommended)

### Step 1: Create Sentry Account

1. Go to [https://sentry.io/signup/](https://sentry.io/signup/)
2. Sign up (free tier: 5k errors/month)
3. Create new project → Select "React"
4. Copy your DSN (Data Source Name)

### Step 2: Install Sentry

```bash
npm install @sentry/react @sentry/tracing
```

### Step 3: Initialize Sentry

Create `src/services/sentry.ts`:

```typescript
import * as Sentry from '@sentry/react';
import { BrowserTracing } from '@sentry/tracing';

export function initSentry() {
  // Only initialize in production
  if (process.env.NODE_ENV !== 'production') {
    console.log('Sentry disabled in development');
    return;
  }

  Sentry.init({
    dsn: process.env.REACT_APP_SENTRY_DSN,
    
    // Performance Monitoring
    integrations: [
      new BrowserTracing({
        tracingOrigins: ['localhost', 'shoutout.us', /^\\/],
        routingInstrumentation: Sentry.reactRouterV6Instrumentation(
          React.useEffect,
          useLocation,
          useNavigationType,
          createRoutesFromChildren,
          matchRoutes
        ),
      }),
    ],

    // Sample rate for performance monitoring
    tracesSampleRate: 0.1, // 10% of transactions (adjust based on traffic)

    // Error sampling
    sampleRate: 1.0, // 100% of errors (always)

    // Release tracking
    release: process.env.REACT_APP_VERSION || 'development',

    // Environment
    environment: process.env.REACT_APP_ENV || 'production',

    // Don't send errors in development
    enabled: process.env.NODE_ENV === 'production',

    // Ignore common errors
    ignoreErrors: [
      // Browser extensions
      'top.GLOBALS',
      // Network errors
      'NetworkError',
      'Failed to fetch',
      // User cancelled actions
      'AbortError',
    ],

    // Before send hook (filter/modify errors)
    beforeSend(event, hint) {
      // Don't send if user is on localhost
      if (window.location.hostname === 'localhost') {
        return null;
      }

      // Add custom context
      event.contexts = {
        ...event.contexts,
        app: {
          user_type: localStorage.getItem('user_type'),
          has_auth: !!localStorage.getItem('sb-auth-token'),
        },
      };

      return event;
    },
  });
}
```

### Step 4: Update index.tsx

```typescript
import { initSentry } from './services/sentry';

// Initialize Sentry first (before React)
initSentry();

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
// ... rest of code
```

### Step 5: Update ErrorBoundary

Modify `src/components/ErrorBoundary.tsx`:

```typescript
import * as Sentry from '@sentry/react';

componentDidCatch(error: Error, errorInfo: ErrorInfo) {
  // Log to Sentry
  Sentry.captureException(error, {
    contexts: {
      react: {
        componentStack: errorInfo.componentStack,
      },
    },
  });

  // ... rest of code
}
```

### Step 6: Add Environment Variables

Add to `.env`:
```
REACT_APP_SENTRY_DSN=https://[YOUR_KEY]@o[ORG_ID].ingest.sentry.io/[PROJECT_ID]
REACT_APP_VERSION=1.0.0
REACT_APP_ENV=production
```

Add to Railway environment variables:
```
REACT_APP_SENTRY_DSN=[Your Sentry DSN]
REACT_APP_VERSION=1.0.0
REACT_APP_ENV=production
```

## 🔍 Manual Error Tracking

For specific errors you want to track:

```typescript
import * as Sentry from '@sentry/react';

// Capture exception
try {
  // Your code
} catch (error) {
  Sentry.captureException(error);
  toast.error('An error occurred');
}

// Capture message
Sentry.captureMessage('Payment failed', 'error');

// Add breadcrumb
Sentry.addBreadcrumb({
  category: 'auth',
  message: 'User logged in',
  level: 'info',
});

// Set user context
Sentry.setUser({
  id: user.id,
  email: user.email,
  username: user.username,
});
```

## 📊 Performance Monitoring

### Automatic Transaction Tracking

Sentry automatically tracks:
- Page loads
- Navigation timing
- Resource loading
- API calls

### Custom Performance Tracking

```typescript
import * as Sentry from '@sentry/react';

// Start transaction
const transaction = Sentry.startTransaction({
  name: 'Order Creation',
  op: 'order.create',
});

// Start span
const span = transaction.startChild({
  op: 'payment.process',
  description: 'Process Fortis payment',
});

try {
  // Your code
  await processPayment();
  span.setStatus('ok');
} catch (error) {
  span.setStatus('internal_error');
  throw error;
} finally {
  span.finish();
  transaction.finish();
}
```

## 🎭 Session Replay (Optional)

Enable session replay to watch user sessions:

```bash
npm install @sentry/replay
```

Update Sentry config:
```typescript
import { Replay } from '@sentry/replay';

Sentry.init({
  // ... other options
  integrations: [
    new Replay({
      maskAllText: true, // Mask sensitive text
      blockAllMedia: true, // Block videos/images
    }),
  ],
  replaysSessionSampleRate: 0.1, // 10% of sessions
  replaysOnErrorSampleRate: 1.0, // 100% of error sessions
});
```

## 📱 React Router Integration

Sentry can track route changes:

```typescript
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import * as Sentry from '@sentry/react';

function App() {
  const location = useLocation();

  useEffect(() => {
    Sentry.setContext('router', {
      pathname: location.pathname,
      search: location.search,
    });
  }, [location]);

  // ... rest
}
```

## 🚨 Alerts & Notifications

### Set Up Alerts in Sentry:

1. Go to **Alerts** → **Create Alert**
2. Choose conditions:
   - **Error frequency:** Alert if 10+ errors/hour
   - **New issue:** Alert on first occurrence
   - **Regression:** Alert if fixed issue returns
   - **Performance:** Alert if LCP > 3s

3. Choose notification channels:
   - Email
   - Slack
   - PagerDuty
   - Discord

### Example Alert Rules:

#### High Priority:
- **Payment failures:** 5+ errors in 10 minutes
- **Auth errors:** Any "authentication failed"
- **Database errors:** Any connection timeouts

#### Medium Priority:
- **UI errors:** 50+ errors in 1 hour
- **Performance:** P95 response time > 3s

#### Low Priority:
- **Network errors:** 100+ errors in 1 hour
- **New issues:** First occurrence of any error

## 📈 Dashboard Metrics

### Key Metrics to Track:

1. **Error Rate**
   - Errors per minute
   - Errors per user session
   - Error-free sessions %

2. **Performance**
   - LCP (Largest Contentful Paint)
   - FID (First Input Delay)
   - CLS (Cumulative Layout Shift)
   - TTFB (Time to First Byte)

3. **User Impact**
   - Users affected
   - Sessions affected
   - Error frequency per user

4. **Release Health**
   - Crash-free sessions
   - Crash-free users
   - Adoption rate

## 🔧 Debugging Tools

### Source Maps

Enable source maps for production debugging:

1. Build with source maps:
```bash
GENERATE_SOURCEMAP=true npm run build
```

2. Upload to Sentry:
```bash
npm install @sentry/cli -g
sentry-cli upload-sourcemaps ./build/static/js
```

3. Add to `package.json`:
```json
{
  "scripts": {
    "build": "react-scripts build && sentry-cli upload-sourcemaps ./build/static/js"
  }
}
```

### Breadcrumbs

Automatic breadcrumbs tracked:
- Console logs
- Network requests
- DOM events
- Navigation
- User interactions

Custom breadcrumbs:
```typescript
Sentry.addBreadcrumb({
  category: 'order',
  message: 'User created order',
  data: {
    orderId: order.id,
    amount: order.pricing,
  },
  level: 'info',
});
```

## 💰 Cost Planning

### Sentry Pricing:

#### Developer (Free):
- **5,000 errors/month**
- **10,000 performance units/month**
- **50 replays/month**
- 1 project
- 1 team member
- **Cost:** $0/month

#### Team ($26/month):
- **50,000 errors/month**
- **100,000 performance units/month**
- **500 replays/month**
- Unlimited projects
- Unlimited team members
- **Cost:** $26/month base + overages

#### Business (Custom):
- **Custom volume**
- **Custom retention**
- Priority support
- SLA guarantees
- **Cost:** Contact sales

### Estimated Usage:

#### 1,000 users/day:
- **Errors:** ~1,000/month (assuming 1% error rate)
- **Performance:** ~30,000 units/month (10% sample)
- **Replays:** ~100/month (errors only)
- **Plan:** Free tier ✅

#### 10,000 users/day:
- **Errors:** ~10,000/month
- **Performance:** ~300,000 units/month
- **Replays:** ~1,000/month
- **Plan:** Team ($26/mo) + overages (~$50/mo) = **$76/month**

#### 100,000 users/day:
- **Errors:** ~100,000/month
- **Performance:** ~3,000,000 units/month
- **Replays:** ~10,000/month
- **Plan:** Business (custom pricing) = **$500-1000/month**

## 🎛️ Configuration Tips

### 1. Sample Rates

Adjust based on traffic:

**Low Traffic (<1k users/day):**
```typescript
tracesSampleRate: 1.0, // 100% of transactions
replaysSessionSampleRate: 0.5, // 50% of sessions
```

**Medium Traffic (1k-10k users/day):**
```typescript
tracesSampleRate: 0.1, // 10% of transactions
replaysSessionSampleRate: 0.1, // 10% of sessions
```

**High Traffic (10k+ users/day):**
```typescript
tracesSampleRate: 0.01, // 1% of transactions
replaysSessionSampleRate: 0.01, // 1% of sessions
```

### 2. Error Filtering

Filter out noise:

```typescript
ignoreErrors: [
  // Browser extensions
  'top.GLOBALS',
  'originalCreateNotification',
  'canvas.contentDocument',
  'MyApp_RemoveAllHighlights',
  
  // Network errors (usually not our fault)
  'NetworkError',
  'Failed to fetch',
  'Load failed',
  
  // User cancelled
  'AbortError',
  'User cancelled',
  
  // 3rd party scripts
  /^Script error for "https:\/\/cdn\./,
],
```

### 3. PII Protection

Remove sensitive data:

```typescript
beforeSend(event) {
  // Remove email from URLs
  if (event.request?.url) {
    event.request.url = event.request.url.replace(
      /email=[^&]+/g,
      'email=REDACTED'
    );
  }
  
  // Remove sensitive headers
  if (event.request?.headers) {
    delete event.request.headers['Authorization'];
    delete event.request.headers['Cookie'];
  }
  
  return event;
}
```

## 🚀 Deployment Checklist

- [ ] Install Sentry packages
- [ ] Add Sentry DSN to environment variables
- [ ] Initialize Sentry in index.tsx
- [ ] Update ErrorBoundary with Sentry
- [ ] Enable source maps
- [ ] Configure alerts in Sentry dashboard
- [ ] Test error reporting in staging
- [ ] Set up Slack/email notifications
- [ ] Configure sample rates for production
- [ ] Add custom context (user type, etc.)
- [ ] Monitor dashboard after deployment

## 📚 Resources

- [Sentry React Docs](https://docs.sentry.io/platforms/javascript/guides/react/)
- [Performance Monitoring](https://docs.sentry.io/platforms/javascript/performance/)
- [Session Replay](https://docs.sentry.io/platforms/javascript/session-replay/)
- [Source Maps](https://docs.sentry.io/platforms/javascript/sourcemaps/)

---

**Implementation Status:** 📋 Ready to Install  
**Estimated Setup Time:** 30-60 minutes  
**Monthly Cost (Free Tier):** $0 (5k errors, 10k perf units)  
**Recommended Tier:** Team ($26/mo) for 10k+ users

