import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { 
  StarIcon,
  ArrowTopRightOnSquareIcon,
  LinkIcon,
  Squares2X2Icon
} from '@heroicons/react/24/outline';
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid';
import { supabase } from '../services/supabase';
import toast from 'react-hot-toast';

// Helper to format phone number as user types
const formatPhoneNumber = (value: string): string => {
  // Remove all non-digits
  const digits = value.replace(/\D/g, '');
  
  // Limit to 10 digits
  const limited = digits.slice(0, 10);
  
  // Format as (XXX) XXX-XXXX
  if (limited.length === 0) return '';
  if (limited.length <= 3) return `(${limited}`;
  if (limited.length <= 6) return `(${limited.slice(0, 3)}) ${limited.slice(3)}`;
  return `(${limited.slice(0, 3)}) ${limited.slice(3, 6)}-${limited.slice(6)}`;
};

// Helper to determine if text should be dark or light based on background color
const getContrastTextColor = (hexColor: string): string => {
  // Default to white if no color provided
  if (!hexColor) return '#ffffff';
  
  // Remove # if present
  const hex = hexColor.replace('#', '');
  
  // Parse RGB values
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  
  // Calculate luminance (perceived brightness)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  // Return dark text for light backgrounds, white text for dark backgrounds
  return luminance > 0.6 ? '#000000' : '#ffffff';
};

interface TalentProfile {
  id: string;
  user_id: string;
  username?: string;
  full_name?: string;
  temp_full_name?: string; // Name stored before onboarding completion
  temp_avatar_url?: string;
  bio?: string;
  social_accounts?: SocialAccount[];
  promo_video_url?: string;
  is_verified?: boolean;
  // Social handles from talent_profiles table
  twitter_handle?: string;
  instagram_handle?: string;
  facebook_handle?: string;
  tiktok_handle?: string;
  rumble_handle?: string;
  rumble_type?: 'c' | 'user'; // 'c' for channel, 'user' for user profile
  youtube_handle?: string;
  podcast_rss_url?: string;
  podcast_name?: string;
  users?: {
    full_name?: string;
  };
}

interface SocialAccount {
  id: string;
  platform: string;
  handle: string;
  follower_count?: number;
}

// Social platform configurations with SVG icons
const SOCIAL_PLATFORMS: Record<string, { icon: React.ReactNode; baseUrl: string; name: string }> = {
  instagram: { 
    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>,
    baseUrl: 'https://instagram.com/', name: 'Instagram' 
  },
  twitter: { 
    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>,
    baseUrl: 'https://x.com/', name: 'X' 
  },
  tiktok: { 
    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/></svg>,
    baseUrl: 'https://tiktok.com/@', name: 'TikTok' 
  },
  youtube: { 
    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>,
    baseUrl: 'https://youtube.com/@', name: 'YouTube' 
  },
  facebook: { 
    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>,
    baseUrl: 'https://facebook.com/', name: 'Facebook' 
  },
  linkedin: { 
    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>,
    baseUrl: 'https://linkedin.com/in/', name: 'LinkedIn' 
  },
  threads: { 
    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.96-.065-1.182.408-2.256 1.33-3.022.88-.73 2.108-1.146 3.456-1.17 1.005-.018 1.96.14 2.836.469-.034-.773-.17-1.418-.413-1.911-.351-.714-.964-1.08-1.874-1.12-1.084.007-1.9.6-2.378 1.235l-1.7-1.154c.78-1.104 2.144-1.8 3.943-1.963l.136-.008c1.678-.067 3.056.36 4.1 1.27.962.838 1.574 2.086 1.82 3.713.266-.057.54-.103.82-.138l.468-.06c1.953-.19 3.936.376 5.14 1.556 1.522 1.49 1.973 3.746 1.239 6.2-.49 1.638-1.51 3.07-2.95 4.14-1.617 1.2-3.654 1.832-6.058 1.88h-.007zm-2.21-8.106c-.78.045-1.394.283-1.776.69-.345.368-.516.838-.483 1.325.033.515.266.96.657 1.254.453.34 1.09.5 1.798.454 1.053-.057 1.864-.508 2.412-1.342.396-.604.637-1.4.716-2.364-.93-.252-1.956-.345-3.324-.017z"/></svg>,
    baseUrl: 'https://threads.net/@', name: 'Threads' 
  },
  snapchat: { 
    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.401.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.354-.629-2.758-1.379l-.749 2.848c-.269 1.045-1.004 2.352-1.498 3.146 1.123.345 2.306.535 3.55.535 6.607 0 11.985-5.365 11.985-11.987C23.97 5.39 18.592.026 11.985.026L12.017 0z"/></svg>,
    baseUrl: 'https://snapchat.com/add/', name: 'Snapchat' 
  },
  pinterest: { 
    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.401.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.354-.629-2.758-1.379l-.749 2.848c-.269 1.045-1.004 2.352-1.498 3.146 1.123.345 2.306.535 3.55.535 6.607 0 11.985-5.365 11.985-11.987C23.97 5.39 18.592.026 11.985.026L12.017 0z"/></svg>,
    baseUrl: 'https://pinterest.com/', name: 'Pinterest' 
  },
  spotify: { 
    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>,
    baseUrl: 'https://open.spotify.com/user/', name: 'Spotify' 
  },
  twitch: { 
    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/></svg>,
    baseUrl: 'https://twitch.tv/', name: 'Twitch' 
  },
  discord: { 
    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z"/></svg>,
    baseUrl: 'https://discord.gg/', name: 'Discord' 
  },
  rumble: { 
    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M14.4528 13.5458c0.8064 -0.6542 0.9297 -1.8381 0.2756 -2.6445a1.8802 1.8802 0 0 0 -0.2756 -0.2756 21.2127 21.2127 0 0 0 -4.3121 -2.776c-1.066 -0.51 -2.256 0.2 -2.4261 1.414a23.5226 23.5226 0 0 0 -0.14 5.5021c0.116 1.23 1.292 1.964 2.372 1.492a19.6285 19.6285 0 0 0 4.5062 -2.704v-0.008zm6.9322 -5.4002c2.0335 2.228 2.0396 5.637 0.014 7.8723A26.1487 26.1487 0 0 1 8.2946 23.846c-2.6848 0.6713 -5.4168 -0.914 -6.1662 -3.5781 -1.524 -5.2002 -1.3 -11.0803 0.17 -16.3045 0.772 -2.744 3.3521 -4.4661 6.0102 -3.832 4.9242 1.174 9.5443 4.196 13.0764 8.0121v0.002z"/></svg>,
    baseUrl: 'https://rumble.com/c/', name: 'Rumble' 
  },
};

interface BioSettings {
  id?: string;
  talent_id: string;
  instagram_username?: string;
  one_liner?: string;
  theme: string;
  background_color: string;
  accent_color: string;
  font_family: string;
  show_shoutout_card: boolean;
  show_rumble_card: boolean;
  show_youtube_card?: boolean;
  show_podcast_card?: boolean;
  show_newsletter?: boolean;
  affiliate_section_title?: string;
  is_published: boolean;
  background_type: string;
  gradient_start: string;
  gradient_end: string;
  gradient_direction: string;
  button_style: string;
  button_color: string;
  text_color: string;
  card_style: string;
  card_opacity: number;
  profile_image_url?: string;
  display_name?: string;
  stream_card_order?: string[];
}

interface BioLink {
  id: string;
  talent_id: string;
  link_type: 'basic' | 'grid' | 'newsletter' | 'sponsor' | 'video' | 'affiliate' | 'donate';
  title?: string;
  url?: string;
  icon_url?: string;
  image_url?: string;
  video_url?: string;
  company_name?: string;
  discount_amount?: string;
  discount_code?: string;
  grid_size?: 'small' | 'medium' | 'large';
  display_order: number;
  is_active: boolean;
  grid_columns?: number;
  background_image_url?: string;
  thumbnail_url?: string;
  subtitle?: string;
  button_text?: string;
  is_featured?: boolean;
  click_count?: number;
  link_format?: 'thin' | 'tall' | 'square';
}

interface Review {
  id: string;
  rating: number;
  comment?: string;
  created_at: string;
  users?: {
    full_name?: string;
  };
}

interface NewsletterConfig {
  id: string;
  talent_id: string;
  provider: string;
  api_key?: string | null;
  list_id?: string | null;
  webhook_url?: string | null;
  form_id?: string | null;
  is_active: boolean;
}

interface RumbleVideoData {
  title: string;
  thumbnail: string;
  url: string;
  views: number;
  isLive: boolean;
  liveViewers?: number;
}

interface ServiceOffering {
  id: string;
  talent_id: string;
  service_type: 'instagram_collab' | 'tiktok_collab' | 'youtube_collab' | 'sponsorship';
  pricing: number; // in cents
  title: string;
  description?: string;
  video_length_seconds: number;
  benefits: string[];
  platforms: string[]; // Which platforms are included in this collab
  is_active: boolean;
  total_followers?: number;
}

interface BioEvent {
  id: string;
  talent_id: string;
  title: string;
  description?: string;
  event_date?: string;
  event_time?: string;
  location?: string;
  registration_url?: string;
  button_text: string;
  image_url?: string;
  source_type: 'manual' | 'ical' | 'rss';
  source_url?: string;
  is_active: boolean;
  display_order: number;
}

interface YouTubeVideoData {
  title: string;
  thumbnail: string;
  url: string;
  views: number;
  isLive: boolean;
  liveViewers?: number;
  channelUrl: string;
}

interface PodcastEpisodeData {
  title: string;
  description?: string;
  thumbnail?: string;
  url: string;
  audioUrl?: string;
  pubDate?: string;
  duration?: string;
  views?: string;
  podcastName: string;
  feedUrl: string;
  listenLinks?: {
    spotify?: string;
    apple?: string;
    youtube?: string;
    google?: string;
  };
}

// User type for current logged-in user
interface CurrentUser {
  id: string;
  email?: string;
  phone?: string;
  full_name?: string;
}

