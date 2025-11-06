# ShoutOut - Conservative Talent Video Platform

A Cameo-style PWA that allows users to order personalized video shoutouts from conservative talent.

## 🚀 Features

### For Users
- Browse talent by category (Politicians, TV Hosts, Commentators, etc.)
- Order personalized video shoutouts
- Corporate ordering options
- 100% money-back satisfaction guarantee
- Secure payment processing with Stripe
- Order tracking and management
- Review and rating system

### For Talent
- Complete profile management
- Set pricing and fulfillment times
- Charity donation options
- Order management dashboard
- Video upload and delivery
- Stripe Connect integration for payouts
- Social media integration

### For Admins
- Complete platform management
- User and talent management
- Order analytics and reporting
- Fee management
- Featured talent control
- Help desk management

## 🛠 Tech Stack

- **Frontend**: React 18 + TypeScript
- **Styling**: Tailwind CSS + Headless UI
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Payments**: Stripe + Stripe Connect
- **Storage**: Wasabi S3 (for videos/images)
- **Email**: Mailgun
- **Deployment**: Railway
- **PWA**: Service Workers + Web App Manifest

## 🏗 Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── Header.tsx
│   ├── Layout.tsx
│   ├── MobileNavigation.tsx
│   ├── ProtectedRoute.tsx
│   ├── TalentCard.tsx
│   └── FeaturedCarousel.tsx
├── context/            # React Context providers
│   └── AuthContext.tsx
├── pages/              # Page components
│   ├── HomePage.tsx
│   ├── LoginPage.tsx
│   ├── SignupPage.tsx
│   ├── TalentProfilePage.tsx
│   ├── OrderPage.tsx
│   ├── DashboardPage.tsx
│   └── AdminDashboard.tsx
├── services/           # External service integrations
│   └── supabase.ts
├── types/              # TypeScript type definitions
│   └── index.ts
├── utils/              # Utility functions
│   └── seedData.ts
└── hooks/              # Custom React hooks
```

## 📊 Database Schema

### Core Tables
- `users` - User profiles with role-based access
- `talent_profiles` - Talent-specific information
- `user_profiles` - Customer-specific information
- `orders` - Order management and tracking
- `reviews` - Rating and review system
- `charities` - Charity information for donations
- `notifications` - In-app notification system

### Supporting Tables
- `social_accounts` - Talent social media links
- `payment_methods` - User payment information
- `stripe_connect_accounts` - Talent payout accounts
- `help_messages` - Customer support system
- `app_settings` - Global platform settings

## 🔧 Setup Instructions

### Prerequisites
- Node.js 18+
- npm or yarn
- Supabase account
- Stripe account

### Installation

1. **Clone and install dependencies**
   ```bash
   cd ShoutOut
   npm install
   ```

2. **Environment Configuration**
   Copy `env.example` to `.env` and fill in your credentials:
   ```bash
   cp env.example .env
   ```

3. **Supabase Setup**
   - Database and schema are already configured
   - Project ID: `utafetamgwukkbrlezev`
   - URL: `https://utafetamgwukkbrlezev.supabase.co`

4. **Start Development Server**
   ```bash
   npm start
   ```

## 👥 Test Accounts

The following test accounts are available for development:

### Admin Account
- **Email**: `admin@shoutout.com`
- **Password**: `password123`
- **Access**: Full platform management

### Talent Account
- **Email**: `tucker@shoutout.com`
- **Password**: `password123`
- **Profile**: Tucker Carlson (TV Host)
- **Pricing**: $299.99
- **Features**: Featured talent, charity donations (10% to Wounded Warrior Project)

### Customer Accounts
- **Personal User**
  - Email: `john@example.com`
  - Password: `password123`
  
- **Corporate User**
  - Email: `corp@company.com`
  - Password: `password123`
  - Company: ACME Corporation

## 🎯 Current Status

### ✅ Completed Features
- **Project Setup**: React 18 + TypeScript + Tailwind CSS + PWA
- **Database**: Complete Supabase schema with RLS policies
- **Authentication**: Role-based access (Admin/Talent/User)
- **Home Page**: Talent browsing with categories and search
- **Talent Profiles**: Comprehensive profile pages with reviews, videos, social links
- **Order System**: Complete order flow with pricing calculations
- **Admin Dashboard**: Full analytics and management interface
- **Mobile PWA**: Responsive design with mobile navigation
- **Test Data**: Complete sample data with users, orders, reviews

### 🚧 Ready for Integration
- **Stripe Payments**: Order flow ready, needs API keys
- **Video Storage**: Wasabi S3 integration ready
- **Email Notifications**: Mailgun integration ready

### 📋 Future Enhancements
- Real-time notifications
- Advanced admin tools
- Mobile app export (React Native/Capacitor)
- AI-powered help desk
- Advanced analytics

## 🔐 Security Features

- Row Level Security (RLS) on all database tables
- Role-based access control
- Secure authentication with Supabase
- Multi-factor authentication (MFA) for talent accounts
- Payment security with Stripe
- Input validation and sanitization
- AES-256-GCM encryption for sensitive data
- GDPR, CCPA, and privacy law compliance
- Comprehensive data retention and deletion policy (see [DATA_RETENTION_POLICY.md](./DATA_RETENTION_POLICY.md))

## 📱 PWA Features

- Offline capability
- Push notifications
- App-like mobile experience
- Fast loading with service workers
- Installable on mobile devices

## 🚀 Deployment

The application is configured for deployment on Railway with:
- Automatic builds from Git
- Environment variable management
- SSL certificates
- Custom domain support

## 📞 Support

For development questions or issues:
1. Check the test accounts above
2. Review the database schema in Supabase
3. Check browser console for errors
4. Verify environment variables are set

## 🎨 Design System

- **Primary Color**: Blue (#3b82f6)
- **Secondary Color**: Red (#ef4444)
- **Typography**: System fonts with Tailwind CSS
- **Components**: Headless UI for accessibility
- **Icons**: Heroicons
- **Responsive**: Mobile-first design

## 🔄 Development Workflow

1. **Feature Development**: Create feature branches
2. **Testing**: Use provided test accounts
3. **Database Changes**: Use Supabase migrations
4. **Styling**: Tailwind CSS utilities
5. **State Management**: React Context + hooks

The application is now ready for development and testing!