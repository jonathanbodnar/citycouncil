export interface User {
  id: string;
  email: string;
  full_name: string;
  user_type: 'user' | 'talent' | 'admin';
  avatar_url?: string;
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
  pricing: number;
  corporate_pricing?: number;
  fulfillment_time_hours: number;
  charity_percentage?: number;
  charity_name?: string;
  is_featured: boolean;
  admin_fee_percentage?: number;
  social_accounts: SocialAccount[];
  payout_details?: StripeConnectAccount;
  fortis_vendor_id?: string; // Fortis vendor ID for payouts
  total_orders: number;
  fulfilled_orders: number;
  average_rating: number;
  is_active: boolean;
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
  amount: number;
  admin_fee: number;
  charity_amount?: number;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'refunded';
  video_url?: string;
  fulfillment_deadline: string;
  created_at: string;
  updated_at: string;
  stripe_payment_intent_id: string;
  is_corporate: boolean;
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
  type: 'order_placed' | 'order_fulfilled' | 'order_late' | 'new_review' | 'profile_incomplete';
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  order_id?: string;
  review_id?: string;
}

export interface AdminStats {
  total_orders: number;
  gross_generated: number;
  gross_earnings: number;
  amount_refunded: number;
  total_users: number;
  total_users_with_orders: number;
  total_talent: number;
  avg_orders_per_talent: number;
  avg_orders_per_user: number;
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
  account_number: string;
  routing_number: string;
  account_type: 'checking' | 'savings';
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}
