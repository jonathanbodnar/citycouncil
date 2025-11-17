# ShoutOut.us - Complete Page & Route Reference

## 🌐 Public Pages (Should be in Sitemap & Indexed)

### ✅ Currently in Sitemap:
| URL Pattern | Page | Purpose | SEO Priority |
|------------|------|---------|--------------|
| `/` | ComingSoonPage | Homepage/Landing page | 1.0 (Highest) |
| `/:username` | TalentProfilePage | Individual talent profiles (e.g., /shawnfarash, /nickdipaolo) | 0.9 (Very High) |

### 📄 Static Public Pages (Consider Adding to Sitemap):
| URL Pattern | Page | Purpose | Should Index? |
|------------|------|---------|---------------|
| `/privacy-policy` | PrivacyPolicyPage | Privacy policy | ✅ Yes - Good for trust/compliance |
| `/terms-of-service` | TermsOfServicePage | Terms of service | ✅ Yes - Good for trust/compliance |
| `/onboard` | PublicTalentOnboardingPage | Public talent application form | ⚠️ Maybe - Useful for talent discovery |
| `/help` | HelpPage | Help/FAQ page | ⚠️ Maybe - Useful for user support queries |

---

## 🔒 Protected Pages (Should NOT be in Sitemap)

### User Authentication:
| URL Pattern | Page | Access Level | Purpose |
|------------|------|-------------|---------|
| `/login` | LoginPage | Public (no auth needed) | User login |
| `/signup` | SignupPage | Public (no auth needed) | User registration |
| `/reset-password` | ResetPasswordPage | Public (no auth needed) | Password reset |

### Authenticated User Pages:
| URL Pattern | Page | Access Level | Purpose |
|------------|------|-------------|---------|
| `/dashboard` | DashboardPage | Authenticated users | User/talent dashboard |
| `/order/:talentId` | OrderPage | Authenticated users | Create order for talent |
| `/review/:orderId` | ReviewPage | Authenticated users | Review completed order |
| `/notifications` | NotificationsPage | Authenticated users | View notifications |

### Talent-Only Pages:
| URL Pattern | Page | Access Level | Purpose |
|------------|------|-------------|---------|
| `/welcome` | WelcomePage | Talent only | Talent welcome/onboarding completion |
| `/onboard/:token` | TalentOnboardingPage | Token-based | Talent onboarding with invite token |
| `/fulfill/:token` | OrderFulfillmentPage | Token-based | Fulfill order via email link |

### Admin Pages:
| URL Pattern | Page | Access Level | Purpose |
|------------|------|-------------|---------|
| `/admin` | AdminDashboard | Admin only | Admin dashboard |

---

## 🔧 Utility/System Pages (Should NOT be in Sitemap)

| URL Pattern | Page | Purpose | Notes |
|------------|------|---------|-------|
| `/s/:code` | ShortLinkRedirectPage | Short link redirect (Twilio SMS) | Dynamic redirect |
| `/instagram/callback` | InstagramCallbackPage | Instagram OAuth callback | System callback |
| `/seed` | SeedDataPage | Database seeding | Development only |
| `/email-test` | EmailTestPage | Email testing | Development only |

---

## 🗺️ URL Redirects (Old → New)

| Old URL | New URL | Status | Notes |
|---------|---------|--------|-------|
| `/profile/:username` | `/:username` | 301 Redirect | Old profile format (deprecated) |
| `/talent/:slug` | Same | Active | Alternative talent profile route |
| `/talent/:id` | Same | Active | Talent profile by ID |

---

## 🚫 Non-Existent Routes (Blocked in robots.txt)

| URL Pattern | Status | Issue |
|------------|--------|-------|
| `/category/*` | ❌ Doesn't exist | Was in sitemap, removed - no routes defined |
| `/profile/*` | ⚠️ Redirects | Deprecated format, redirects to `/:username` |

---

## 📊 Current Sitemap Configuration

### What's Included:
```xml
✅ / (homepage)
✅ /:username (all active talent profiles)
```

### What's Excluded (Blocked in robots.txt):
```
🚫 /profile/*
🚫 /category/*
🚫 /talent/*
🚫 /dashboard
🚫 /admin
🚫 /login
🚫 /signup
🚫 /orders
🚫 /fulfill/*
```

---

## 💡 Recommendations

### Consider Adding to Sitemap:
1. **Legal Pages** (Good for SEO & trust):
   - `/privacy-policy` (Priority: 0.3)
   - `/terms-of-service` (Priority: 0.3)

2. **Public Content Pages** (If they provide value):
   - `/help` (Priority: 0.5) - If it has FAQ content Google should index
   - `/onboard` (Priority: 0.4) - For talent discovery

### Keep Out of Sitemap:
- All authentication pages (login, signup, reset)
- All protected user pages (dashboard, orders, etc.)
- All admin pages
- All utility/callback pages
- All token-based pages

---

## 🎯 SEO-Optimized URL Structure

### Current Working Structure:
```
shoutout.us/                          → Homepage
shoutout.us/shawnfarash              → Talent profile (clean, SEO-friendly)
shoutout.us/nickdipaolo              → Talent profile (clean, SEO-friendly)
shoutout.us/hayley-caronia           → Talent profile (clean, SEO-friendly)
shoutout.us/joshfirestine            → Talent profile (clean, SEO-friendly)
```

### Future Considerations:
If you want category pages in the future, they would need:
1. Actual route definitions in `App.tsx`
2. A component/page to render category listings
3. Then add back to sitemap

Example future structure:
```
shoutout.us/category/sports          → Category landing page (if built)
shoutout.us/category/business        → Category landing page (if built)
```

---

## 📝 Notes

- **Dynamic Routes**: `/:username` is a catch-all that matches talent usernames
- **Route Priority**: More specific routes (like `/login`) are defined before the catch-all
- **Homepage**: Currently shows ComingSoonPage, will likely become HomePage later
- **Categories**: Browse by category functionality exists on homepage, not separate pages

