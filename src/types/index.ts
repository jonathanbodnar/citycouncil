export interface User {
  id: string;
  email: string;
  full_name: string;
  user_type: 'user' | 'talent' | 'admin';
  avatar_url?: string;
  phone?: string; // E.164 format (+1XXXXXXXXXX)
  phone_number?: string; // Alias for backwards compatibility
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  id: string;
  user_id: string;
  phone?: string;
  is_corporate: boolean;
  company_name?: string;
  payment_methods: PaymentMethod[];
}

export interface TalentProfile {
  id: string;
  user_id: string;
  category: TalentCategory; // Keep for backwards compatibility
  categories?: TalentCategory[]; // New multi-category field
  bio: string;
  position?: string; // Optional title like "Congressman", "Judge", "Senator"
  allow_corporate_pricing?: boolean;
  is_verified?: boolean;
  promo_video_url?: string;
  is_participating_in_promotion?: boolean;
  promotion_claimed_at?: string;
  pricing: number;
  corporate_pricing?: number;
  fulfillment_time_hours: number;
  charity_percentage?: number;
  charity_name?: string;
  is_featured: boolean;
  featured_order?: number | null; // Order position in featured carousel (1 = first, 2 = second, etc.)
  admin_fee_percentage?: number;
  first_orders_promo_active?: boolean; // 0% admin fee for first 10 orders
  social_accounts: SocialAccount[];
  payout_details?: StripeConnectAccount;
  fortis_vendor_id?: string; // Fortis vendor ID for payouts
  username?: string; // Unique username for profile URL
  onboarding_token?: string; // Token for onboarding signup
  onboarding_completed?: boolean; // Whether onboarding is complete
  onboarding_expires_at?: string; // When onboarding token expires
  temp_full_name?: string; // Temporary storage for name before user creation
  temp_avatar_url?: string; // Temporary storage for avatar before user creation
  instagram_username?: string; // Instagram username for promotion tracking
  instagram_user_id?: string; // Instagram user ID from Meta API
  instagram_access_token?: string; // OAuth access token for Instagram API
  instagram_token_expires_at?: string; // When the Instagram access token expires
  instagram_handle?: string; // Instagram handle (e.g., @username)
  tiktok_handle?: string; // TikTok handle (e.g., @username)
  facebook_handle?: string; // Facebook handle (e.g., @username)
  twitter_handle?: string; // Twitter/X handle (e.g., @username)
  full_name?: string; // Legal full name (used for Moov/Plaid onboarding)
  total_orders: number;
  fulfilled_orders: number;
  average_rating: number;
  is_active: boolean;
  is_coming_soon?: boolean; // Marks talent as "Coming Soon" - not visible on /home yet
  display_order?: number | null; // Controls order on /home (lower = higher on page, NULL = sort by created_at DESC)
  featured_image_position?: string; // CSS background-position for featured carousel (e.g., 'center 30%', 'center top')
}

export type TalentCategory = 
  | 'politician'
  | 'candidate'
  | 'party-leader'
  | 'reporter'
  | 'tv-host'
  | 'commentator'
  | 'author'
  | 'comedian'
  | 'musician'
  | 'actor'
  | 'influencer'
  | 'activist'
  | 'faith-leader'
  | 'academic'
  | 'military'
  | 'youth-leader'
  | 'patriotic-entertainer'
  | 'other';

export interface SocialAccount {
  id: string;
  platform: 'twitter' | 'facebook' | 'instagram' | 'tiktok' | 'linkedin';
  handle: string;
}

export interface Order {
  id: string;
  user_id: string;
  talent_id: string;
  request_details: string;
  recipient_name?: string; // Who's it for field
  amount: number;
  admin_fee: number;
  charity_amount?: number;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'refunded' | 'denied';
  approval_status: 'pending' | 'approved' | 'rejected';
  is_corporate_order: boolean;
  order_type?: 'standard' | 'demo';
  event_description?: string;
  event_audience?: string;
  video_setting_request?: string;
  approved_at?: string;
  rejected_at?: string;
  rejection_reason?: string;
  denial_reason?: string;
  denied_by?: 'admin' | 'talent';
  denied_at?: string;
  refund_id?: string;
  refund_amount?: number;
  video_url?: string;
  fulfillment_deadline: string;
  fulfillment_token?: string; // Unique token for direct fulfillment link
  created_at: string;
  updated_at: string;
  payment_transaction_id: string;
  payment_transaction_payload?: any;
  is_corporate: boolean; // Legacy field, keeping for backwards compatibility
  company_name?: string;
}