// Helper function to send subscriber data to newsletter integrations
const sendToNewsletterIntegration = async (
  config: NewsletterConfig,
  data: {
    email: string;
    phone?: string | null;
    name?: string;
    talent_id: string;
    talent_name: string;
  }
) => {
  const { provider, api_key, list_id, webhook_url } = config;

  // Always send to webhook if configured (works for Zapier, custom webhooks, etc.)
  if (webhook_url) {
    await fetch(webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...data,
        source: 'shoutout_bio_follow',
        provider,
        timestamp: new Date().toISOString(),
      }),
    });
  }

  // Provider-specific API calls (if API key is configured)
  if (api_key && list_id) {
    switch (provider) {
      case 'mailchimp':
        // Mailchimp uses a datacenter in the API key (e.g., us1, us2)
        const dc = api_key.split('-').pop() || 'us1';
        await fetch(`https://${dc}.api.mailchimp.com/3.0/lists/${list_id}/members`, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${btoa(`anystring:${api_key}`)}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email_address: data.email,
            status: 'subscribed',
            merge_fields: {
              FNAME: data.name?.split(' ')[0] || '',
              LNAME: data.name?.split(' ').slice(1).join(' ') || '',
              PHONE: data.phone || '',
            },
            tags: ['shoutout_bio', data.talent_name],
          }),
        });
        break;

      case 'getresponse':
        await fetch('https://api.getresponse.com/v3/contacts', {
          method: 'POST',
          headers: {
            'X-Auth-Token': `api-key ${api_key}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: data.email,
            campaign: { campaignId: list_id },
            name: data.name || data.email.split('@')[0],
            customFieldValues: [
              { customFieldId: 'phone', value: [data.phone || ''] },
              { customFieldId: 'source', value: ['shoutout_bio'] },
            ],
          }),
        });
        break;

      case 'activecampaign':
        // ActiveCampaign API URL is usually like: https://youraccountname.api-us1.com
        // The list_id here would be the account URL
        await fetch(`${list_id}/api/3/contacts`, {
          method: 'POST',
          headers: {
            'Api-Token': api_key,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contact: {
              email: data.email,
              firstName: data.name?.split(' ')[0] || '',
              lastName: data.name?.split(' ').slice(1).join(' ') || '',
              phone: data.phone || '',
            },
          }),
        });
        break;

      // For other providers, rely on webhook
      default:
        console.log(`Provider ${provider} uses webhook integration`);
    }
  }
};

const BioPage: React.FC = () => {
  const { username } = useParams<{ username: string }>();
  const [talentProfile, setTalentProfile] = useState<TalentProfile | null>(null);
  const [bioSettings, setBioSettings] = useState<BioSettings | null>(null);
  const [links, setLinks] = useState<BioLink[]>([]);
  const [socialAccounts, setSocialAccounts] = useState<SocialAccount[]>([]);
  const [randomReview, setRandomReview] = useState<Review | null>(null);
  const [newsletterConfig, setNewsletterConfig] = useState<NewsletterConfig | null>(null);
  const [rumbleData, setRumbleData] = useState<RumbleVideoData | null>(null);
  const [youtubeData, setYoutubeData] = useState<YouTubeVideoData | null>(null);
  const [podcastData, setPodcastData] = useState<PodcastEpisodeData | null>(null);
  const [fetchingPodcast, setFetchingPodcast] = useState(false);
  const podcastFetchedRef = React.useRef(false);
  const [serviceOfferings, setServiceOfferings] = useState<ServiceOffering[]>([]);
  const [showCollabModal, setShowCollabModal] = useState<ServiceOffering | null>(null);
  const [showSponsorModal, setShowSponsorModal] = useState<ServiceOffering | null>(null);
  const [showPodcastModal, setShowPodcastModal] = useState(false);
  const [bioEvents, setBioEvents] = useState<BioEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterPhone, setNewsletterPhone] = useState('');
  const [showPhoneField, setShowPhoneField] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [buttonTextIndex, setButtonTextIndex] = useState(0); // For rotating button text

  // Rotate button text every 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setButtonTextIndex(prev => (prev + 1) % 2);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Update page title with talent name
  useEffect(() => {
    if (talentProfile?.full_name) {
      document.title = talentProfile.full_name;
    } else if (bioSettings?.display_name) {
      document.title = bioSettings.display_name;
    }
    return () => {
      document.title = 'ShoutOut Bio';
    };
  }, [talentProfile?.full_name, bioSettings?.display_name]);

  useEffect(() => {
    const fetchBioData = async () => {
      if (!username) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      try {
        // Try to find by username first, then by ID, including user data for fallback name
        let { data: profile, error: profileError } = await supabase
          .from('talent_profiles')
          .select(`
            *,
            users!talent_profiles_user_id_fkey (
              full_name
            )
          `)
          .eq('username', username)
          .single();

        if (profileError || !profile) {
          // Try by ID
          const { data: profileById, error: idError } = await supabase
            .from('talent_profiles')
            .select(`
              *,
              users!talent_profiles_user_id_fkey (
                full_name
              )
            `)
            .eq('id', username)
            .single();

          if (idError || !profileById) {
            setNotFound(true);
            setLoading(false);
            return;
          }
          profile = profileById;
        }

        setTalentProfile(profile);

        // Track page view (skip if preview mode)
        const urlParams = new URLSearchParams(window.location.search);
        const isPreview = urlParams.get('preview') === 'true';
        
        if (!isPreview) {
          try {
            await fetch(`${process.env.REACT_APP_SUPABASE_URL}/functions/v1/track-bio-view`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY}`,
              },
              body: JSON.stringify({
                talent_id: profile.id,
                referrer: document.referrer || null,
                utm_source: urlParams.get('utm_source'),
                utm_medium: urlParams.get('utm_medium'),
                utm_campaign: urlParams.get('utm_campaign'),
              }),
            });
          } catch (error) {
            // Silently fail - don't block page load
            console.error('Failed to track view:', error);
          }
        }

        // Get bio settings - auto-create if they don't exist
        let { data: settings, error: settingsError } = await supabase
          .from('bio_settings')
          .select('*')
          .eq('talent_id', profile.id)
          .single();

        // If no settings exist, create default ones (auto-published)
        if (settingsError && settingsError.code === 'PGRST116') {
          const defaultSettings = {
            talent_id: profile.id,
            theme: 'glass',
            background_color: '#0a0a0a',
            accent_color: '#3b82f6',
            font_family: 'Inter',
            show_shoutout_card: true,
            is_published: true, // Auto-publish by default
            background_type: 'gradient',
            gradient_start: '#0a0a0a',
            gradient_end: '#1a1a2e',
            gradient_direction: 'to-b',
            button_style: 'rounded',
            button_color: '#3b82f6',
            text_color: '#ffffff',
            card_style: 'glass',
            card_opacity: 0.10,
            display_name: profile.full_name,
            profile_image_url: profile.temp_avatar_url,
          };

          const { data: newSettings, error: createError } = await supabase
            .from('bio_settings')
            .insert([defaultSettings])
            .select()
            .single();

          if (!createError && newSettings) {
            settings = newSettings;
          }
        }

        // If still no settings or not published, show not found
        if (!settings || !settings.is_published) {
          setNotFound(true);
          setLoading(false);
          return;
        }

        setBioSettings(settings);

        // Get links
        const { data: linksData } = await supabase
          .from('bio_links')
          .select('*')
          .eq('talent_id', profile.id)
          .eq('is_active', true)
          .order('display_order');

        setLinks(linksData || []);

        // Get a random review with user info
        const { data: reviews } = await supabase
          .from('reviews')
          .select('*, users:user_id(full_name)')
          .eq('talent_id', profile.id)
          .gte('rating', 4)
          .limit(10);

        if (reviews && reviews.length > 0) {
          const randomIndex = Math.floor(Math.random() * reviews.length);
          setRandomReview(reviews[randomIndex]);
        }

        // Get newsletter config
        const { data: newsletterData } = await supabase
          .from('bio_newsletter_configs')
          .select('*')
          .eq('talent_id', profile.id)
          .eq('is_active', true)
          .limit(1);

        if (newsletterData && newsletterData.length > 0) {
          setNewsletterConfig(newsletterData[0]);
        }

        // Get social accounts from the social_accounts table
        const { data: socialData } = await supabase
          .from('social_accounts')
          .select('id, platform, handle, follower_count')
          .eq('talent_id', profile.id);
        
        console.log('Social accounts from DB:', socialData);
        
        // Combine social_accounts with handles from talent_profiles
        // This ensures handles added via admin show up even if not in social_accounts
        const combinedAccounts: SocialAccount[] = [];
        
        // First add all from social_accounts table
        if (socialData && socialData.length > 0) {
          for (const s of socialData) {
            combinedAccounts.push({
              id: s.id,
              platform: s.platform,
              handle: s.handle.replace(/^@/, ''),
              follower_count: s.follower_count,
            });
          }
        }
        
        // Then add any handles from talent_profiles that aren't already in the list
        const handleMappings = [
          { platform: 'twitter', field: 'twitter_handle' },
          { platform: 'instagram', field: 'instagram_handle' },
          { platform: 'facebook', field: 'facebook_handle' },
          { platform: 'tiktok', field: 'tiktok_handle' },
          { platform: 'youtube', field: 'youtube_handle' },
          { platform: 'rumble', field: 'rumble_handle' },
        ];
        
        // Get follower_counts from talent_profiles (fallback storage)
        const profileFollowerCounts = (profile as any).follower_counts || {};
        console.log('Profile follower_counts from DB:', profileFollowerCounts);
        
        for (const mapping of handleMappings) {
          const handle = (profile as any)[mapping.field];
          if (handle) {
            const existsAlready = combinedAccounts.some(s => s.platform === mapping.platform);
            if (!existsAlready) {
              combinedAccounts.push({
                id: `profile-${mapping.platform}`,
                platform: mapping.platform,
                handle: handle.replace(/^@/, ''),
                follower_count: profileFollowerCounts[mapping.platform] || undefined,
              });
            } else {
              // If it exists but doesn't have a follower count, try to get it from profile
              const existingAccount = combinedAccounts.find(s => s.platform === mapping.platform);
              if (existingAccount && !existingAccount.follower_count && profileFollowerCounts[mapping.platform]) {
                existingAccount.follower_count = profileFollowerCounts[mapping.platform];
              }
            }
          }
        }
        
        if (combinedAccounts.length > 0) {
          setSocialAccounts(combinedAccounts);
          fetchFollowerCounts(combinedAccounts, profile.id);
        }

        // Get active service offerings
        const { data: servicesData } = await supabase
          .from('service_offerings')
          .select('*')
          .eq('talent_id', profile.id)
          .eq('is_active', true)
          .order('display_order', { ascending: true });
        
        if (servicesData && servicesData.length > 0) {
          setServiceOfferings(servicesData.map(s => ({
            ...s,
            benefits: Array.isArray(s.benefits) ? s.benefits : JSON.parse(s.benefits || '[]'),
            platforms: Array.isArray(s.platforms) ? s.platforms : JSON.parse(s.platforms || '["instagram"]'),
          })));
        }

        // Get active bio events
        const { data: eventsData } = await supabase
          .from('bio_events')
          .select('*')
          .eq('talent_id', profile.id)
          .eq('is_active', true)
          .order('display_order', { ascending: true });
        
        if (eventsData && eventsData.length > 0) {
          setBioEvents(eventsData);
        }

        // Fetch Rumble data - first try cache, then fall back to live scraping
        if (profile.rumble_handle) {
          fetchRumbleData(profile.id, profile.rumble_handle, profile.rumble_type);
        }

        // Fetch YouTube data - same caching strategy
        if (profile.youtube_handle) {
          fetchYouTubeData(profile.id, profile.youtube_handle);
        }

        // Fetch Podcast data if RSS feed is configured
        if (profile.podcast_rss_url) {
          fetchPodcastData(profile.podcast_rss_url, profile.podcast_name || 'Podcast');
        }

      } catch (error) {
        console.error('Error fetching bio data:', error);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };

    fetchBioData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username]);

  // Check if user is logged in and if they're already following this talent
  useEffect(() => {
    const checkUserSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          // User is logged in, get their profile
          const { data: userData } = await supabase
            .from('users')
            .select('id, email, phone, full_name')
            .eq('id', session.user.id)
            .single();
          
          if (userData) {
            setCurrentUser(userData);
            
            // Check if already following this talent
            if (talentProfile?.id) {
              const { data: followData } = await supabase
                .from('talent_followers')
                .select('id')
                .eq('user_id', userData.id)
                .eq('talent_id', talentProfile.id)
                .single();
              
              setIsFollowing(!!followData);
            }
          }
        }
      } catch (error) {
        console.log('No active session or error checking:', error);
      }
    };

    if (talentProfile?.id) {
      checkUserSession();
    }
  }, [talentProfile?.id]);

  // Fetch follower counts for social accounts
  // Note: Most social platforms block direct scraping. Follower counts can be:
  // 1. Manually entered in the social_accounts table
  // 2. Fetched via official APIs (requires API keys/auth)
  // 3. Updated via a backend service with proper authentication
  const fetchFollowerCounts = async (accounts: SocialAccount[], _talentId: string) => {
    // For now, we just use whatever is in the database
    // The follower_count field should be populated either:
    // - Manually by admin in Supabase
    // - Via a backend cron job with proper API access
    // - Via the Bio Dashboard settings
    
    // Log which accounts don't have follower counts for debugging
    const missingCounts = accounts.filter(a => !a.follower_count || a.follower_count === 0);
    if (missingCounts.length > 0) {
      console.log('Accounts missing follower counts:', missingCounts.map(a => `${a.platform}:@${a.handle}`));
    }
  };

  // Fetch Rumble channel data - show cache immediately, one visitor per 15 min triggers refresh
  const fetchRumbleData = async (talentId: string, rumbleHandle: string, rumbleType?: 'c' | 'user') => {
    const cleanHandle = rumbleHandle.replace(/^@/, '');
    const urlPrefix = rumbleType || 'c'; // 'c' for channel (default), 'user' for user profile
    const defaultChannelUrl = `https://rumble.com/${urlPrefix}/${cleanHandle}`;
    
    try {
      // Get cached data from rumble_cache table
      const { data: cachedData, error: cacheError } = await supabase
        .from('rumble_cache')
        .select('*')
        .eq('talent_id', talentId)
        .single();
      
      if (!cacheError && cachedData) {
        // Show cached data immediately
        setRumbleData({
          title: cachedData.latest_video_title || 'Watch on Rumble',
          thumbnail: cachedData.latest_video_thumbnail || '',
          url: cachedData.latest_video_url || cachedData.channel_url || defaultChannelUrl,
          views: cachedData.latest_video_views || 0,
          isLive: cachedData.is_live || false,
          liveViewers: cachedData.live_viewers || 0,
        });
        
        // Check if cache is stale (>15 min old) or empty
        const lastChecked = new Date(cachedData.last_checked_at).getTime();
        const fifteenMinAgo = Date.now() - 15 * 60 * 1000;
        const needsRefresh = !cachedData.latest_video_thumbnail || lastChecked < fifteenMinAgo;
        
        if (needsRefresh) {
          // Scrape in background - timestamp only updates on SUCCESS
          scrapeRumbleInBackground(talentId, rumbleHandle, cleanHandle, defaultChannelUrl, lastChecked, rumbleType);
        }
        return;
      }
      
      // No cache - show fallback and try to create cache entry
      setRumbleData({
        title: 'Watch on Rumble',
        thumbnail: '',
        url: defaultChannelUrl,
        views: 0,
        isLive: false,
        liveViewers: 0,
      });
      
      // Scrape in background - will create cache entry on success
      scrapeRumbleInBackground(talentId, rumbleHandle, cleanHandle, defaultChannelUrl, 0, rumbleType);
      
    } catch (error) {
      console.error('Error fetching Rumble data:', error);
      setRumbleData({
        title: 'Watch on Rumble',
        thumbnail: '',
        url: defaultChannelUrl,
        views: 0,
        isLive: false,
        liveViewers: 0,
      });
    }
  };
  
  // Background scrape - doesn't block UI, updates cache only on SUCCESS
  const scrapeRumbleInBackground = async (talentId: string, rumbleHandle: string, cleanHandle: string, defaultChannelUrl: string, originalTimestamp: number, rumbleType?: 'c' | 'user') => {
    try {
      // If rumble_type is set, only try that URL format; otherwise try both
      const urlFormats = rumbleType 
        ? [`https://rumble.com/${rumbleType}/${cleanHandle}`]
        : [
            `https://rumble.com/user/${cleanHandle}`,
            `https://rumble.com/c/${cleanHandle}`,
          ];
      
      let html = '';
      let successUrl = '';
      
      for (const channelUrl of urlFormats) {
        const corsProxies = [
          `https://api.allorigins.win/raw?url=${encodeURIComponent(channelUrl)}`,
          `https://corsproxy.io/?${encodeURIComponent(channelUrl)}`,
        ];
        
        for (const proxyUrl of corsProxies) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);
            
            const response = await fetch(proxyUrl, {
              headers: { 'Accept': 'text/html' },
              signal: controller.signal,
            });
            clearTimeout(timeoutId);
            
            if (response.ok) {
              const text = await response.text();
              if (text.includes('thumbnail__image') || text.includes('thumbnail__title')) {
                html = text;
                successUrl = channelUrl;
                break;
              }
            }
          } catch {
            // Continue to next proxy
          }
        }
        if (html) break;
      }
      
      if (!html) return; // No data, keep current display
      
      // Parse the HTML
      const htmlClean = html
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
      
      // Check for live stream
      const isLive = !!(
        htmlClean.match(/class="[^"]*videostream__status--live[^"]*"/i) ||
        htmlClean.match(/class="[^"]*thumbnail__thumb--live[^"]*"/i)
      );
      
      // Find thumbnail
      let thumbnail = '';
      const thumbMatch = htmlClean.match(/src="(https:\/\/1a-1791\.com\/video\/[^"]*-small-[^"]*\.(jpg|jpeg|webp|png))"/i);
      if (thumbMatch) {
        thumbnail = thumbMatch[1];
      }
      
      // Find title
      let title = 'Latest Video';
      const titleMatch = htmlClean.match(/class="thumbnail__title[^"]*"[^>]*title="([^"]{10,200})"/i);
      if (titleMatch) {
        title = titleMatch[1].trim();
      }
      
      // Find video URL
      let videoUrl = successUrl;
      const urlMatch = htmlClean.match(/href="(\/v[a-z0-9]+-[^"]+\.html)/i);
      if (urlMatch) {
        videoUrl = `https://rumble.com${urlMatch[1].split('?')[0]}`;
      }
      
      // Find views
      let views = 0;
      const viewsMatch = htmlClean.match(/data-views="(\d+)"/i);
      if (viewsMatch) {
        views = parseInt(viewsMatch[1]) || 0;
      }
      
      const finalThumbnail = thumbnail.startsWith('//') ? `https:${thumbnail}` : thumbnail;
      
      // Only update if we got useful data
      if (finalThumbnail || title !== 'Latest Video') {
        // Update cache with new data
        await supabase
          .from('rumble_cache')
          .upsert({
            talent_id: talentId,
            rumble_handle: rumbleHandle,
            is_live: isLive,
            live_viewers: 0,
            latest_video_title: title,
            latest_video_thumbnail: finalThumbnail,
            latest_video_url: videoUrl,
            latest_video_views: views,
            channel_url: successUrl,
            last_checked_at: new Date().toISOString(),
          }, { onConflict: 'talent_id' });
        
        // Update UI with new data
        setRumbleData({
          title,
          thumbnail: finalThumbnail,
          url: videoUrl,
          views,
          isLive,
          liveViewers: 0,
        });
      }
    } catch (error) {
      console.error('Background Rumble scrape failed:', error);
    }
  };

  // YouTube API Key - stored in environment
  const YOUTUBE_API_KEY = process.env.REACT_APP_YOUTUBE_API_KEY || '';

  // Fetch YouTube channel data - show cache immediately, one visitor per 15 min triggers refresh
  const fetchYouTubeData = async (talentId: string, youtubeHandle: string) => {
    const cleanHandle = youtubeHandle.replace(/^@/, '');
    const defaultChannelUrl = `https://youtube.com/@${cleanHandle}`;
    
    console.log('fetchYouTubeData called:', { talentId, youtubeHandle, cleanHandle, hasApiKey: !!YOUTUBE_API_KEY, keyPreview: YOUTUBE_API_KEY ? YOUTUBE_API_KEY.substring(0, 8) + '...' : 'none' });
    
    try {
      // Get cached data from youtube_cache table
      const { data: cachedData, error: cacheError } = await supabase
        .from('youtube_cache')
        .select('*')
        .eq('talent_id', talentId)
        .single();
      
      if (!cacheError && cachedData) {
        // Show cached data immediately
        setYoutubeData({
          title: cachedData.latest_video_title || 'Watch on YouTube',
          thumbnail: cachedData.latest_video_thumbnail || '',
          url: cachedData.latest_video_url || defaultChannelUrl,
          views: cachedData.latest_video_views || 0,
          isLive: cachedData.is_live || false,
          liveViewers: cachedData.live_viewers || 0,
          channelUrl: cachedData.channel_url || defaultChannelUrl,
        });
        
        // Check if cache is stale (>15 min old) or empty
        const lastChecked = new Date(cachedData.last_checked_at).getTime();
        const fifteenMinAgo = Date.now() - 15 * 60 * 1000;
        const needsRefresh = !cachedData.latest_video_thumbnail || lastChecked < fifteenMinAgo;
        
        if (needsRefresh && YOUTUBE_API_KEY) {
          fetchYouTubeInBackground(talentId, youtubeHandle, cleanHandle, defaultChannelUrl);
        }
        return;
      }
      
      // No cache - show fallback and fetch in background
      setYoutubeData({
        title: 'Watch on YouTube',
        thumbnail: '',
        url: defaultChannelUrl,
        views: 0,
        isLive: false,
        liveViewers: 0,
        channelUrl: defaultChannelUrl,
      });
      
      if (YOUTUBE_API_KEY) {
        fetchYouTubeInBackground(talentId, youtubeHandle, cleanHandle, defaultChannelUrl);
      } else {
        console.log('YouTube API key not configured - skipping YouTube data fetch');
      }
      
    } catch (error) {
      console.error('Error fetching YouTube data:', error);
      setYoutubeData({
        title: 'Watch on YouTube',
        thumbnail: '',
        url: defaultChannelUrl,
        views: 0,
        isLive: false,
        liveViewers: 0,
        channelUrl: defaultChannelUrl,
      });
    }
  };
  
  // Background YouTube API fetch - updates cache on SUCCESS only
  const fetchYouTubeInBackground = async (talentId: string, youtubeHandle: string, cleanHandle: string, defaultChannelUrl: string) => {
    try {
      if (!YOUTUBE_API_KEY) {
        console.log('YouTube API key not available in background fetch');
        return;
      }
      
      console.log('Fetching YouTube data for:', cleanHandle);
      
      // First, get the channel ID from the handle
      let channelId = '';
      
      // Try to get channel by handle (newer @handle format)
      const handleResponse = await fetch(
        `https://www.googleapis.com/youtube/v3/channels?part=id,snippet&forHandle=${cleanHandle}&key=${YOUTUBE_API_KEY}`
      );
      const handleData = await handleResponse.json();
      
      // Log any API errors
      if (handleData.error) {
        console.error('YouTube API error:', handleData.error);
        return;
      }
      
      if (handleData.items && handleData.items.length > 0) {
        channelId = handleData.items[0].id;
      } else {
        // Try as username (older format)
        const usernameResponse = await fetch(
          `https://www.googleapis.com/youtube/v3/channels?part=id,snippet&forUsername=${cleanHandle}&key=${YOUTUBE_API_KEY}`
        );
        const usernameData = await usernameResponse.json();
        
        if (usernameData.items && usernameData.items.length > 0) {
          channelId = usernameData.items[0].id;
        } else {
          // Maybe it's already a channel ID
          const idResponse = await fetch(
            `https://www.googleapis.com/youtube/v3/channels?part=id,snippet&id=${cleanHandle}&key=${YOUTUBE_API_KEY}`
          );
          const idData = await idResponse.json();
          
          if (idData.items && idData.items.length > 0) {
            channelId = idData.items[0].id;
          }
        }
      }
      
      if (!channelId) {
        console.log('Could not find YouTube channel for:', cleanHandle);
        return;
      }
      
      // Check for live streams first
      const liveResponse = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&eventType=live&type=video&key=${YOUTUBE_API_KEY}`
      );
      const liveData = await liveResponse.json();
      
      let isLive = false;
      let liveViewers = 0;
      let videoId = '';
      let videoTitle = 'Latest Video';
      let videoThumbnail = '';
      
      if (liveData.items && liveData.items.length > 0) {
        // Channel is live!
        isLive = true;
        const liveVideo = liveData.items[0];
        videoId = liveVideo.id.videoId;
        videoTitle = liveVideo.snippet.title;
        videoThumbnail = liveVideo.snippet.thumbnails?.high?.url || liveVideo.snippet.thumbnails?.medium?.url || '';
        
        // Get live viewer count
        const statsResponse = await fetch(
          `https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails&id=${videoId}&key=${YOUTUBE_API_KEY}`
        );
        const statsData = await statsResponse.json();
        
        if (statsData.items && statsData.items.length > 0 && statsData.items[0].liveStreamingDetails) {
          liveViewers = parseInt(statsData.items[0].liveStreamingDetails.concurrentViewers || '0');
        }
      } else {
        // Not live - get latest video
        const videosResponse = await fetch(
          `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&order=date&type=video&maxResults=1&key=${YOUTUBE_API_KEY}`
        );
        const videosData = await videosResponse.json();
        
        if (videosData.items && videosData.items.length > 0) {
          const latestVideo = videosData.items[0];
          videoId = latestVideo.id.videoId;
          videoTitle = latestVideo.snippet.title;
          videoThumbnail = latestVideo.snippet.thumbnails?.high?.url || latestVideo.snippet.thumbnails?.medium?.url || '';
        }
      }
      
      if (!videoId) return;
      
      // Get view count for the video
      let views = 0;
      const videoStatsResponse = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoId}&key=${YOUTUBE_API_KEY}`
      );
      const videoStatsData = await videoStatsResponse.json();
      
      if (videoStatsData.items && videoStatsData.items.length > 0) {
        views = parseInt(videoStatsData.items[0].statistics?.viewCount || '0');
      }
      
      const videoUrl = `https://youtube.com/watch?v=${videoId}`;
      const channelUrl = `https://youtube.com/channel/${channelId}`;
      
      // Save to cache
      const { data: updateResult } = await supabase
        .from('youtube_cache')
        .upsert({
          talent_id: talentId,
          youtube_handle: youtubeHandle,
          channel_id: channelId,
          is_live: isLive,
          live_viewers: liveViewers,
          latest_video_id: videoId,
          latest_video_title: videoTitle,
          latest_video_thumbnail: videoThumbnail,
          latest_video_url: videoUrl,
          latest_video_views: views,
          channel_url: channelUrl,
          last_checked_at: new Date().toISOString(),
        }, { onConflict: 'talent_id' })
        .select('talent_id');
      
      // Only update UI if we successfully saved to cache
      if (updateResult && updateResult.length > 0) {
        setYoutubeData({
          title: videoTitle,
          thumbnail: videoThumbnail,
          url: videoUrl,
          views,
          isLive,
          liveViewers,
          channelUrl,
        });
      }
    } catch (error) {
      console.error('Background YouTube fetch failed:', error);
    }
  };

  // Fetch podcast data - with 12-hour caching
  const fetchPodcastData = async (rssUrl: string, podcastName: string) => {
    if (fetchingPodcast || podcastFetchedRef.current) {
      console.log('Podcast fetch already in progress or completed, skipping');
      return;
    }
    
    console.log('Fetching podcast data for:', rssUrl);
    setFetchingPodcast(true);
    podcastFetchedRef.current = true;
    
    try {
      // Step 1: Check cache first (12-hour TTL)
      const { data: cachedData } = await supabase
        .from('podcast_cache')
        .select('*')
        .eq('podcast_rss_url', rssUrl)
        .single();
      
      const TWELVE_HOURS = 12 * 60 * 60 * 1000; // 12 hours in milliseconds
      const cacheIsValid = cachedData?.last_checked_at && 
        (Date.now() - new Date(cachedData.last_checked_at).getTime()) < TWELVE_HOURS;
      
      if (cacheIsValid && cachedData) {
        console.log('Using cached podcast data (< 12 hours old)');
        
        const cachedPodcastData = {
          title: cachedData.latest_episode_title || 'Latest Episode',
          description: cachedData.latest_episode_description || '',
          thumbnail: cachedData.latest_episode_thumbnail || '',
          url: cachedData.latest_episode_url || rssUrl,
          audioUrl: cachedData.latest_episode_audio_url || '',
          pubDate: cachedData.latest_episode_pub_date || '',
          duration: cachedData.latest_episode_duration || '',
          views: undefined,
          podcastName: cachedData.podcast_name || podcastName,
          feedUrl: rssUrl,
          listenLinks: cachedData.listen_links || undefined,
        };
        
        setPodcastData(cachedPodcastData);
        setFetchingPodcast(false);
        return;
      }
      
      console.log('Cache miss or stale, fetching fresh podcast data...');
      
      // Step 2: Fetch fresh data from RSS
      let text = '';
      
      // Try multiple CORS proxies in order
      const proxies = [
        `https://api.allorigins.win/raw?url=${encodeURIComponent(rssUrl)}`,
        `https://corsproxy.io/?${encodeURIComponent(rssUrl)}`,
        rssUrl, // Try direct fetch last
      ];
      
      for (const proxyUrl of proxies) {
        try {
          console.log('Trying proxy:', proxyUrl.substring(0, 50) + '...');
          const response = await fetch(proxyUrl, {
            signal: AbortSignal.timeout(10000), // 10 second timeout
          });
          
          if (response.ok) {
            text = await response.text();
            console.log('Successfully fetched RSS, length:', text.length);
            break;
          }
        } catch (fetchErr) {
          console.warn('Fetch attempt failed:', fetchErr);
          continue;
        }
      }
      
      if (!text) {
        console.error('All fetch attempts failed for podcast RSS');
        return;
      }

      const parser = new DOMParser();
      const xml = parser.parseFromString(text, 'text/xml');
      
      // Check for parse errors
      const parseError = xml.querySelector('parsererror');
      if (parseError) {
        console.error('RSS parse error:', parseError.textContent);
        return;
      }

      const channel = xml.querySelector('channel');
      if (!channel) {
        console.error('No channel found in RSS feed');
        return;
      }

      // Get podcast title from feed if not provided
      const feedTitle = channel.querySelector('title')?.textContent || podcastName;
      
      // Get the latest episode (first item)
      const item = channel.querySelector('item');
      if (!item) {
        console.error('No episodes found in podcast feed');
        return;
      }

      const title = item.querySelector('title')?.textContent || 'Latest Episode';
      const description = item.querySelector('description')?.textContent || '';
      const pubDate = item.querySelector('pubDate')?.textContent || '';
      
      // Get episode link - try different common formats
      let episodeUrl = item.querySelector('link')?.textContent || '';
      
      // Try to get enclosure URL (direct audio link) - this is the actual MP3 file
      const enclosure = item.querySelector('enclosure');
      const audioUrl = enclosure?.getAttribute('url') || '';
      
      console.log('Episode URLs:', { episodeUrl, audioUrl });
      
      // Use audio URL for episode URL if page link is missing
      if (!episodeUrl && audioUrl) {
        episodeUrl = audioUrl;
      }
      
      // Get thumbnail - try iTunes image first, then channel image
      let thumbnail = '';
      
      // Try iTunes image on the item
      const itunesImage = item.querySelector('image');
      if (itunesImage) {
        thumbnail = itunesImage.getAttribute('href') || itunesImage.textContent || '';
      }
      
      // Try media:thumbnail
      if (!thumbnail) {
        const mediaThumbnail = item.querySelector('thumbnail');
        if (mediaThumbnail) {
          thumbnail = mediaThumbnail.getAttribute('url') || '';
        }
      }
      
      // Fall back to channel image
      if (!thumbnail) {
        const channelImage = channel.querySelector('image > url');
        if (channelImage) {
          thumbnail = channelImage.textContent || '';
        }
      }
      
      // Try iTunes channel image
      if (!thumbnail) {
        const itunesChannelImage = channel.querySelector('image[href]');
        if (itunesChannelImage) {
          thumbnail = itunesChannelImage.getAttribute('href') || '';
        }
      }
      
      // Get duration if available
      const durationEl = item.querySelector('duration');
      const duration = durationEl?.textContent || '';

      // Format listen count from enclosure length (bytes) - rough estimate
      let views = null;
      const enclosureLength = enclosure?.getAttribute('length');
      if (enclosureLength) {
        const bytes = parseInt(enclosureLength);
        // Rough estimate: assume avg 50MB file = 1000 downloads
        const estimatedListens = Math.floor(bytes / 50000);
        if (estimatedListens > 0) {
          views = estimatedListens >= 1000 
            ? `${(estimatedListens / 1000).toFixed(1)}K` 
            : `${estimatedListens}`;
        }
      }

      // Extract platform links from RSS feed
      const listenLinks: { spotify?: string; apple?: string; youtube?: string; google?: string; [key: string]: string | undefined } = {};
      
      // Look for links in channel (podcast-level links)
      const allLinks = Array.from(channel.querySelectorAll('link'));
      allLinks.forEach(link => {
        const href = link.getAttribute('href') || link.textContent || '';
        const lowerHref = href.toLowerCase();
        
        if (lowerHref.includes('spotify.com')) {
          listenLinks.spotify = href;
        } else if (lowerHref.includes('apple.com/podcast') || lowerHref.includes('podcasts.apple.com')) {
          listenLinks.apple = href;
        } else if (lowerHref.includes('youtube.com') || lowerHref.includes('youtu.be')) {
          listenLinks.youtube = href;
        } else if (lowerHref.includes('podcasts.google.com')) {
          listenLinks.google = href;
        }
      });
      
      // Also check atom:link elements with rel attribute
      const atomLinks = Array.from(channel.querySelectorAll('atom\\:link, [rel]'));
      atomLinks.forEach(link => {
        const href = link.getAttribute('href') || '';
        const lowerHref = href.toLowerCase();
        
        if (lowerHref.includes('spotify.com') && !listenLinks.spotify) {
          listenLinks.spotify = href;
        } else if ((lowerHref.includes('apple.com/podcast') || lowerHref.includes('podcasts.apple.com')) && !listenLinks.apple) {
          listenLinks.apple = href;
        } else if ((lowerHref.includes('youtube.com') || lowerHref.includes('youtu.be')) && !listenLinks.youtube) {
          listenLinks.youtube = href;
        } else if (lowerHref.includes('podcasts.google.com') && !listenLinks.google) {
          listenLinks.google = href;
        }
      });
      
      console.log('Extracted listen links:', listenLinks);

      const podcastDataObj = {
        title,
        description: description.replace(/<[^>]*>/g, '').substring(0, 200), // Strip HTML and truncate
        thumbnail,
        url: episodeUrl || rssUrl,
        audioUrl: audioUrl || episodeUrl, // Direct audio link for player
        pubDate,
        duration,
        views: views || undefined,
        podcastName: feedTitle,
        feedUrl: rssUrl,
        listenLinks: Object.keys(listenLinks).length > 0 ? listenLinks : undefined,
      };
      
      console.log('Successfully parsed podcast data:', podcastDataObj);
      setPodcastData(podcastDataObj);
      
      // Enhance with PodcastIndex API platform links (runs in background)
      let enhancedLinks = { ...listenLinks };
      try {
        const { data: platformData, error: platformError } = await supabase.functions.invoke('get-podcast-platforms', {
          body: { feedUrl: rssUrl }
        });
        
        if (!platformError && platformData?.platforms) {
          console.log('PodcastIndex platform links:', platformData.platforms);
          // Merge with existing links (PodcastIndex takes priority)
          enhancedLinks = {
            ...listenLinks,
            ...platformData.platforms,
          };
          
          if (Object.keys(enhancedLinks).length > 0) {
            setPodcastData(prev => prev ? {
              ...prev,
              listenLinks: enhancedLinks
            } : prev);
            console.log('Enhanced with platform links:', enhancedLinks);
          }
        }
      } catch (platformError) {
        console.warn('PodcastIndex API call failed (non-blocking):', platformError);
      }
      
      // Step 3: Update cache with fresh data (upsert)
      try {
        const cacheData = {
          podcast_rss_url: rssUrl,
          podcast_name: feedTitle,
          latest_episode_title: title,
          latest_episode_description: description.replace(/<[^>]*>/g, '').substring(0, 500),
          latest_episode_thumbnail: thumbnail,
          latest_episode_url: episodeUrl || rssUrl,
          latest_episode_audio_url: audioUrl,
          latest_episode_duration: duration,
          latest_episode_pub_date: pubDate,
          listen_links: Object.keys(enhancedLinks).length > 0 ? enhancedLinks : null,
          last_checked_at: new Date().toISOString(),
        };
        
        // Use upsert to insert or update based on podcast_rss_url
        const { error: cacheError } = await supabase
          .from('podcast_cache')
          .upsert(cacheData, { 
            onConflict: 'podcast_rss_url',
            ignoreDuplicates: false 
          });
        
        if (cacheError) {
          console.warn('Failed to update podcast cache:', cacheError);
        } else {
          console.log('Podcast cache updated successfully');
        }
      } catch (cacheErr) {
        console.warn('Error updating podcast cache (non-blocking):', cacheErr);
      }
    } catch (error) {
      console.error('Error fetching podcast data:', error);
    } finally {
      setFetchingPodcast(false);
    }
  };

  // Track link clicks
  const handleLinkClick = async (link: BioLink) => {
    if (link.id) {
      await supabase
        .from('bio_links')
        .update({ click_count: (link.click_count || 0) + 1 })
        .eq('id', link.id);
    }
  };

  // Handle follow/newsletter signup
  const handleFollowSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!talentProfile?.id) return;

    // If user is already logged in, just follow
    if (currentUser) {
      setSubscribing(true);
      try {
        // Add follow relationship
        const { error: followError } = await supabase
          .from('talent_followers')
          .insert({
            user_id: currentUser.id,
            talent_id: talentProfile.id,
          });

        if (followError && !followError.message.includes('duplicate')) {
          throw followError;
        }

        // Enroll user in talent_connection email flow via capture-lead
        if (currentUser.email) {
          try {
            await supabase.functions.invoke('capture-lead', {
              body: {
                email: currentUser.email,
                phone: currentUser.phone || null,
                source: 'bio_page',
                talent_slug: talentProfile.username || talentProfile.id,
              }
            });
            console.log('User enrolled in talent_connection email flow');
          } catch (flowError) {
            console.error('Email flow enrollment error:', flowError);
          }
        }

        // Also send to newsletter integration if configured
        if (newsletterConfig) {
          try {
            await sendToNewsletterIntegration(newsletterConfig, {
              email: currentUser.email || '',
              phone: currentUser.phone || null,
              name: currentUser.full_name || '',
              talent_id: talentProfile.id,
              talent_name: bioSettings?.display_name || talentProfile?.full_name || '',
            });
            console.log('Newsletter integration triggered successfully');
          } catch (webhookError) {
            console.error('Newsletter integration error:', webhookError);
          }
        }

        setIsFollowing(true);
        toast.success(`You're now subscribed to ${bioSettings?.display_name || talentProfile?.full_name?.split(' ')[0]}!`);
      } catch (error) {
        console.error('Follow error:', error);
        toast.error('Failed to follow. Please try again.');
      } finally {
        setSubscribing(false);
      }
      return;
    }

    // New user flow - need email first
    if (!newsletterEmail) {
      toast.error('Please enter your email');
      return;
    }

    // If we need phone and don't have it yet, show phone field
    if (showPhoneField && !newsletterPhone) {
      toast.error('Please enter your phone number');
      return;
    }

    setSubscribing(true);
    try {
      // Check if user already exists by email
      const { data: existingUser } = await supabase
        .from('users')
        .select('id, email, phone')
        .eq('email', newsletterEmail.toLowerCase())
        .single();

      let userId: string;

      if (existingUser) {
        // User exists, use their ID
        userId = existingUser.id;
        
        // If they don't have a phone and we collected one, update it
        if (!existingUser.phone && newsletterPhone) {
          await supabase
            .from('users')
            .update({ phone: newsletterPhone })
            .eq('id', existingUser.id);
        }
      } else {
        // Create new user with email (and phone if provided)
        // First check if they have a ShoutOut profile by checking if phone exists
        if (!showPhoneField) {
          // Check if this email exists in auth
          // If not, show phone field to complete registration
          setShowPhoneField(true);
          setSubscribing(false);
          return;
        }

        // Create the user in the users table
        // Generate a UUID for the user ID
        const newUserId = crypto.randomUUID();
        const { data: newUser, error: createError } = await supabase
          .from('users')
          .insert({
            id: newUserId,
            email: newsletterEmail.toLowerCase(),
            phone: newsletterPhone || null,
            user_type: 'user',
            full_name: '',
            promo_source: 'Shout.bio', // Track that user came from bio page
          })
          .select()
          .single();

        if (createError) {
          // If duplicate key error, user might exist with different case
          if (createError.message.includes('duplicate')) {
            const { data: dupUser } = await supabase
              .from('users')
              .select('id')
              .ilike('email', newsletterEmail)
              .single();
            if (dupUser) {
              userId = dupUser.id;
            } else {
              throw createError;
            }
          } else {
            throw createError;
          }
        } else {
          userId = newUser.id;
        }
      }

      // Now add the follow relationship
      const { error: followError } = await supabase
        .from('talent_followers')
        .insert({
          user_id: userId!,
          talent_id: talentProfile.id,
        });

      if (followError && !followError.message.includes('duplicate')) {
        throw followError;
      }

      // Enroll user in talent_connection email flow via capture-lead
      try {
        await supabase.functions.invoke('capture-lead', {
          body: {
            email: newsletterEmail.toLowerCase(),
            phone: newsletterPhone || null,
            source: 'bio_page',
            talent_slug: talentProfile.username || talentProfile.id,
          }
        });
        console.log('User enrolled in talent_connection email flow');
      } catch (flowError) {
        console.error('Email flow enrollment error:', flowError);
      }

      // Send to newsletter integration if configured
      if (newsletterConfig) {
        try {
          await sendToNewsletterIntegration(newsletterConfig, {
            email: newsletterEmail,
            phone: newsletterPhone || null,
            name: '', // We don't collect name in the form
            talent_id: talentProfile.id,
            talent_name: bioSettings?.display_name || talentProfile?.full_name || '',
          });
          console.log('Newsletter integration triggered successfully');
        } catch (webhookError) {
          // Don't fail the whole signup if newsletter integration fails
          console.error('Newsletter integration error:', webhookError);
        }
      }

      setIsFollowing(true);
      toast.success(`You're now subscribed to ${bioSettings?.display_name || talentProfile?.full_name?.split(' ')[0]}!`);
      setNewsletterEmail('');
      setNewsletterPhone('');
      setShowPhoneField(false);
    } catch (error) {
      console.error('Follow signup error:', error);
      toast.error('Failed to subscribe. Please try again.');
    } finally {
      setSubscribing(false);
    }
  };

  // Get button radius class
  const getRadiusClass = () => {
    const buttonStyle = bioSettings?.button_style || 'rounded';
    if (buttonStyle === 'pill') return 'rounded-full';
    if (buttonStyle === 'square') return 'rounded-md';
    return 'rounded-xl';
  };

  // Get button style object - ALL styling done via inline styles for consistency
  const getButtonStyle = (): React.CSSProperties => {
    const buttonColor = bioSettings?.button_color || '#3b82f6';
    const cardStyle = bioSettings?.card_style || 'glass';
    
    const baseStyle: React.CSSProperties = {
      width: '100%',
      padding: '16px',
      transition: 'all 0.3s',
      display: 'block',
    };
    
    if (cardStyle === 'glass') {
      return {
        ...baseStyle,
        backgroundColor: `${buttonColor}20`,
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: `${buttonColor}50`,
        backdropFilter: 'blur(8px)',
      };
    } else if (cardStyle === 'solid') {
      return {
        ...baseStyle,
        backgroundColor: `${buttonColor}40`,
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: `${buttonColor}30`,
      };
    } else if (cardStyle === 'outline') {
      return {
        ...baseStyle,
        backgroundColor: 'transparent',
        borderWidth: '2px',
        borderStyle: 'solid',
        borderColor: buttonColor,
      };
    } else if (cardStyle === 'shadow') {
      return {
        ...baseStyle,
        backgroundColor: `${buttonColor}25`,
        boxShadow: `0 4px 20px ${buttonColor}40`,
        border: 'none',
      };
    }
    
    return {
      ...baseStyle,
      backgroundColor: `${buttonColor}20`,
      borderWidth: '1px',
      borderStyle: 'solid',
      borderColor: `${buttonColor}50`,
    };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-4">
        <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center mb-4">
          <LinkIcon className="h-8 w-8 text-gray-600" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Bio Not Found</h1>
        <p className="text-gray-400 mb-6 text-center">This bio page doesn't exist or isn't published yet.</p>
        <a
          href="https://shoutout.us"
          className="px-6 py-3 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition-colors"
        >
          Create Your Own Bio
        </a>
      </div>
    );
  }

  const gradientDirection = bioSettings?.gradient_direction === 'to-b' ? '180deg' : '135deg';
  // Get name from talent profile, then temp_full_name (pre-onboarding), then user, then bio settings, then fallback
  const userName = (talentProfile as any)?.users?.full_name;
  const displayName = talentProfile?.full_name || talentProfile?.temp_full_name || userName || bioSettings?.display_name || 'Creator';
  const profileImage = talentProfile?.temp_avatar_url || bioSettings?.profile_image_url;

  return (
    <div 
      className="min-h-screen"
      style={{
        background: `linear-gradient(${gradientDirection}, ${bioSettings?.gradient_start || '#0a0a0a'}, ${bioSettings?.gradient_end || '#1a1a2e'})`
      }}
    >
      <div className="max-w-lg mx-auto px-4 py-8 min-h-screen flex flex-col relative">
        {/* ShoutOut Logo - Top Left Corner */}
        <a 
          href="https://shoutout.us" 
          target="_blank" 
          rel="noopener noreferrer"
          className="absolute top-[18px] left-4 z-10 opacity-45 hover:opacity-100 transition-opacity"
        >
          <img
            src={`${process.env.PUBLIC_URL}/shoutoutwhite.png`}
            alt="ShoutOut"
            className="h-5 w-auto"
          />
        </a>

        {/* Profile Header */}
        <div className="text-center mb-8">
          {/* Profile Image */}
          <div className="w-24 h-24 mx-auto mb-4 rounded-full overflow-hidden border-2 border-white/20 shadow-xl">
            {profileImage ? (
              <img 
                src={profileImage} 
                alt={displayName} 
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-3xl text-white font-bold">
                {displayName[0]}
              </div>
            )}
          </div>

          {/* Name - Always use full_name from talent profile */}
          <h1 className="text-2xl font-bold text-white mb-1 flex items-center justify-center gap-2">
            {displayName}
            {talentProfile?.is_verified && (
              <svg className="w-6 h-6 text-blue-400" viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307 4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12a4.49 4.49 0 01-1.549 3.397 4.491 4.491 0 01-1.307 3.497 4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.49 4.49 0 01-3.498-1.306 4.491 4.491 0 01-1.307-3.498A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497 4.49 4.49 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
              </svg>
            )}
          </h1>

          {/* Support/Donate Badges - Under Name */}
          {(() => {
            const donateLinks = links.filter(l => l.link_type === 'donate' && l.is_active);
            if (donateLinks.length === 0) return null;
            
            // SVG icons for each platform
            const getPlatformDisplay = (url: string, customTitle?: string): { icon: React.ReactNode; name: string; color: string } | null => {
              const lower = url.toLowerCase();
              
              if (lower.includes('venmo.com')) {
                return {
                  name: customTitle || 'Venmo',
                  color: '#3D95CE',
                  icon: (
                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="#3D95CE">
                      <path d="M19.5 2c.914 1.523 1.323 3.094 1.323 5.074 0 6.326-5.4 14.548-9.78 20.346H3.24L0 3.46l7.76-.714 1.64 13.13C10.84 13.79 12.92 8.82 12.92 5.39c0-1.84-.36-3.13-.84-4.13L19.5 2z"/>
                    </svg>
                  )
                };
              }
              
              if (lower.includes('paypal')) {
                return {
                  name: customTitle || 'PayPal',
                  color: '#00457C',
                  icon: (
                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="#00457C">
                      <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106zm14.146-14.42a3.35 3.35 0 0 0-.607-.541c-.013.076-.026.175-.041.254-.93 4.778-4.005 7.201-9.138 7.201h-2.19a.563.563 0 0 0-.556.479l-1.187 7.527h-.506l-.24 1.516a.56.56 0 0 0 .554.647h3.882c.46 0 .85-.334.922-.788.06-.26.76-4.852.816-5.09a.932.932 0 0 1 .923-.788h.58c3.76 0 6.705-1.528 7.565-5.946.36-1.847.174-3.388-.777-4.471z"/>
                    </svg>
                  )
                };
              }
              
              if (lower.includes('cash.app')) {
                return {
                  name: customTitle || 'Cash App',
                  color: '#00D54B',
                  icon: (
                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="#00D54B">
                      <path d="M3.5 3.5v17h17v-17h-17zm9.25 14.5h-1.5v-1.5h-2v-1.5h3.5v-1h-2a1.5 1.5 0 0 1-1.5-1.5v-2a1.5 1.5 0 0 1 1.5-1.5h.5V7.5h1.5V9h2v1.5h-3.5v1h2a1.5 1.5 0 0 1 1.5 1.5v2a1.5 1.5 0 0 1-1.5 1.5h-.5V18z"/>
                    </svg>
                  )
                };
              }
              
              if (lower.includes('ko-fi.com')) {
                return {
                  name: customTitle || 'Ko-fi',
                  color: '#FF5E5B',
                  icon: (
                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="#FF5E5B">
                      <path d="M23.881 8.948c-.773-4.085-4.859-4.593-4.859-4.593H.723c-.604 0-.679.798-.679.798s-.082 7.324-.022 11.822c.164 2.424 2.586 2.672 2.586 2.672s8.267-.023 11.966-.049c2.438-.426 2.683-2.566 2.658-3.734 4.352.24 7.422-2.831 6.649-6.916zm-11.062 3.511c-1.246 1.453-4.011 3.976-4.011 3.976s-.121.119-.31.023c-.076-.057-.108-.09-.108-.09-.443-.441-3.368-3.049-4.034-3.954-.709-.965-1.041-2.7-.091-3.71.951-1.01 3.005-1.086 4.363.407 0 0 1.565-1.782 3.468-.963 1.904.82 1.832 3.011.723 4.311zm6.173.478c-.928.116-1.682.028-1.682.028V7.284h1.77s1.971.551 1.971 2.638c0 1.913-.985 2.667-2.059 3.015z"/>
                    </svg>
                  )
                };
              }
              
              if (lower.includes('buymeacoffee.com')) {
                return {
                  name: customTitle || 'Buy Me a Coffee',
                  color: '#FFDD00',
                  icon: (
                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="#FFDD00">
                      <path d="M20.216 6.415l-.132-.666c-.119-.598-.388-1.163-1.001-1.379-.197-.069-.42-.098-.57-.241-.152-.143-.196-.366-.231-.572-.065-.378-.125-.756-.192-1.133-.057-.325-.102-.69-.25-.987-.195-.4-.597-.634-.996-.788a5.723 5.723 0 00-.626-.194c-1-.263-2.05-.36-3.077-.416a25.834 25.834 0 00-3.7.062c-.915.083-1.88.184-2.75.5-.318.116-.646.256-.888.501-.297.302-.393.77-.177 1.146.154.267.415.456.692.58.36.162.737.284 1.123.366 1.075.238 2.189.331 3.287.37 1.218.05 2.437.01 3.65-.118.299-.033.598-.073.896-.119.352-.054.578-.513.474-.834-.124-.383-.457-.531-.834-.473-.466.074-.96.108-1.382.146-1.177.08-2.358.082-3.536.006a22.228 22.228 0 01-1.157-.107c-.086-.01-.18-.025-.258-.036-.243-.036-.484-.08-.724-.13-.111-.027-.111-.185 0-.212h.005c.277-.06.557-.108.838-.147h.002c.131-.009.263-.032.394-.048a25.076 25.076 0 013.426-.12c.674.019 1.347.067 2.017.144l.228.031c.267.04.533.088.798.145.392.085.895.113 1.07.542.055.137.08.288.111.431l.319 1.484a.237.237 0 01-.199.284h-.003c-.037.006-.075.01-.112.015a36.704 36.704 0 01-4.743.295 37.059 37.059 0 01-4.699-.304c-.14-.017-.293-.042-.417-.06-.326-.048-.649-.108-.973-.161-.393-.065-.768-.032-1.123.161-.29.16-.527.404-.675.701-.154.316-.199.66-.267 1-.069.34-.176.707-.135 1.056.087.753.613 1.365 1.37 1.502a39.69 39.69 0 0011.343.376.483.483 0 01.535.53l-.071.697-1.018 9.907c-.041.41-.047.832-.125 1.237-.122.637-.553 1.028-1.182 1.171-.577.131-1.165.2-1.756.205-.656.004-1.31-.025-1.966-.022-.699.004-1.556-.06-2.095-.58-.475-.458-.54-1.174-.605-1.793l-.731-7.013-.322-3.094c-.037-.351-.286-.695-.678-.678-.336.015-.718.3-.678.679l.228 2.185.949 9.112c.147 1.344 1.174 2.068 2.446 2.272.742.12 1.503.144 2.257.156.966.016 1.942.053 2.892-.122 1.408-.258 2.465-1.198 2.616-2.657.34-3.332.683-6.663 1.024-9.995l.215-2.087a.484.484 0 01.39-.426c.402-.078.787-.212 1.074-.518.455-.488.546-1.124.385-1.766zm-1.478.772c-.145.137-.363.201-.578.233-2.416.359-4.866.54-7.308.46-1.748-.06-3.477-.254-5.207-.498-.17-.024-.353-.055-.47-.18-.22-.236-.111-.71-.054-.995.052-.26.152-.609.463-.646.484-.057 1.046.148 1.526.22.577.088 1.156.159 1.737.212 2.48.226 5.002.19 7.472-.14.45-.06.899-.13 1.345-.21.399-.072.84-.206 1.08.206.166.281.188.657.162.974a.544.544 0 01-.169.364z"/>
                    </svg>
                  )
                };
              }
              
              if (lower.includes('patreon.com')) {
                return {
                  name: customTitle || 'Patreon',
                  color: '#FF424D',
                  icon: (
                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="#FF424D">
                      <path d="M0 .48v23.04h4.22V.48zm15.385 0c-4.764 0-8.641 3.88-8.641 8.65 0 4.755 3.877 8.623 8.641 8.623 4.75 0 8.615-3.868 8.615-8.623C24 4.36 20.136.48 15.385.48z"/>
                    </svg>
                  )
                };
              }
              
              return null;
            };
            
            return (
              <div className="flex justify-center gap-2 mt-2 mb-1">
                {donateLinks.map((link) => {
                  const platform = getPlatformDisplay(link.url || '', link.title || undefined);
                  const displayTitle = link.title || (platform?.name) || 'Support';
                  
                  return (
                    <a
                      key={link.id}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => handleLinkClick(link)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full backdrop-blur-md transition-all hover:scale-105 border text-sm"
                      style={{
                        background: 'rgba(255, 255, 255, 0.1)',
                        borderColor: platform ? platform.color + '40' : 'rgba(255, 255, 255, 0.2)',
                      }}
                    >
                      {platform?.icon}
                      <span className="text-white/90 text-xs font-medium">{displayTitle}</span>
                    </a>
                  );
                })}
              </div>
            );
          })()}

          {/* One-liner */}
          {bioSettings?.one_liner && (
            <p className="text-gray-300 mt-3 max-w-sm mx-auto">
              {bioSettings.one_liner}
            </p>
          )}

          {/* Follow/Newsletter Signup - Full width like other cards */}
          {bioSettings?.show_newsletter !== false && (
            <div className="mt-6 w-full">
              {/* Already subscribed message */}
              {isFollowing ? (
                <div className="text-center py-3 space-y-1">
                  <p className="text-white/60 text-sm">
                    ✓ You're subscribed to {displayName.split(' ')[0]}
                  </p>
                  <p className="text-white/40 text-xs">
                    You now have exclusive access to {displayName}'s updates.
                  </p>
                </div>
              ) : currentUser ? (
                /* Logged in user - show subscribe button */
                <div className="space-y-2">
                  <p className="text-white/40 text-xs text-center">
                    Logged in as {currentUser.email || currentUser.phone}
                  </p>
                  <button
                    onClick={handleFollowSignup}
                    disabled={subscribing}
                    className="w-full py-3 rounded-full font-medium transition-all disabled:opacity-50 text-sm flex items-center justify-center gap-2 overflow-hidden"
                    style={{ 
                      backgroundColor: bioSettings?.button_color || '#3b82f6',
                      color: getContrastTextColor(bioSettings?.button_color || '#3b82f6')
                    }}
                  >
                    {subscribing ? '...' : (
                      <span className="relative h-5 flex items-center justify-center" style={{ minWidth: '140px' }}>
                        <span 
                          className="absolute inset-0 flex items-center justify-center transition-all duration-500 ease-in-out"
                          style={{
                            transform: buttonTextIndex === 0 ? 'translateY(0)' : 'translateY(-100%)',
                            opacity: buttonTextIndex === 0 ? 1 : 0,
                          }}
                        >
                          Stay connected
                        </span>
                        <span 
                          className="absolute inset-0 flex items-center justify-center transition-all duration-500 ease-in-out"
                          style={{
                            transform: buttonTextIndex === 1 ? 'translateY(0)' : 'translateY(100%)',
                            opacity: buttonTextIndex === 1 ? 1 : 0,
                          }}
                        >
                          with {displayName.split(' ')[0]}
                        </span>
                      </span>
                    )}
                    {!subscribing && (
                      <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    )}
                  </button>
                </div>
              ) : (
                /* Not logged in - email/phone form with button inside field */
                <form onSubmit={handleFollowSignup} className="space-y-3">
                  {/* Email field with button inside */}
                  {!showPhoneField && (
                    <div className="relative">
                      <input
                        type="email"
                        value={newsletterEmail}
                        onChange={(e) => setNewsletterEmail(e.target.value)}
                        placeholder="your@email.com"
                        required
                        className="w-full bg-white/10 border border-white/20 rounded-full pl-4 pr-44 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-white/40 text-sm"
                      />
                      <button
                        type="submit"
                        disabled={subscribing}
                        className="absolute right-1 top-1 bottom-1 px-4 rounded-full font-medium transition-colors disabled:opacity-50 text-sm whitespace-nowrap flex items-center justify-center gap-1 overflow-hidden"
                        style={{ 
                          backgroundColor: bioSettings?.button_color || '#3b82f6',
                          color: getContrastTextColor(bioSettings?.button_color || '#3b82f6'),
                          minWidth: '140px'
                        }}
                      >
                        {subscribing ? '...' : (
                          <span className="relative h-5 flex items-center justify-center" style={{ minWidth: '110px' }}>
                            <span 
                              className="absolute inset-0 flex items-center justify-center transition-all duration-500 ease-in-out"
                              style={{
                                transform: buttonTextIndex === 0 ? 'translateY(0)' : 'translateY(-100%)',
                                opacity: buttonTextIndex === 0 ? 1 : 0,
                              }}
                            >
                              Stay connected
                            </span>
                            <span 
                              className="absolute inset-0 flex items-center justify-center transition-all duration-500 ease-in-out"
                              style={{
                                transform: buttonTextIndex === 1 ? 'translateY(0)' : 'translateY(100%)',
                                opacity: buttonTextIndex === 1 ? 1 : 0,
                              }}
                            >
                              with {displayName.split(' ')[0]}
                            </span>
                          </span>
                        )}
                        {!subscribing && (
                          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                          </svg>
                        )}
                      </button>
                    </div>
                  )}
                  {/* Phone field with button inside - shown after email if new user */}
                  {showPhoneField && (
                    <div className="relative">
                      <input
                        type="tel"
                        value={newsletterPhone}
                        onChange={(e) => setNewsletterPhone(formatPhoneNumber(e.target.value))}
                        placeholder="(555) 555-5555"
                        className="w-full bg-white/10 border border-white/20 rounded-full pl-4 pr-40 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-white/40 text-sm"
                      />
                      <button
                        type="submit"
                        disabled={subscribing}
                        className="absolute right-1 top-1 bottom-1 px-4 rounded-full font-medium transition-colors disabled:opacity-50 text-sm whitespace-nowrap flex items-center gap-1"
                        style={{ 
                          backgroundColor: bioSettings?.button_color || '#3b82f6',
                          color: getContrastTextColor(bioSettings?.button_color || '#3b82f6')
                        }}
                      >
                        {subscribing ? '...' : 'Confirm Access'}
                        {!subscribing && (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                    </div>
                  )}
                </form>
              )}
            </div>
          )}
        </div>

        {/* Links */}
        <div className="flex-1 space-y-4">
          {/* Stream Cards - Rendered in order based on stream_card_order setting */}
          {(() => {
            const defaultOrder = ['rumble', 'youtube', 'podcast'];
            const cardOrder = bioSettings?.stream_card_order || defaultOrder;
            // Include any cards not in the order at the end
            const fullOrder = [...cardOrder, ...defaultOrder.filter(c => !cardOrder.includes(c))];
            
            return fullOrder.map((cardType) => {
              // Rumble Card
              if (cardType === 'rumble' && talentProfile?.rumble_handle && bioSettings && bioSettings.show_rumble_card !== false) {
                return (
                  <a
                    key="rumble"
                    href={rumbleData?.url || `https://rumble.com/${talentProfile.rumble_type || 'c'}/${talentProfile.rumble_handle.replace(/^@/, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-2xl overflow-hidden border border-green-500/30 hover:border-green-500/50 transition-all duration-300 hover:scale-[1.02]">
                      <div className="flex items-stretch">
                        <div className="w-44 h-[120px] flex-shrink-0 relative bg-black/20">
                          {rumbleData?.thumbnail ? (
                            <img src={rumbleData.thumbnail} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-green-600 to-emerald-600">
                              <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-white/80">
                                <path d="M14.4528 13.5458c0.8064 -0.6542 0.9297 -1.8381 0.2756 -2.6445a1.8802 1.8802 0 0 0 -0.2756 -0.2756 21.2127 21.2127 0 0 0 -4.3121 -2.776c-1.066 -0.51 -2.256 0.2 -2.4261 1.414a23.5226 23.5226 0 0 0 -0.14 5.5021c0.116 1.23 1.292 1.964 2.372 1.492a19.6285 19.6285 0 0 0 4.5062 -2.704v-0.008zm6.9322 -5.4002c2.0335 2.228 2.0396 5.637 0.014 7.8723A26.1487 26.1487 0 0 1 8.2946 23.846c-2.6848 0.6713 -5.4168 -0.914 -6.1662 -3.5781 -1.524 -5.2002 -1.3 -11.0803 0.17 -16.3045 0.772 -2.744 3.3521 -4.4661 6.0102 -3.832 4.9242 1.174 9.5443 4.196 13.0764 8.0121v0.002z"/>
                              </svg>
                            </div>
                          )}
                          {rumbleData?.isLive && (
                            <div className="absolute top-1 right-1 bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
                              <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>
                              LIVE
                            </div>
                          )}
                        </div>
                        <div className="flex-1 p-3 flex flex-col justify-start">
                          <div className="flex items-center gap-2 mb-1">
                            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-green-400">
                              <path d="M14.4528 13.5458c0.8064 -0.6542 0.9297 -1.8381 0.2756 -2.6445a1.8802 1.8802 0 0 0 -0.2756 -0.2756 21.2127 21.2127 0 0 0 -4.3121 -2.776c-1.066 -0.51 -2.256 0.2 -2.4261 1.414a23.5226 23.5226 0 0 0 -0.14 5.5021c0.116 1.23 1.292 1.964 2.372 1.492a19.6285 19.6285 0 0 0 4.5062 -2.704v-0.008zm6.9322 -5.4002c2.0335 2.228 2.0396 5.637 0.014 7.8723A26.1487 26.1487 0 0 1 8.2946 23.846c-2.6848 0.6713 -5.4168 -0.914 -6.1662 -3.5781 -1.524 -5.2002 -1.3 -11.0803 0.17 -16.3045 0.772 -2.744 3.3521 -4.4661 6.0102 -3.832 4.9242 1.174 9.5443 4.196 13.0764 8.0121v0.002z"/>
                            </svg>
                            <span className="text-green-400 text-xs font-medium">Rumble</span>
                          </div>
                          <h3 className="text-white font-medium text-sm line-clamp-2">{rumbleData?.title || 'Watch on Rumble'}</h3>
                          {rumbleData?.views && rumbleData.views > 0 && (
                            <p className="text-gray-400 text-xs mt-0.5">{rumbleData.views.toLocaleString()} views</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </a>
                );
              }
              
              // YouTube Card
              if (cardType === 'youtube' && talentProfile?.youtube_handle && bioSettings && bioSettings.show_youtube_card !== false) {
                return (
                  <a
                    key="youtube"
                    href={youtubeData?.url || `https://youtube.com/@${talentProfile.youtube_handle.replace(/^@/, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    <div className="bg-gradient-to-r from-red-500/20 to-rose-500/20 rounded-2xl overflow-hidden border border-red-500/30 hover:border-red-500/50 transition-all duration-300 hover:scale-[1.02]">
                      <div className="flex items-stretch">
                        <div className="w-44 h-[120px] flex-shrink-0 relative bg-black/20">
                          {youtubeData?.thumbnail ? (
                            <img src={youtubeData.thumbnail} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-red-600 to-rose-600">
                              <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-white/80">
                                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                              </svg>
                            </div>
                          )}
                          {youtubeData?.isLive && (
                            <div className="absolute top-1 right-1 bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
                              <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>
                              LIVE
                            </div>
                          )}
                        </div>
                        <div className="flex-1 p-3 flex flex-col justify-start">
                          <div className="flex items-center gap-2 mb-1">
                            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-red-400">
                              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                            </svg>
                            <span className="text-red-400 text-xs font-medium">YouTube</span>
                          </div>
                          <h3 className="text-white font-medium text-sm line-clamp-2">{youtubeData?.title || 'Watch on YouTube'}</h3>
                          {youtubeData?.views && youtubeData.views > 0 && (
                            <p className="text-gray-400 text-xs mt-0.5">
                              {youtubeData.isLive && youtubeData.liveViewers 
                                ? `${youtubeData.liveViewers.toLocaleString()} watching`
                                : `${youtubeData.views.toLocaleString()} views`
                              }
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </a>
                );
              }
              
              // Podcast Card - show immediately if podcast RSS configured, load data async
              if (cardType === 'podcast' && talentProfile?.podcast_rss_url) {
                console.log('Rendering podcast card:', { podcastData, rss_url: talentProfile.podcast_rss_url });
                
                // Show card immediately with loading state if data isn't ready
                const isLoading = !podcastData;
                const displayData = podcastData || {
                  title: 'Loading latest episode...',
                  thumbnail: '',
                  url: talentProfile.podcast_rss_url,
                  podcastName: talentProfile.podcast_name || 'Podcast',
                  audioUrl: '',
                  views: undefined,
                  pubDate: undefined,
                  duration: undefined,
                  description: undefined,
                  feedUrl: talentProfile.podcast_rss_url,
                };
                
                const PodcastCard = () => {
                  return (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        setShowPodcastModal(true);
                      }}
                      className="w-full text-left"
                    >
                      <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-xl overflow-hidden border border-purple-500/30 hover:border-purple-500/50 transition-all duration-300">
                        <div className="flex items-center">
                          {/* Thumbnail - flush to edge */}
                          <div className="w-[50px] h-[50px] flex-shrink-0 relative bg-black/20">
                          {displayData.thumbnail ? (
                            <img src={displayData.thumbnail} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-600 to-pink-600">
                              <svg viewBox="0 0 24 24" fill="currentColor" className={`w-5 h-5 text-white/80 ${isLoading ? 'animate-pulse' : ''}`}>
                                <path d="M12 1c-6.1 0-11 4.9-11 11s4.9 11 11 11 11-4.9 11-11S18.1 1 12 1zm0 20c-5 0-9-4-9-9s4-9 9-9 9 4 9 9-4 9-9 9z"/>
                                <circle cx="12" cy="12" r="2"/>
                              </svg>
                            </div>
                          )}
                        </div>
                        
                        {/* Content - with padding */}
                        <div className="flex-1 min-w-0 py-2 px-3">
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 text-purple-400 flex-shrink-0">
                                <path d="M12 1c-6.1 0-11 4.9-11 11s4.9 11 11 11 11-4.9 11-11S18.1 1 12 1zm0 20c-5 0-9-4-9-9s4-9 9-9 9 4 9 9-4 9-9 9z"/>
                                <circle cx="12" cy="12" r="2"/>
                              </svg>
                              <p className="text-purple-400 text-[10px] font-medium uppercase tracking-wide truncate">{displayData.podcastName}</p>
                            </div>
                            {displayData.views && (
                              <span className="text-gray-400 text-[10px] whitespace-nowrap flex-shrink-0">{displayData.views}</span>
                            )}
                          </div>
                          <h3 className={`text-white font-medium text-xs line-clamp-1 ${isLoading ? 'animate-pulse' : ''}`}>
                            {displayData.title}
                          </h3>
                        </div>
                      </div>
                    </div>
                    </button>
                  );
                };
                
                return <PodcastCard key="podcast" />;
              }
              
              return null;
            });
          })()}


          {/* Featured Video Card */}
          {links.filter(l => l.link_type === 'video').map((link) => {
            if (!link.video_url) return null;
            
            return (
              <div key={link.id} className="rounded-2xl overflow-hidden border border-white/20">
                <video
                  autoPlay
                  muted
                  loop
                  playsInline
                  onClick={(e) => {
                    const video = e.currentTarget;
                    if (video.muted) {
                      video.muted = false;
                      toast.success('Audio enabled');
                    } else {
                      video.muted = true;
                      toast.success('Audio muted');
                    }
                  }}
                  className="w-full cursor-pointer"
                  style={{ maxHeight: '400px', objectFit: 'cover' }}
                >
                  <source src={link.video_url} type="video/mp4" />
                  <source src={link.video_url} type="video/webm" />
                  Your browser does not support the video tag.
                </video>
              </div>
            );
          })}

          {/* Regular Links */}
          {links.filter(l => l.link_type === 'basic').map((link) => {
            // Featured links get a gradient background matching their color scheme
            const isFeatured = link.is_featured;
            const featuredStyle = isFeatured ? {
              background: `linear-gradient(135deg, ${bioSettings?.button_color || '#3b82f6'}40, ${bioSettings?.gradient_end || '#1a1a2e'}60)`,
              border: `2px solid ${bioSettings?.button_color || '#3b82f6'}`,
              boxShadow: `0 0 20px ${bioSettings?.button_color || '#3b82f6'}30`,
            } : {};
            
            const linkFormat = link.link_format || 'thin';
            
            // Square format - image only, no title
            if (linkFormat === 'square') {
              return (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => handleLinkClick(link)}
                  className={`${getRadiusClass()} hover:scale-[1.02] active:scale-[0.98] overflow-hidden block`}
                  style={{
                    ...getButtonStyle(),
                    ...featuredStyle,
                    padding: 0,
                  }}
                >
                  <div className="aspect-square w-full relative">
                    {link.thumbnail_url ? (
                      <img src={link.thumbnail_url} alt={link.title || ''} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-white/10">
                        <ArrowTopRightOnSquareIcon className="h-8 w-8 text-white/40" />
                      </div>
                    )}
                  </div>
                </a>
              );
            }
            
            // Tall format - image flush left, text on right (horizontal card)
            if (linkFormat === 'tall') {
              return (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => handleLinkClick(link)}
                  className={`${getRadiusClass()} hover:scale-[1.02] active:scale-[0.98] overflow-hidden`}
                  style={{
                    ...getButtonStyle(),
                    ...featuredStyle,
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'stretch',
                    padding: 0,
                  }}
                >
                  {link.thumbnail_url && (
                    <div className="w-24 flex-shrink-0" style={{ minHeight: '96px' }}>
                      <img src={link.thumbnail_url} alt="" className="w-full h-full object-cover rounded-l-xl" />
                    </div>
                  )}
                  <div className="flex-1 flex items-center justify-between px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <span className="text-white font-medium text-left block">{link.title}</span>
                      {link.subtitle && (
                        <span className="text-white/60 text-sm text-left block mt-0.5">{link.subtitle}</span>
                      )}
                    </div>
                    <ArrowTopRightOnSquareIcon className="h-4 w-4 text-white/60 flex-shrink-0 ml-3" />
                  </div>
                </a>
              );
            }
            
            // Default thin format
            return (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => handleLinkClick(link)}
                className={`${getRadiusClass()} hover:scale-[1.02] active:scale-[0.98] overflow-hidden`}
                style={{
                  ...getButtonStyle(),
                  ...featuredStyle,
                  padding: 0, // Remove padding for flush image
                }}
              >
                <div className="flex items-center">
                  {link.thumbnail_url ? (
                    <img src={link.thumbnail_url} alt="" className="w-14 h-14 object-cover flex-shrink-0" />
                  ) : link.icon_url ? (
                    <div className="w-14 h-14 flex items-center justify-center flex-shrink-0">
                      <img src={link.icon_url} alt="" className="w-6 h-6" />
                    </div>
                  ) : null}
                  <div className={`flex-1 flex items-center justify-between px-4 py-4 ${!link.thumbnail_url && !link.icon_url ? 'pl-4' : ''}`}>
                    <span className="text-white font-medium text-left">{link.title}</span>
                    <ArrowTopRightOnSquareIcon className="h-4 w-4 text-white/60 flex-shrink-0 ml-2" />
                  </div>
                </div>
              </a>
            );
          })}

          {/* Grid Links - Support different formats and layouts */}
          {links.filter(l => l.link_type === 'grid').length > 0 && (() => {
            const gridLinks = links.filter(l => l.link_type === 'grid');
            // Determine grid columns based on the grid_columns value (2=2 columns, 4=2x2)
            const gridCols = gridLinks[0]?.grid_columns || 2;
            const gridClass = gridCols >= 3 ? 'grid-cols-3' : 'grid-cols-2';
            const linkFormat = gridLinks[0]?.link_format || 'square';
            
            // Square format uses no gap for flush edges
            const gapClass = linkFormat === 'square' ? 'gap-0' : 'gap-3';
            
            return (
              <div className={`grid ${gridClass} ${gapClass} overflow-hidden rounded-xl`}>
                {gridLinks.map((link) => {
                  const format = link.link_format || 'square';
                  
                  // Square format - image only, no title, flush edges
                  if (format === 'square') {
                    return (
                      <a
                        key={link.id}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => handleLinkClick(link)}
                        className="aspect-square overflow-hidden relative group"
                      >
                        {link.thumbnail_url ? (
                          <img 
                            src={link.thumbnail_url} 
                            alt={link.title || ''} 
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-white/10">
                            <Squares2X2Icon className="h-8 w-8 text-white/40" />
                          </div>
                        )}
                      </a>
                    );
                  }
                  
                  // Tall format - image flush left, text on right (horizontal card)
                  if (format === 'tall') {
                    return (
                      <a
                        key={link.id}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => handleLinkClick(link)}
                        className={`${getRadiusClass()} overflow-hidden group col-span-2`}
                        style={{
                          ...getButtonStyle(),
                          display: 'flex',
                          flexDirection: 'row',
                          alignItems: 'stretch',
                          padding: 0,
                        }}
                      >
                        {link.thumbnail_url ? (
                          <div className="w-24 flex-shrink-0" style={{ minHeight: '96px' }}>
                            <img 
                              src={link.thumbnail_url} 
                              alt={link.title || ''} 
                              className="w-full h-full object-cover rounded-l-xl transition-transform duration-300 group-hover:scale-105"
                            />
                          </div>
                        ) : (
                          <div className="w-24 flex-shrink-0 flex items-center justify-center bg-white/10" style={{ minHeight: '96px' }}>
                            <Squares2X2Icon className="h-8 w-8 text-white/40" />
                          </div>
                        )}
                        <div className="flex-1 flex items-center justify-between px-4 py-3">
                          <div className="flex-1 min-w-0">
                            <span className="text-white font-medium text-left block">{link.title}</span>
                          </div>
                          <ArrowTopRightOnSquareIcon className="h-4 w-4 text-white/60 flex-shrink-0 ml-3" />
                        </div>
                      </a>
                    );
                  }
                  
                  // Thin format - compact with image and title
                  return (
                    <a
                      key={link.id}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => handleLinkClick(link)}
                      className={`${getRadiusClass()} overflow-hidden relative group`}
                      style={getButtonStyle()}
                    >
                      {link.thumbnail_url ? (
                        <>
                          <img 
                            src={link.thumbnail_url} 
                            alt={link.title || ''} 
                            className="w-full aspect-square object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end p-3">
                            <span className="text-white font-medium text-sm">{link.title}</span>
                          </div>
                        </>
                      ) : (
                        <div className="w-full aspect-square flex flex-col items-center justify-center p-4">
                          <Squares2X2Icon className="h-8 w-8 text-white/60 mb-2" />
                          <span className="text-white font-medium text-sm text-center">{link.title}</span>
                        </div>
                      )}
                    </a>
                  );
                })}
              </div>
            );
          })()}

          {/* Sponsor Links */}
          {links.filter(l => l.link_type === 'sponsor').map((link) => (
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => handleLinkClick(link)}
              className={`${getRadiusClass()} hover:scale-[1.02] active:scale-[0.98]`}
              style={{
                ...getButtonStyle(),
                background: 'linear-gradient(to right, rgba(234, 179, 8, 0.2), rgba(249, 115, 22, 0.2))',
                borderColor: 'rgba(234, 179, 8, 0.3)',
              }}
            >
              <div className="flex items-center justify-center">
                <span className="text-white font-medium">{link.title || 'Become a Sponsor'}</span>
              </div>
            </a>
          ))}

          {/* Collab Service Cards */}
          {serviceOfferings.map((service) => {
            // Get platforms included in this service
            const servicePlatforms = service.platforms || ['instagram'];
            const platformLabel = servicePlatforms.length === 1 
              ? `${servicePlatforms[0].charAt(0).toUpperCase() + servicePlatforms[0].slice(1)} Collab`
              : `Collaborate with me`;
            
            // Use total_followers from the service directly
            const totalFollowers = service.total_followers || 0;
            
            // Debug logging
            console.log('Collab card debug:', {
              servicePlatforms,
              totalFollowers,
              serviceId: service.id
            });
            const formatFollowers = (count: number): string => {
              if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
              if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
              return count.toString();
            };
            
            return (
              <button
                key={service.id}
                onClick={() => {
                  if (service.service_type === 'sponsorship') {
                    setShowSponsorModal(service);
                  } else {
                    setShowCollabModal(service);
                  }
                }}
                className="w-full text-left mt-4"
              >
                <div className={`rounded-2xl overflow-hidden border transition-all duration-300 hover:scale-[1.02] ${
                  service.service_type === 'sponsorship'
                    ? 'bg-gradient-to-r from-green-500/20 to-emerald-500/20 border-green-500/30 hover:border-green-500/50'
                    : 'bg-gradient-to-r from-pink-500/20 to-purple-500/20 border-pink-500/30 hover:border-pink-500/50'
                }`}>
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      {service.service_type === 'sponsorship' ? (
                        <>
                          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center flex-shrink-0">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-4 h-4 text-white">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                          </div>
                          <span className="text-green-400 text-xs font-medium">Opportunities</span>
                        </>
                      ) : (
                        <>
                          {/* Show icons for all platforms in this service */}
                          <div className="flex -space-x-1">
                            {servicePlatforms.slice(0, 3).map((platformId) => {
                              const platform = SOCIAL_PLATFORMS[platformId];
                              if (!platform) return null;
                              return (
                                <div key={platformId} className="w-7 h-7 rounded-lg bg-gradient-to-br from-pink-500 to-purple-500 flex items-center justify-center flex-shrink-0 border-2 border-[#1a1a1a]">
                                  <span className="text-white [&>svg]:w-3.5 [&>svg]:h-3.5">{platform.icon}</span>
                                </div>
                              );
                            })}
                            {servicePlatforms.length > 3 && (
                              <div className="w-7 h-7 rounded-lg bg-pink-500/50 flex items-center justify-center flex-shrink-0 border-2 border-[#1a1a1a]">
                                <span className="text-white text-xs font-bold">+{servicePlatforms.length - 3}</span>
                              </div>
                            )}
                          </div>
                          <span className="text-pink-400 text-xs font-medium">{platformLabel}</span>
                          {/* Show total followers inline with platform label - only if set */}
                          {totalFollowers > 0 && (
                            <>
                              <span className="text-gray-400 text-xs">•</span>
                              <span className="text-pink-400 text-xs font-medium">
                                {formatFollowers(totalFollowers)} followers
                              </span>
                            </>
                          )}
                        </>
                      )}
                    </div>
                    {service.title && (
                      <h3 className="text-white font-semibold text-sm">
                        {service.title}
                      </h3>
                    )}
                  </div>
                </div>
              </button>
            );
          })}

          {/* ShoutOut Card - In services section */}
          {bioSettings && (
            <a
              href={`https://shoutout.us/${talentProfile?.username || talentProfile?.id}?utm=fans`}
              target="_blank"
              rel="noopener noreferrer"
              className="block mt-4"
            >
              <div className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-2xl overflow-hidden border border-blue-500/30 hover:border-blue-500/50 transition-all duration-300 hover:scale-[1.02]">
                <div className="flex items-stretch">
                  <div className="w-14 flex-shrink-0">
                    {profileImage ? (
                      <img src={profileImage} alt={displayName} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-xl font-bold">
                        {displayName[0]}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 p-4 flex flex-col justify-center">
                      {randomReview ? (
                        <h3 className="text-white font-semibold text-sm mb-1">
                          Get a personalized video from {displayName}
                        </h3>
                      ) : (
                        <>
                          <h3 className="text-blue-400 font-semibold text-sm mb-0.5">
                            Get a personalized video ShoutOut
                          </h3>
                          <p className="text-white text-sm font-medium">
                            From {talentProfile?.full_name || displayName}
                          </p>
                        </>
                      )}
                      
                      {randomReview && (
                        <div className="mt-2 pt-2 border-t border-white/10">
                          <div className="flex items-center gap-1 mb-0.5">
                            {[...Array(5)].map((_, i) => (
                              i < randomReview.rating ? (
                                <StarSolidIcon key={i} className="h-3 w-3 text-yellow-400" />
                              ) : (
                                <StarIcon key={i} className="h-3 w-3 text-gray-600" />
                              )
                            ))}
                          </div>
                          {randomReview.comment && (
                            <p className="text-gray-300 text-xs line-clamp-1">
                              "{randomReview.comment.split('\n')[0]}"
                            </p>
                          )}
                          {randomReview.users?.full_name && (
                            <p className="text-gray-500 text-[10px] mt-0.5">
                              — {randomReview.users.full_name}
                            </p>
                          )}
                        </div>
                      )}
                  </div>
                </div>
              </div>
            </a>
          )}

          {/* Next Upcoming Event - Only show one */}
          {(() => {
            // Get the next upcoming event (soonest date, or first if no dates)
            const nextEvent = [...bioEvents]
              .filter(e => e.is_active)
              .sort((a, b) => {
                if (!a.event_date) return 1;
                if (!b.event_date) return -1;
                return new Date(a.event_date).getTime() - new Date(b.event_date).getTime();
              })[0];
            
            if (!nextEvent) return null;
            
            const eventDateFormatted = nextEvent.event_date 
              ? new Date(nextEvent.event_date).toLocaleDateString('en-US', { 
                  weekday: 'short', 
                  month: 'short', 
                  day: 'numeric' 
                })
              : null;
            
            return (
              <a
                href={nextEvent.registration_url || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="block mt-4"
              >
                <div 
                  className="rounded-2xl overflow-hidden border border-orange-500/30 hover:border-orange-500/50 transition-all duration-300 hover:scale-[1.02]"
                  style={{
                    background: `linear-gradient(135deg, rgba(249, 115, 22, 0.2), rgba(245, 158, 11, 0.2))`,
                  }}
                >
                  <div className="flex items-stretch">
                    {/* Event Image */}
                    <div className="w-24 flex-shrink-0 relative bg-black/20">
                      {nextEvent.image_url ? (
                        <img 
                          src={nextEvent.image_url} 
                          alt={nextEvent.title} 
                          className="w-full h-full object-cover"
                          style={{ minHeight: '96px' }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-orange-500 to-amber-500" style={{ minHeight: '96px' }}>
                          <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-white">
                            <path fillRule="evenodd" d="M6.75 2.25A.75.75 0 017.5 3v1.5h9V3A.75.75 0 0118 3v1.5h.75a3 3 0 013 3v11.25a3 3 0 01-3 3H5.25a3 3 0 01-3-3V7.5a3 3 0 013-3H6V3a.75.75 0 01.75-.75zm13.5 9a1.5 1.5 0 00-1.5-1.5H5.25a1.5 1.5 0 00-1.5 1.5v7.5a1.5 1.5 0 001.5 1.5h13.5a1.5 1.5 0 001.5-1.5v-7.5z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                    </div>
                    
                    {/* Event Details */}
                    <div className="flex-1 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-white font-semibold text-sm leading-tight">{nextEvent.title}</h3>
                          {(eventDateFormatted || nextEvent.event_time || nextEvent.location) && (
                            <p className="text-orange-300/80 text-xs mt-1">
                              {eventDateFormatted && <span>📅 {eventDateFormatted}</span>}
                              {nextEvent.event_time && <span> • {nextEvent.event_time}</span>}
                              {nextEvent.location && <span className="block mt-0.5">📍 {nextEvent.location}</span>}
                            </p>
                          )}
                          {nextEvent.description && (
                            <p className="text-gray-400 text-xs mt-1 line-clamp-2">{nextEvent.description}</p>
                          )}
                        </div>
                        <span 
                          className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium"
                          style={{
                            backgroundColor: bioSettings?.button_color || '#f97316',
                            color: getContrastTextColor(bioSettings?.button_color || '#f97316')
                          }}
                        >
                          {nextEvent.button_text || 'Get Tickets'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </a>
            );
          })()}

          {/* Affiliate Links Carousel */}
          {(() => {
            const affiliateLinks = links.filter(l => l.link_type === 'affiliate' && l.is_active);
            if (affiliateLinks.length === 0) return null;
            
            const sectionTitle = bioSettings?.affiliate_section_title || 'Back the Brands That Support Me';
            
            return (
              <div className="mt-6">
                <h3 className="text-white font-semibold text-sm mb-3 text-center">{sectionTitle}</h3>
                <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide">
                  {affiliateLinks.map((link) => (
                    <a
                      key={link.id}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => handleLinkClick(link)}
                      className="flex-shrink-0 w-32 snap-center"
                    >
                      <div className="relative rounded-2xl overflow-hidden border-2 border-white/20 shadow-lg hover:border-white/40 hover:scale-105 transition-all duration-300">
                        {/* Brand Image */}
                        <div className="aspect-square bg-white/10">
                          {link.thumbnail_url ? (
                            <img src={link.thumbnail_url} alt={link.company_name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-white/20 to-white/5">
                              <span className="text-white/40 text-3xl font-bold">{link.company_name?.charAt(0)}</span>
                            </div>
                          )}
                          
                          {/* Discount Badge - Top Right */}
                          {(link.discount_amount || link.discount_code) && (
                            <div className="absolute top-1.5 right-1.5 bg-red-500/70 backdrop-blur-sm text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md shadow-lg">
                              {link.discount_amount && <div className="leading-tight">{link.discount_amount}</div>}
                              {link.discount_code && <div className="text-[8px] leading-tight">{link.discount_code}</div>}
                            </div>
                          )}
                        </div>
                        
                        {/* Company Name Banner - Bottom */}
                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-sm py-2 px-2">
                          <p className="text-white text-[10px] font-semibold text-center uppercase tracking-wide truncate">
                            {link.company_name}
                          </p>
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Social Icons */}
        {socialAccounts.length > 0 && (
          <div className="mt-8 flex justify-center gap-4 flex-wrap">
            {socialAccounts.map((social) => {
              const platform = SOCIAL_PLATFORMS[social.platform];
              if (!platform) return null;
              
              return (
                <a
                  key={social.id}
                  href={`${platform.baseUrl}${social.handle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-11 h-11 rounded-full flex items-center justify-center transition-all hover:scale-110"
                  style={{
                    backgroundColor: `${bioSettings?.button_color || '#3b82f6'}30`,
                    border: `1px solid ${bioSettings?.button_color || '#3b82f6'}50`,
                    color: bioSettings?.button_color || '#3b82f6',
                  }}
                  title={platform.name}
                >
                  {platform.icon}
                </a>
              );
            })}
          </div>
        )}

        {/* Footer - White text with opacity for visibility on any background */}
        <div className="mt-8 text-center space-y-3">
          {/* Terms of Service for Newsletter */}
          {bioSettings?.show_newsletter !== false && !isFollowing && (
            <p className="text-white/25 text-[10px] max-w-xs mx-auto leading-relaxed">
              By connecting, you agree to receive updates from {displayName.split(' ')[0]} and ShoutOut, LLC. We do not share or sell your data.
            </p>
          )}
          <a 
            href="https://shoutout.us/creators"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 opacity-40 hover:opacity-60 transition-opacity"
          >
            <span className="text-white/40 text-sm">Powered by</span>
            <img
              src={`${process.env.PUBLIC_URL}/shoutoutwhite.png`}
              alt="ShoutOut"
              className="h-5 w-auto"
            />
          </a>
        </div>
      </div>

      {/* Collab Service Modal */}
      {showCollabModal && (
        <CollabModal
          service={showCollabModal}
          talentProfile={talentProfile}
          socialAccounts={socialAccounts}
          onClose={() => setShowCollabModal(null)}
        />
      )}

      {/* Sponsor Inquiry Modal */}
      {showSponsorModal && talentProfile && (
        <SponsorInquiryModal
          service={showSponsorModal}
          talentProfile={talentProfile}
          onClose={() => setShowSponsorModal(null)}
        />
      )}

      {/* Podcast Modal */}
      {showPodcastModal && podcastData && bioSettings && (
        <PodcastModal
          podcast={podcastData}
          bioSettings={bioSettings}
          onClose={() => setShowPodcastModal(false)}
        />
      )}
    </div>
  );
};

// Collab Service Modal Component
const CollabModal: React.FC<{
  service: ServiceOffering;
  talentProfile: TalentProfile | null;
  socialAccounts: SocialAccount[];
  onClose: () => void;
}> = ({ service, talentProfile, socialAccounts, onClose }) => {
  const userName = (talentProfile as any)?.users?.full_name;
  const displayName = talentProfile?.full_name || talentProfile?.temp_full_name || userName || 'Creator';
  
  // Filter to only show platforms included in this service
  const servicePlatforms = service.platforms || ['instagram'];
  const filteredSocials = socialAccounts.filter(s => servicePlatforms.includes(s.platform));
  
  // Platform label
  const platformLabel = servicePlatforms.length === 1 
    ? `${servicePlatforms[0].charAt(0).toUpperCase() + servicePlatforms[0].slice(1)} Collab`
    : `Collaborate with me`;

  const handleStartRequest = () => {
    // Navigate to the collab order page
    const orderUrl = `/collab/${talentProfile?.username || talentProfile?.id}/${service.id}`;
    window.location.href = orderUrl;
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1a1a] border border-white/20 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="relative p-6 pb-4 border-b border-white/10">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          
          <div className="flex items-center gap-3 mb-4">
            {/* Show icons for all platforms in this service */}
            <div className="flex -space-x-2">
              {servicePlatforms.slice(0, 3).map((platformId) => {
                const platform = SOCIAL_PLATFORMS[platformId];
                if (!platform) return null;
                return (
                  <div key={platformId} className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-500 to-purple-500 flex items-center justify-center flex-shrink-0 border-2 border-[#1a1a1a]">
                    <span className="text-white [&>svg]:w-5 [&>svg]:h-5">{platform.icon}</span>
                  </div>
                );
              })}
              {servicePlatforms.length > 3 && (
                <div className="w-12 h-12 rounded-xl bg-pink-500/50 flex items-center justify-center flex-shrink-0 border-2 border-[#1a1a1a]">
                  <span className="text-white text-sm font-bold">+{servicePlatforms.length - 3}</span>
                </div>
              )}
            </div>
            <div>
              <p className="text-pink-400 text-xs font-medium">{platformLabel}</p>
              <h2 className="text-xl font-bold text-white">{service.title}</h2>
            </div>
          </div>
          
          <p className="text-gray-400 text-sm">
            Work with {displayName} on a sponsored collaboration
          </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Price */}
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-pink-500/10 to-purple-500/10 rounded-xl border border-pink-500/20">
            <span className="text-gray-300">Price</span>
            <span className="text-2xl font-bold text-white">${(service.pricing / 100).toFixed(0)}</span>
          </div>

          {/* What you get */}
          <div>
            <h3 className="text-white font-semibold mb-3">What you get</h3>
            <div className="space-y-2">
              {service.benefits.map((benefit, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-white/5 rounded-lg">
                  <svg className="w-5 h-5 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-300 text-sm">{benefit}</span>
                </div>
              ))}
              <div className="flex items-center gap-3 p-3 bg-white/5 rounded-lg">
                <svg className="w-5 h-5 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-gray-300 text-sm">{service.video_length_seconds}+ second video</span>
              </div>
            </div>
          </div>

          {/* Platforms included in this collab with follower counts */}
          <div>
            <h3 className="text-white font-semibold mb-3">Reach & Platforms</h3>
            <div className="space-y-2">
              {servicePlatforms.map((platformId) => {
                const platform = SOCIAL_PLATFORMS[platformId];
                const socialAccount = filteredSocials.find(s => s.platform === platformId);
                const formatFollowers = (count: number): string => {
                  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
                  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
                  return count.toString();
                };
                if (!platform) return null;
                return (
                  <div key={platformId} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="text-gray-300 [&>svg]:w-5 [&>svg]:h-5">{platform.icon}</span>
                      <div>
                        <span className="text-white text-sm font-medium">{platform.name}</span>
                        {socialAccount && (
                          <p className="text-gray-500 text-xs">@{socialAccount.handle}</p>
                        )}
                      </div>
                    </div>
                    {socialAccount?.follower_count && socialAccount.follower_count > 0 ? (
                      <span className="text-pink-400 font-semibold">{formatFollowers(socialAccount.follower_count)}</span>
                    ) : (
                      <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                );
              })}
            </div>
            {/* Total reach */}
            {(() => {
              const totalFollowers = filteredSocials.reduce((sum, s) => sum + (s.follower_count || 0), 0);
              const formatFollowers = (count: number): string => {
                if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
                if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
                return count.toString();
              };
              return totalFollowers > 0 ? (
                <div className="mt-3 p-3 bg-gradient-to-r from-pink-500/10 to-purple-500/10 rounded-lg border border-pink-500/20">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-300 text-sm">📊 Combined Reach</span>
                    <span className="text-pink-400 font-bold text-lg">{formatFollowers(totalFollowers)}</span>
                  </div>
                </div>
              ) : (
                <p className="text-gray-500 text-xs mt-2 text-center">
                  Your content will be posted on {servicePlatforms.length} platform{servicePlatforms.length > 1 ? 's' : ''}
                </p>
              );
            })()}
          </div>

          {/* Description */}
          {service.description && (
            <div>
              <h3 className="text-white font-semibold mb-2">About this service</h3>
              <p className="text-gray-400 text-sm">{service.description}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 pt-0">
          <button
            onClick={handleStartRequest}
            className="w-full py-4 bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-xl font-semibold text-lg hover:from-pink-600 hover:to-purple-600 transition-all duration-300 hover:scale-[1.02]"
          >
            Start Request
          </button>
          <p className="text-gray-500 text-xs text-center mt-3">
            You won't be charged until {displayName} accepts your request
          </p>
        </div>
      </div>
    </div>
  );
};

// Sponsor Inquiry Modal
const SponsorInquiryModal: React.FC<{
  service: ServiceOffering;
  talentProfile: TalentProfile;
  onClose: () => void;
}> = ({ service, talentProfile, onClose }) => {
  const [formData, setFormData] = useState({
    companyName: '',
    contactName: '',
    email: '',
    phone: '',
    budget: '',
    message: ''
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      // Send sponsor inquiry to edge function
      const { error } = await supabase.functions.invoke('send-sponsor-inquiry', {
        body: {
          talent_id: talentProfile.id,
          talent_name: talentProfile.full_name || talentProfile.temp_full_name || talentProfile.users?.full_name || 'Talent',
          talent_username: talentProfile.username,
          service_title: service.title,
          company_name: formData.companyName,
          contact_name: formData.contactName,
          email: formData.email,
          phone: formData.phone,
          budget: formData.budget,
          message: formData.message,
        }
      });

      if (error) throw error;

      toast.success('Inquiry sent! The talent will be in touch soon.');
      onClose();
    } catch (error: any) {
      console.error('Error sending inquiry:', error);
      toast.error('Failed to send inquiry. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const displayName = talentProfile.full_name || talentProfile.temp_full_name || talentProfile.users?.full_name || 'Creator';

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-[#0a0a0a] border border-white/20 rounded-2xl w-full max-w-lg my-8">
        {/* Header */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-2xl font-bold text-white">Sponsorship Inquiry</h2>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-gray-400 text-sm">
            Send {displayName} details about your sponsorship opportunity
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Company Name *</label>
              <input
                type="text"
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Your Name *</label>
              <input
                type="text"
                value={formData.contactName}
                onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Email *</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Phone</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="(555) 123-4567"
                className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Budget Range</label>
            <input
              type="text"
              value={formData.budget}
              onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
              placeholder="e.g., $5,000 - $10,000"
              className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Message *</label>
            <textarea
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              placeholder="Tell us about your sponsorship opportunity..."
              rows={4}
              className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-green-500 resize-none"
              required
            />
          </div>

          {/* Benefits display */}
          {service.benefits && service.benefits.length > 0 && (
            <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
              <h3 className="text-white font-semibold mb-2 text-sm">What you can expect:</h3>
              <ul className="space-y-1">
                {service.benefits.map((benefit, index) => (
                  <li key={index} className="flex items-start gap-2 text-gray-400 text-sm">
                    <svg className="h-4 w-4 text-green-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {benefit}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-white/5 border border-white/10 text-gray-300 rounded-xl font-medium hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl font-semibold hover:from-green-600 hover:to-emerald-600 transition-all disabled:opacity-50"
            >
              {submitting ? 'Sending...' : 'Send Inquiry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Podcast Modal Component
const PodcastModal: React.FC<{
  podcast: PodcastEpisodeData;
  bioSettings: BioSettings;
  onClose: () => void;
}> = ({ podcast, bioSettings, onClose }) => {
  const gradientDirection = bioSettings.gradient_direction === 'to-b' ? '180deg' : '135deg';
  const gradientStart = bioSettings.gradient_start || '#0a0a0a';
  const gradientEnd = bioSettings.gradient_end || '#1a1a2e';

  // Listen platforms - only show platforms with valid URLs
  console.log('Podcast listen links:', podcast.listenLinks);
  
  const listenPlatforms = [
    { name: 'Spotify', url: podcast.listenLinks?.spotify, icon: 'M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z' },
    { name: 'Apple Podcasts', url: podcast.listenLinks?.apple, icon: 'M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701' },
    { name: 'YouTube Music', url: podcast.listenLinks?.youtube, icon: 'M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z' },
    { name: 'Google Podcasts', url: podcast.listenLinks?.google, icon: 'M1.26 8.265v7.47h1.96v-7.47zm3.915 0v7.47h1.96v-7.47zm3.916-3.915v15.3h1.96v-15.3zm3.915 1.957v11.386h1.96V6.307zm3.916 1.958v7.47h1.96v-7.47zm3.915 0v7.47H24v-7.47z' },
    { name: 'RSS Feed', url: podcast.feedUrl, icon: 'M4.262 4.262c5.854-5.854 15.36-5.854 21.213 0 5.854 5.854 5.854 15.36 0 21.213-5.854 5.854-15.36 5.854-21.213 0-5.854-5.854-5.854-15.36 0-21.213zM4 18c0 1.105.895 2 2 2s2-.895 2-2-.895-2-2-2-2 .895-2 2zm6.5 5a1 1 0 01-.998-1.066c.123-1.952 1.094-3.72 2.662-4.85 1.567-1.13 3.56-1.475 5.46-.947a1 1 0 11-.53 1.929c-1.415-.394-2.898-.136-4.065.707-1.167.843-1.912 2.155-2.04 3.6a1 1 0 01-1 .627H10.5zM18 19a1 1 0 01-.997-1.077c.107-2.886 1.446-5.508 3.671-7.188 2.226-1.68 5.034-2.222 7.7-1.485a1 1 0 11-.466 1.945c-2.016-.557-4.122-.147-5.775 1.123-1.653 1.27-2.679 3.239-2.76 5.405A1 1 0 0118 19z' },
  ].filter(p => p.url); // Only show platforms with URLs

  return (
    <div 
      className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      style={{ background: 'rgba(0, 0, 0, 0.8)' }}
    >
      <div 
        className="rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto border border-white/20"
        style={{
          background: `linear-gradient(${gradientDirection}, ${gradientStart}, ${gradientEnd})`
        }}
      >
        {/* Header with Thumbnail */}
        <div className="relative">
          {podcast.thumbnail && (
            <div className="w-full h-48 overflow-hidden flex items-start justify-center bg-black/20">
              <img src={podcast.thumbnail} alt={podcast.title} className="h-full w-auto object-contain" />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/60"></div>
            </div>
          )}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 bg-black/50 backdrop-blur-sm text-white hover:bg-black/70 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-2">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-purple-400">
              <path d="M12 1c-6.1 0-11 4.9-11 11s4.9 11 11 11 11-4.9 11-11S18.1 1 12 1zm0 20c-5 0-9-4-9-9s4-9 9-9 9 4 9 9-4 9-9 9z"/>
              <circle cx="12" cy="12" r="2"/>
            </svg>
            <p className="text-purple-400 text-sm font-medium uppercase tracking-wide">{podcast.podcastName}</p>
          </div>

          <h2 className="text-2xl font-bold text-white">{podcast.title}</h2>

          {podcast.description && (
            <p className="text-gray-300 text-sm leading-relaxed">{podcast.description}</p>
          )}

          {podcast.duration && (
            <div className="flex items-center gap-2 text-gray-400 text-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{podcast.duration}</span>
            </div>
          )}

          {/* Listen On Buttons */}
          <div className="space-y-3 pt-4">
            <h3 className="text-white font-semibold text-sm">Listen on:</h3>
            <div className="space-y-2">
              {listenPlatforms.map((platform) => {
                if (!platform.url) return null;
                
                return (
                  <a
                    key={platform.name}
                    href={platform.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 rounded-xl transition-all hover:scale-[1.02]"
                    style={{
                      background: 'rgba(255, 255, 255, 0.1)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                    }}
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-white flex-shrink-0">
                      <path d={platform.icon} />
                    </svg>
                    <span className="text-white font-medium text-sm">{platform.name}</span>
                    <svg className="w-4 h-4 text-white/60 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BioPage;
// Trigger rebuild for env vars