export interface Review {
  id: string;
  order_id: string;
  user_id: string;
  talent_id: string;
  rating: number;
  comment?: string;
  created_at: string;
}

export interface Charity {
  id: string;
  name: string;
  ein: string;
  description: string;
  website: string;
  bank_details: BankDetails;
  total_received: number;
  is_verified: boolean;
}

export interface BankDetails {
  account_holder_name: string;
  account_number: string;
  routing_number: string;
  bank_name: string;
}

export interface PaymentMethod {
  id: string;
  stripe_payment_method_id: string;
  type: 'card' | 'apple_pay' | 'google_pay';
  last_four?: string;
  brand?: string;
  is_default: boolean;
}

export interface StripeConnectAccount {
  account_id: string;
  is_verified: boolean;
  details_submitted: boolean;
}

export interface Notification {
  id: string;
  user_id: string;
  type: 'order_placed' | 'order_fulfilled' | 'order_late' | 'order_denied' | 'new_review' | 'profile_incomplete';
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  order_id?: string;
  review_id?: string;
}

export interface AdminStats {
  total_orders: number;
  completed_orders: number;
  pending_orders: number;
  corporate_orders: number;
  pending_approval_orders: number;
  completion_rate: number;
  gross_generated: number;
  gross_earnings: number;
  amount_refunded: number;
  total_users: number;
  total_users_with_orders: number;
  total_talent: number;
  active_talent: number;
  verified_talent: number;
  promotion_participants: number;
  avg_orders_per_talent: number;
  avg_orders_per_user: number;
  avg_delivery_time_hours: number;
}

export interface HelpMessage {
  id: string;
  user_id: string;
  message: string;
  response?: string;
  is_resolved: boolean;
  is_human_takeover: boolean;
  created_at: string;
  updated_at: string;
}

export interface AppSettings {
  id: string;
  global_admin_fee_percentage: number;
  help_bot_rules: string[];
  featured_talent_limit: number;
  max_fulfillment_hours: number;
  refund_policy_text: string;
}

export interface Payout {
  id: string;
  talent_id: string;
  order_id: string;
  amount: number;
  vendor_id: string;
  status: 'pending' | 'processed' | 'failed' | 'cancelled';
  processed_at?: string;
  created_at: string;
  updated_at: string;
  fortis_transaction_id?: string;
  error_message?: string;
}

export interface PayoutError {
  id: string;
  talent_id: string;
  order_id: string;
  amount: number;
  error_message: string;
  resolved: boolean;
  created_at: string;
  resolved_at?: string;
}

export interface VendorBankInfo {
  id: string;
  talent_id: string;
  account_holder_name: string;
  bank_name: string;
  account_type: 'checking' | 'savings';
  is_verified: boolean;
  created_at: string;
  updated_at: string;
  
  // Encrypted fields (for secure storage)
  account_number_encrypted?: string;
  account_number_iv?: string;
  routing_number_encrypted?: string;
  routing_number_iv?: string;
  
  // Masked fields (for display)
  account_number_masked?: string;
  routing_number_masked?: string;
  
  // Legacy fields (deprecated, nullable)
  account_number?: string;
  routing_number?: string;
}

export interface PlatformSetting {
  id: string;
  setting_key: string;
  setting_value?: string;
  setting_type: 'string' | 'boolean' | 'number' | 'json' | 'file';
  description?: string;
  created_at: string;
  updated_at: string;
  updated_by?: string;
}

export interface TalentOnboardingData {
  token: string;
  talent: TalentProfile & {
    users: {
      full_name: string;
      avatar_url?: string;
    };
  };
  expired: boolean;
}
