import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  PlusIcon, 
  TrashIcon, 
  PencilIcon,
  LinkIcon,
  Squares2X2Icon,
  EnvelopeIcon,
  GiftIcon,
  EyeIcon,
  CheckIcon,
  XMarkIcon,
  ClipboardIcon,
  ArrowTopRightOnSquareIcon,
  SparklesIcon,
  Cog6ToothIcon,
  PaintBrushIcon,
  CloudArrowUpIcon,
  ArrowsUpDownIcon,
  SwatchIcon,
  ChevronLeftIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline';
import { supabase } from '../services/supabase';
import { uploadImageToWasabi } from '../services/wasabiUpload';
import toast from 'react-hot-toast';

// Types
interface TalentProfile {
  id: string;
  user_id: string;
  username?: string;
  full_name?: string;
  temp_avatar_url?: string;
  bio?: string;
  social_accounts?: SocialAccount[];
  // Social handles from talent_profiles table (synced from admin)
  twitter_handle?: string;
  instagram_handle?: string;
  facebook_handle?: string;
  tiktok_handle?: string;
  rumble_handle?: string;
  youtube_handle?: string;
}

interface SocialAccount {
  id: string;
  platform: 'twitter' | 'facebook' | 'instagram' | 'tiktok' | 'linkedin' | 'youtube' | 'threads' | 'snapchat' | 'pinterest' | 'rumble';
  handle: string;
  follower_count?: number;
}

interface User {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
}

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
  show_newsletter?: boolean;
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
}

interface BioLink {
  id?: string;
  talent_id: string;
  link_type: 'basic' | 'grid' | 'newsletter' | 'sponsor';
  title?: string;
  url?: string;
  icon_url?: string;
  image_url?: string;
  grid_size?: 'small' | 'medium' | 'large';
  display_order: number;
  is_active: boolean;
  grid_columns?: number;
  background_image_url?: string;
  thumbnail_url?: string;
  subtitle?: string;
  button_text?: string;
  is_featured?: boolean;
  link_format?: 'thin' | 'tall' | 'square'; // Link display format
}

interface NewsletterConfig {
  id?: string;
  talent_id: string;
  provider: string;
  api_key?: string | null;
  list_id?: string | null;
  webhook_url?: string | null;
  form_id?: string | null;
  is_active: boolean;
}

interface ServiceOffering {
  id?: string;
  talent_id: string;
  service_type: 'instagram_collab' | 'tiktok_collab' | 'youtube_collab';
  pricing: number; // in cents
  title: string;
  description?: string;
  video_length_seconds: number;
  benefits: string[];
  platforms: string[]; // Which social platforms are included (instagram, tiktok, youtube, twitter, facebook)
  is_active: boolean;
  display_order: number;
}

interface BioEvent {
  id?: string;
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
  source_url?: string; // For ical/rss feeds
  is_active: boolean;
  display_order: number;
}

// Gradient presets
const GRADIENT_PRESETS = [
  { name: 'Midnight', start: '#0a0a0a', end: '#1a1a2e', direction: 'to-b' },
  { name: 'Ocean', start: '#0c4a6e', end: '#164e63', direction: 'to-br' },
  { name: 'Sunset', start: '#7c2d12', end: '#1c1917', direction: 'to-b' },
  { name: 'Forest', start: '#14532d', end: '#0a0a0a', direction: 'to-b' },
  { name: 'Purple Haze', start: '#581c87', end: '#0a0a0a', direction: 'to-b' },
  { name: 'Rose', start: '#881337', end: '#1c1917', direction: 'to-b' },
  { name: 'Slate', start: '#334155', end: '#0f172a', direction: 'to-b' },
  { name: 'Warm', start: '#78350f', end: '#1c1917', direction: 'to-br' },
];

const BUTTON_COLORS = [
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Purple', value: '#8b5cf6' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Yellow', value: '#eab308' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Teal', value: '#14b8a6' },
  { name: 'White', value: '#ffffff' },
];

const NEWSLETTER_PROVIDERS = [
  { id: 'mailchimp', name: 'Mailchimp', icon: '📧' },
  { id: 'getresponse', name: 'GetResponse', icon: '📬' },
  { id: 'flodesk', name: 'Flodesk', icon: '💐' },
  { id: 'emailoctopus', name: 'EmailOctopus', icon: '🐙' },
  { id: 'cleverreach', name: 'CleverReach', icon: '🎯' },
  { id: 'activecampaign', name: 'ActiveCampaign', icon: '⚡' },
  { id: 'zapier', name: 'Zapier Webhook', icon: '🔗' },
];

// Social platforms with their URL patterns and SVG icons
const SOCIAL_PLATFORMS = [
  { id: 'instagram', name: 'Instagram', urlPattern: 'instagram.com', baseUrl: 'https://instagram.com/',
    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg> },
  { id: 'twitter', name: 'X (Twitter)', urlPattern: 'twitter.com|x.com', baseUrl: 'https://x.com/',
    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg> },
  { id: 'tiktok', name: 'TikTok', urlPattern: 'tiktok.com', baseUrl: 'https://tiktok.com/@',
    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/></svg> },
  { id: 'youtube', name: 'YouTube', urlPattern: 'youtube.com|youtu.be', baseUrl: 'https://youtube.com/',
    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg> },
  { id: 'facebook', name: 'Facebook', urlPattern: 'facebook.com|fb.com', baseUrl: 'https://facebook.com/',
    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg> },
  { id: 'linkedin', name: 'LinkedIn', urlPattern: 'linkedin.com', baseUrl: 'https://linkedin.com/in/',
    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg> },
  { id: 'threads', name: 'Threads', urlPattern: 'threads.net', baseUrl: 'https://threads.net/@',
    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.96-.065-1.182.408-2.256 1.33-3.022.88-.73 2.108-1.146 3.456-1.17 1.005-.018 1.96.14 2.836.469-.034-.773-.17-1.418-.413-1.911-.351-.714-.964-1.08-1.874-1.12-1.084.007-1.9.6-2.378 1.235l-1.7-1.154c.78-1.104 2.144-1.8 3.943-1.963l.136-.008c1.678-.067 3.056.36 4.1 1.27.962.838 1.574 2.086 1.82 3.713.266-.057.54-.103.82-.138l.468-.06c1.953-.19 3.936.376 5.14 1.556 1.522 1.49 1.973 3.746 1.239 6.2-.49 1.638-1.51 3.07-2.95 4.14-1.617 1.2-3.654 1.832-6.058 1.88h-.007zm-2.21-8.106c-.78.045-1.394.283-1.776.69-.345.368-.516.838-.483 1.325.033.515.266.96.657 1.254.453.34 1.09.5 1.798.454 1.053-.057 1.864-.508 2.412-1.342.396-.604.637-1.4.716-2.364-.93-.252-1.956-.345-3.324-.017z"/></svg> },
  { id: 'snapchat', name: 'Snapchat', urlPattern: 'snapchat.com', baseUrl: 'https://snapchat.com/add/',
    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M12.206.793c.99 0 4.347.276 5.93 3.821.529 1.193.403 3.219.299 4.847l-.003.06c-.012.18-.022.345-.03.51.075.045.203.09.401.09.3-.016.659-.12 1.033-.301.165-.088.344-.104.464-.104.182 0 .359.029.509.09.45.149.734.479.734.838.015.449-.39.839-1.213 1.168-.089.029-.209.075-.344.119-.45.135-1.139.36-1.333.81-.09.224-.061.524.12.868l.015.015c.06.136 1.526 3.475 4.791 4.014.255.044.435.27.42.509 0 .075-.015.149-.045.225-.24.569-1.273.988-3.146 1.271-.059.091-.12.375-.164.57-.029.179-.074.36-.134.553-.076.271-.27.405-.555.405h-.03c-.135 0-.313-.031-.538-.074-.36-.075-.765-.135-1.273-.135-.3 0-.599.015-.913.074-.6.104-1.123.464-1.723.884-.853.599-1.826 1.288-3.294 1.288-.06 0-.119-.015-.18-.015h-.149c-1.468 0-2.427-.675-3.279-1.288-.599-.42-1.107-.779-1.707-.884-.314-.045-.629-.074-.928-.074-.54 0-.958.089-1.272.149-.211.043-.391.074-.54.074-.374 0-.523-.224-.583-.42-.061-.192-.09-.389-.135-.567-.046-.181-.105-.494-.166-.57-1.918-.222-2.95-.642-3.189-1.226-.031-.063-.052-.15-.055-.225-.015-.243.165-.465.42-.509 3.264-.54 4.73-3.879 4.791-4.02l.016-.029c.18-.345.224-.645.119-.869-.195-.434-.884-.658-1.332-.809-.121-.029-.24-.074-.346-.119-1.107-.435-1.257-.93-1.197-1.273.09-.479.674-.793 1.168-.793.146 0 .27.029.383.074.42.194.789.3 1.104.3.234 0 .384-.06.465-.105l-.046-.569c-.098-1.626-.225-3.651.307-4.837C7.392 1.077 10.739.807 11.727.807l.419-.015h.06z"/></svg> },
  { id: 'pinterest', name: 'Pinterest', urlPattern: 'pinterest.com', baseUrl: 'https://pinterest.com/',
    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M12 0C5.373 0 0 5.372 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738.098.119.112.224.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.631-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12 0-6.628-5.373-12-12-12z"/></svg> },
  { id: 'spotify', name: 'Spotify', urlPattern: 'spotify.com|open.spotify', baseUrl: 'https://open.spotify.com/',
    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg> },
  { id: 'twitch', name: 'Twitch', urlPattern: 'twitch.tv', baseUrl: 'https://twitch.tv/',
    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/></svg> },
  { id: 'discord', name: 'Discord', urlPattern: 'discord.gg|discord.com', baseUrl: 'https://discord.gg/',
    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z"/></svg> },
  { id: 'rumble', name: 'Rumble', urlPattern: 'rumble.com', baseUrl: 'https://rumble.com/c/',
    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M14.4528 13.5458c0.8064 -0.6542 0.9297 -1.8381 0.2756 -2.6445a1.8802 1.8802 0 0 0 -0.2756 -0.2756 21.2127 21.2127 0 0 0 -4.3121 -2.776c-1.066 -0.51 -2.256 0.2 -2.4261 1.414a23.5226 23.5226 0 0 0 -0.14 5.5021c0.116 1.23 1.292 1.964 2.372 1.492a19.6285 19.6285 0 0 0 4.5062 -2.704v-0.008zm6.9322 -5.4002c2.0335 2.228 2.0396 5.637 0.014 7.8723A26.1487 26.1487 0 0 1 8.2946 23.846c-2.6848 0.6713 -5.4168 -0.914 -6.1662 -3.5781 -1.524 -5.2002 -1.3 -11.0803 0.17 -16.3045 0.772 -2.744 3.3521 -4.4661 6.0102 -3.832 4.9242 1.174 9.5443 4.196 13.0764 8.0121v0.002z"/></svg> },
];

// URLs to skip during import (not actual links)
const SKIP_URL_PATTERNS = [
  '/privacy',
  '/terms',
  '/legal',
  '/cookie',
  '/about',
  '/contact',
  '/help',
  '/support',
  '/faq',
  'facebook.com/sharer',
  'twitter.com/intent',
  'twitter.com/share',
  'linkedin.com/sharing',
  'linkedin.com/shareArticle',
  'pinterest.com/pin/create',
  'reddit.com/submit',
  'tumblr.com/share',
  'telegram.me/share',
  't.me/share',
  'wa.me',
  'whatsapp.com/send',
  'line.me/R/share',
  'social-plugins.line.me',
  'story.kakao.com/share',
  'vk.com/share',
  'getpocket.com/save',
  'buffer.com/add',
  'mailto:',
  'tel:',
  'sms:',
];

// Helper to detect if URL is a social platform
const detectSocialPlatform = (url: string): string | null => {
  const lowerUrl = url.toLowerCase();
  for (const platform of SOCIAL_PLATFORMS) {
    const patterns = platform.urlPattern.split('|');
    if (patterns.some(p => lowerUrl.includes(p))) {
      return platform.id;
    }
  }
  return null;
};

// Helper to check if URL should be skipped
const shouldSkipUrl = (url: string): boolean => {
  const lowerUrl = url.toLowerCase();
  return SKIP_URL_PATTERNS.some(pattern => lowerUrl.includes(pattern));
};

const BioDashboard: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [, setUser] = useState<User | null>(null);
  const [talentProfile, setTalentProfile] = useState<TalentProfile | null>(null);
  const [bioSettings, setBioSettings] = useState<BioSettings | null>(null);
  const [links, setLinks] = useState<BioLink[]>([]);
  const [socialLinks, setSocialLinks] = useState<SocialAccount[]>([]);
  const [newsletterConfigs, setNewsletterConfigs] = useState<NewsletterConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingLink, setEditingLink] = useState<BioLink | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showNewsletterModal, setShowNewsletterModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showAddSocialModal, setShowAddSocialModal] = useState(false);
  const [showAddServiceModal, setShowAddServiceModal] = useState(false);
  const [serviceOfferings, setServiceOfferings] = useState<ServiceOffering[]>([]);
  const [editingService, setEditingService] = useState<ServiceOffering | null>(null);
  const [showAddEventModal, setShowAddEventModal] = useState(false);
  const [bioEvents, setBioEvents] = useState<BioEvent[]>([]);
  const [authError, setAuthError] = useState<string | null>(null);
  const [mainView, setMainView] = useState<'customize' | 'send_updates'>('customize');
  const [subscriberCount, setSubscriberCount] = useState(0);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailContent, setEmailContent] = useState('');
  const [emailButtonText, setEmailButtonText] = useState('');
  const [emailButtonUrl, setEmailButtonUrl] = useState('');
  const [emailImageUrl, setEmailImageUrl] = useState('');
  const [emailScheduledDate, setEmailScheduledDate] = useState('');
  const [emailScheduledTime, setEmailScheduledTime] = useState('');
  const [emailDraftSaved, setEmailDraftSaved] = useState(false);
  const [randomReview, setRandomReview] = useState<{ rating: number; comment?: string; users?: { full_name: string } } | null>(null);
  const [activeTab, setActiveTab] = useState<'links' | 'social' | 'style' | 'settings'>('links');
  const [previewKey, setPreviewKey] = useState(0);

  // Auto-refresh preview
  const refreshPreview = useCallback(() => {
    setPreviewKey(prev => prev + 1);
  }, []);

  // Authenticate user from token
  useEffect(() => {
    const authenticateUser = async () => {
      const token = searchParams.get('token');
      
      if (!token) {
        setAuthError('No authentication token provided. Please access this page from your ShoutOut dashboard.');
        setLoading(false);
        return;
      }

      try {
        console.log('Bio Dashboard: Authenticating with token:', token);
        
        // First, try to find talent profile directly by ID (for admin access)
        let profile: TalentProfile | null = null;
        let userData: User | null = null;
        
        const { data: directProfile, error: directError } = await supabase
          .from('talent_profiles')
          .select('*')
          .eq('id', token)
          .single();
        
        if (!directError && directProfile) {
          // Token is a talent_profile ID (admin access)
          console.log('Bio Dashboard: Found talent profile directly by ID');
          profile = directProfile;
          
          // Get user data if available
          if (directProfile.user_id) {
            const { data: userFromProfile } = await supabase
              .from('users')
              .select('*')
              .eq('id', directProfile.user_id)
              .single();
            userData = userFromProfile;
          }
        } else {
          // Try token as user ID (normal talent access)
          const { data: userById, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('id', token)
            .single();

          if (userError || !userById) {
            console.error('Bio Dashboard: User lookup failed:', userError);
            setAuthError(`Invalid authentication token. Please try again from your ShoutOut dashboard.`);
            setLoading(false);
            return;
          }

          userData = userById as User;

          const { data: profileByUser, error: profileError } = await supabase
            .from('talent_profiles')
            .select('*')
            .eq('user_id', userById.id)
            .single();

          if (profileError || !profileByUser) {
            console.error('Bio Dashboard: Talent profile lookup failed:', profileError);
            setAuthError(`No talent profile found. You must be a talent to use ShoutOut Bio.`);
            setLoading(false);
            return;
          }
          
          profile = profileByUser;
        }

        if (userData) {
          setUser(userData);
        }
        
        if (!profile) {
          setAuthError(`No talent profile found. You must be a talent to use ShoutOut Bio.`);
          setLoading(false);
          return;
        }

        setTalentProfile(profile);
        
        // Load social accounts from the social_accounts table (not JSONB field)
        const { data: socialData } = await supabase
          .from('social_accounts')
          .select('id, platform, handle, follower_count')
          .eq('talent_id', profile.id);
        
        // Also check for handles in talent_profiles that might not be in social_accounts
        // This syncs handles added via admin > talent management
        const profileHandles: { platform: string; handle: string }[] = [];
        
        // Check each platform handle in talent_profiles
        const handleMappings = [
          { platform: 'twitter', field: 'twitter_handle' },
          { platform: 'instagram', field: 'instagram_handle' },
          { platform: 'facebook', field: 'facebook_handle' },
          { platform: 'tiktok', field: 'tiktok_handle' },
          { platform: 'youtube', field: 'youtube_handle' },
          { platform: 'rumble', field: 'rumble_handle' },
        ];
        
        for (const mapping of handleMappings) {
          const handle = (profile as any)[mapping.field];
          if (handle) {
            // Check if this platform exists in socialData
            const existsInSocial = socialData?.some(s => s.platform === mapping.platform);
            if (!existsInSocial) {
              profileHandles.push({
                platform: mapping.platform,
                handle: handle.replace(/^@/, ''), // Clean handle
              });
            }
          }
        }
        
        // Combine social_accounts data with handles from talent_profiles
        // This ensures handles added via admin show up even if not in social_accounts table
        const combinedSocials: SocialAccount[] = [];
        
        // First add all from social_accounts table
        if (socialData && socialData.length > 0) {
          for (const s of socialData) {
            combinedSocials.push({
              id: s.id,
              platform: s.platform as SocialAccount['platform'],
              handle: s.handle.replace(/^@/, ''),
              follower_count: s.follower_count,
            });
          }
        }
        
        // Then add any from talent_profiles that aren't already in the list
        for (const mapping of handleMappings) {
          const handle = (profile as any)[mapping.field];
          if (handle) {
            const existsAlready = combinedSocials.some(s => s.platform === mapping.platform);
            if (!existsAlready) {
              combinedSocials.push({
                id: `profile-${mapping.platform}`, // Temporary ID for display
                platform: mapping.platform as SocialAccount['platform'],
                handle: handle.replace(/^@/, ''),
                follower_count: undefined,
              });
            }
          }
        }
        
        console.log('Bio Dashboard: Combined socials for talent', profile.id, ':', combinedSocials);
        setSocialLinks(combinedSocials);
        
        // Try to sync handles from talent_profiles to social_accounts (best effort)
        if (profileHandles.length > 0 && profile) {
          console.log('Attempting to sync handles from talent_profiles to social_accounts:', profileHandles);
          const profileId = profile.id;
          
          const insertData = profileHandles.map(h => ({
            talent_id: profileId,
            platform: h.platform,
            handle: h.handle.startsWith('@') ? h.handle : `@${h.handle}`,
          }));
          
          const { error: insertError } = await supabase
            .from('social_accounts')
            .insert(insertData);
          
          if (insertError) {
            console.warn('Could not sync handles to social_accounts (will still display from profile):', insertError);
          } else {
            console.log('Successfully synced handles to social_accounts');
          }
        }
        
        // Sync youtube_handle and rumble_handle to talent_profiles if missing
        if (socialData && socialData.length > 0) {
          const youtubeLink = socialData.find(s => s.platform === 'youtube');
          const rumbleLink = socialData.find(s => s.platform === 'rumble');
          const needsSync: Record<string, string> = {};
          
          if (youtubeLink && !profile.youtube_handle) {
            needsSync.youtube_handle = youtubeLink.handle.replace(/^@/, '');
            profile.youtube_handle = needsSync.youtube_handle;
          }
          if (rumbleLink && !profile.rumble_handle) {
            needsSync.rumble_handle = rumbleLink.handle.replace(/^@/, '');
            profile.rumble_handle = needsSync.rumble_handle;
          }
          
          // Update the database if we found mismatches
          if (Object.keys(needsSync).length > 0) {
            await supabase
              .from('talent_profiles')
              .update(needsSync)
              .eq('id', profile.id);
          }
        }

        // Load service offerings
        const { data: servicesData } = await supabase
          .from('service_offerings')
          .select('*')
          .eq('talent_id', profile.id)
          .order('display_order', { ascending: true });
        
        if (servicesData) {
          setServiceOfferings(servicesData.map(s => ({
            ...s,
            benefits: Array.isArray(s.benefits) ? s.benefits : JSON.parse(s.benefits || '[]'),
          })));
        }

        // Load bio events
        const { data: eventsData } = await supabase
          .from('bio_events')
          .select('*')
          .eq('talent_id', profile.id)
          .order('display_order', { ascending: true });
        
        if (eventsData) {
          setBioEvents(eventsData);
        }

        // Get subscriber count
        const { count: subCount } = await supabase
          .from('talent_followers')
          .select('*', { count: 'exact', head: true })
          .eq('talent_id', profile.id);
        
        setSubscriberCount(subCount || 0);

        // Get a random review for the ShoutOut card in emails
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

        // Get or create bio settings
        let { data: settings, error: settingsError } = await supabase
          .from('bio_settings')
          .select('*')
          .eq('talent_id', profile.id)
          .single();

        if (settingsError && settingsError.code === 'PGRST116') {
          const defaultSettings: Partial<BioSettings> = {
            talent_id: profile.id,
            theme: 'glass',
            background_color: '#0a0a0a',
            accent_color: '#3b82f6',
            font_family: 'Inter',
            show_shoutout_card: true,
            is_published: true, // Auto-publish by default - all talents have a bio page
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

          if (createError) {
            console.error('Error creating bio settings:', createError);
          } else {
            settings = newSettings;
          }
        }

        setBioSettings(settings);

        // Get links
        const { data: linksData } = await supabase
          .from('bio_links')
          .select('*')
          .eq('talent_id', profile.id)
          .order('display_order');

        setLinks(linksData || []);

        // Get newsletter configs
        const { data: newsletterData } = await supabase
          .from('bio_newsletter_configs')
          .select('*')
          .eq('talent_id', profile.id);

        setNewsletterConfigs(newsletterData || []);

      } catch (error) {
        console.error('Authentication error:', error);
        setAuthError('An error occurred during authentication.');
      } finally {
        setLoading(false);
      }
    };

    authenticateUser();
  }, [searchParams]);

  // Save settings
  const saveSettings = useCallback(async (updates: Partial<BioSettings>) => {
    if (!bioSettings?.id) {
      console.error('No bioSettings.id to save to');
      return;
    }

    console.log('Saving settings:', updates, 'to bioSettings.id:', bioSettings.id);
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('bio_settings')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', bioSettings.id)
        .select();

      if (error) {
        console.error('Supabase error saving settings:', error);
        throw error;
      }
      
      console.log('Settings saved successfully:', data);
      setBioSettings({ ...bioSettings, ...updates });
      toast.success('Settings saved!');
      // Auto-refresh preview after saving
      setTimeout(refreshPreview, 500);
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  }, [bioSettings, refreshPreview]);

  // Add new link
  const addLink = async (link: Omit<BioLink, 'id' | 'display_order'>) => {
    if (!talentProfile?.id) return;

    try {
      const newLink = {
        ...link,
        talent_id: talentProfile.id,
        display_order: links.length,
      };

      const { data, error } = await supabase
        .from('bio_links')
        .insert([newLink])
        .select()
        .single();

      if (error) throw error;
      setLinks([...links, data]);
      setShowAddModal(false);
      toast.success('Link added!');
      // Auto-refresh preview
      setTimeout(refreshPreview, 500);
    } catch (error) {
      console.error('Error adding link:', error);
      toast.error('Failed to add link');
    }
  };

  // Add multiple links (for grid cards)
  const addMultipleLinks = async (newLinks: Omit<BioLink, 'id' | 'display_order'>[]) => {
    if (!talentProfile?.id) return;

    try {
      const linksToInsert = newLinks.map((link, index) => ({
        ...link,
        talent_id: talentProfile.id,
        display_order: links.length + index,
      }));

      const { data, error } = await supabase
        .from('bio_links')
        .insert(linksToInsert)
        .select();

      if (error) throw error;
      setLinks([...links, ...(data || [])]);
      setShowAddModal(false);
      toast.success(`${data?.length || 0} grid cards added!`);
      // Auto-refresh preview
      setTimeout(refreshPreview, 500);
    } catch (error) {
      console.error('Error adding links:', error);
      toast.error('Failed to add grid cards');
    }
  };

  // Update link
  const updateLink = async (link: BioLink) => {
    if (!link.id) return;

    console.log('updateLink called with:', { id: link.id, link_format: link.link_format, title: link.title });

    try {
      const updateData = {
        title: link.title,
        url: link.url,
        icon_url: link.icon_url,
        image_url: link.image_url,
        grid_size: link.grid_size,
        is_active: link.is_active,
        grid_columns: link.grid_columns,
        background_image_url: link.background_image_url,
        thumbnail_url: link.thumbnail_url,
        subtitle: link.subtitle,
        button_text: link.button_text,
        is_featured: link.is_featured,
        link_format: link.link_format,
        updated_at: new Date().toISOString(),
      };
      console.log('Updating bio_links with:', updateData);
      
      const { error } = await supabase
        .from('bio_links')
        .update(updateData)
        .eq('id', link.id);

      if (error) throw error;
      setLinks(links.map(l => l.id === link.id ? link : l));
      setEditingLink(null);
      toast.success('Link updated!');
      // Auto-refresh preview
      setTimeout(refreshPreview, 500);
    } catch (error) {
      console.error('Error updating link:', error);
      toast.error('Failed to update link');
    }
  };

  // Delete link
  const deleteLink = async (linkId: string) => {
    try {
      const { error } = await supabase
        .from('bio_links')
        .delete()
        .eq('id', linkId);

      if (error) throw error;
      setLinks(links.filter(l => l.id !== linkId));
      toast.success('Link deleted!');
      // Auto-refresh preview
      setTimeout(refreshPreview, 500);
    } catch (error) {
      console.error('Error deleting link:', error);
      toast.error('Failed to delete link');
    }
  };

  // Reorder links
  const moveLink = async (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= links.length) return;

    const newLinks = [...links];
    const [movedLink] = newLinks.splice(index, 1);
    newLinks.splice(newIndex, 0, movedLink);

    // Update display_order
    const updatedLinks = newLinks.map((link, i) => ({ ...link, display_order: i }));
    setLinks(updatedLinks);

    // Save to database
    try {
      for (const link of updatedLinks) {
        await supabase
          .from('bio_links')
          .update({ display_order: link.display_order })
          .eq('id', link.id);
      }
    } catch (error) {
      console.error('Error reordering links:', error);
    }
  };

  // Copy bio URL
  const copyBioUrl = () => {
    const url = `https://bio.shoutout.us/${talentProfile?.username || talentProfile?.id}`;
    navigator.clipboard.writeText(url);
    toast.success('Bio URL copied!');
  };

  // Publish/unpublish
  const togglePublish = async () => {
    await saveSettings({ is_published: !bioSettings?.is_published });
  };

  // Import from URL - Uses a CORS proxy to fetch and parse link-in-bio pages
  const importFromUrl = async (url: string) => {
    if (!talentProfile?.id) return;
    
    toast.loading('Importing links...', { id: 'import' });
    setShowImportModal(false);
    
    try {
      // Use a CORS proxy to fetch the page
      const corsProxies = [
        `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
        `https://corsproxy.io/?${encodeURIComponent(url)}`,
      ];
      
      let html = '';
      let fetchSuccess = false;
      
      for (const proxyUrl of corsProxies) {
        try {
          const response = await fetch(proxyUrl);
          if (response.ok) {
            html = await response.text();
            fetchSuccess = true;
            break;
          }
        } catch (e) {
          console.log('Proxy failed, trying next...', e);
        }
      }
      
      if (!fetchSuccess || !html) {
        throw new Error('Could not fetch the page. Please check the URL and try again.');
      }
      
      // Parse the HTML to extract links
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      const extractedLinks: Array<{
        title: string;
        url: string;
        thumbnail_url?: string;
      }> = [];
      
      // Common selectors for link-in-bio platforms
      const linkSelectors = [
        // Linktree
        'a[data-testid="LinkButton"]',
        'a[data-testid="StyledContainer"]',
        // Beacons
        'a.link-block',
        'a[class*="LinkButton"]',
        // Stan Store
        'a[class*="product-card"]',
        'a[class*="link-card"]',
        // Generic patterns
        'a[href^="http"]:not([href*="facebook.com/sharer"]):not([href*="twitter.com/intent"]):not([href*="linkedin.com/sharing"])',
        // Main content links
        '.links a',
        '.link-list a',
        '[class*="link"] a',
        '[class*="Link"] a',
      ];
      
      // Try each selector
      for (const selector of linkSelectors) {
        try {
          const elements = doc.querySelectorAll(selector);
          elements.forEach((el) => {
            const anchor = el as HTMLAnchorElement;
            const href = anchor.getAttribute('href');
            
            // Skip unwanted URLs (share buttons, privacy, etc.)
            const jsPrefix = 'javascript'; // eslint workaround
            if (!href || 
                href.startsWith('#') || 
                href.startsWith(jsPrefix + ':') ||
                href === url ||
                shouldSkipUrl(href)) {
              return;
            }
            
            // Get the title from various sources
            let title = '';
            const titleEl = anchor.querySelector('h3, h4, p, span, [class*="title"], [class*="Title"]');
            if (titleEl) {
              title = titleEl.textContent?.trim() || '';
            }
            if (!title) {
              title = anchor.textContent?.trim() || '';
            }
            if (!title) {
              title = anchor.getAttribute('aria-label') || '';
            }
            
            // Clean up title - remove extra whitespace
            title = title.replace(/\s+/g, ' ').trim();
            
            // Skip if no meaningful title or too long (probably scraped wrong content)
            if (!title || title.length > 100 || title.length < 2) {
              return;
            }
            
            // Get thumbnail if available
            let thumbnail_url = '';
            const img = anchor.querySelector('img');
            if (img) {
              thumbnail_url = img.getAttribute('src') || img.getAttribute('data-src') || '';
              // Make relative URLs absolute
              if (thumbnail_url && !thumbnail_url.startsWith('http')) {
                try {
                  const baseUrl = new URL(url);
                  thumbnail_url = new URL(thumbnail_url, baseUrl.origin).href;
                } catch {
                  thumbnail_url = '';
                }
              }
            }
            
            // Check for duplicates
            const isDuplicate = extractedLinks.some(
              (l) => l.url === href || l.title === title
            );
            
            if (!isDuplicate && href) {
              extractedLinks.push({
                title,
                url: href,
                thumbnail_url: thumbnail_url || undefined,
              });
            }
          });
        } catch (e) {
          console.log('Selector failed:', selector, e);
        }
      }
      
      // Also try to find links in JSON-LD or meta tags
      const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
      scripts.forEach((script) => {
        try {
          const data = JSON.parse(script.textContent || '');
          if (data.mainEntity?.itemListElement) {
            data.mainEntity.itemListElement.forEach((item: any) => {
              if (item.url && item.name) {
                const isDuplicate = extractedLinks.some((l) => l.url === item.url);
                if (!isDuplicate) {
                  extractedLinks.push({
                    title: item.name,
                    url: item.url,
                  });
                }
              }
            });
          }
        } catch {
          // Ignore JSON parse errors
        }
      });
      
      // Separate social links from regular links
      const regularLinks: typeof extractedLinks = [];
      const detectedSocialLinks: Array<{ platform: string; url: string; handle: string }> = [];
      
      for (const link of extractedLinks) {
        const socialPlatform = detectSocialPlatform(link.url);
        if (socialPlatform) {
          // Extract handle from URL
          let handle = link.url;
          try {
            const urlObj = new URL(link.url);
            handle = urlObj.pathname.replace(/^\/+|\/+$/g, '').split('/')[0] || link.title;
            // Remove @ if present
            handle = handle.replace(/^@/, '');
          } catch {
            handle = link.title;
          }
          
          // Check if we already have this social platform
          const existingSocial = detectedSocialLinks.find(s => s.platform === socialPlatform);
          if (!existingSocial) {
            detectedSocialLinks.push({
              platform: socialPlatform,
              url: link.url,
              handle,
            });
          }
        } else {
          regularLinks.push(link);
        }
      }
      
      if (regularLinks.length === 0 && detectedSocialLinks.length === 0) {
        throw new Error('No links found on this page. Try a different URL or add links manually.');
      }
      
      // Limit to 20 regular links max
      const linksToImport = regularLinks.slice(0, 20);
      
      // Save regular links to database
      const newLinks: BioLink[] = [];
      for (let i = 0; i < linksToImport.length; i++) {
        const link = linksToImport[i];
        const newLink = {
          talent_id: talentProfile.id,
          link_type: 'basic' as const,
          title: link.title,
          url: link.url,
          thumbnail_url: link.thumbnail_url,
          display_order: links.length + i,
          is_active: true,
        };
        
        const { data, error } = await supabase
          .from('bio_links')
          .insert([newLink])
          .select()
          .single();
        
        if (!error && data) {
          newLinks.push(data);
        }
      }
      
      // Add detected social links to state (merge with existing)
      if (detectedSocialLinks.length > 0) {
        const newSocialLinks: SocialAccount[] = [];
        for (const social of detectedSocialLinks) {
          // Check if platform already exists
          const exists = socialLinks.some(s => s.platform === social.platform);
          if (!exists) {
            newSocialLinks.push({
              id: `imported-${Date.now()}-${social.platform}`,
              platform: social.platform as SocialAccount['platform'],
              handle: social.handle,
            });
          }
        }
        if (newSocialLinks.length > 0) {
          const updatedSocials = [...socialLinks, ...newSocialLinks];
          setSocialLinks(updatedSocials);
          // Save to talent profile
          await supabase
            .from('talent_profiles')
            .update({ social_accounts: updatedSocials })
            .eq('id', talentProfile.id);
        }
      }
      
      const totalImported = newLinks.length + detectedSocialLinks.filter(s => !socialLinks.some(existing => existing.platform === s.platform)).length;
      
      if (totalImported > 0) {
        setLinks([...links, ...newLinks]);
        toast.success(`Imported ${newLinks.length} links${detectedSocialLinks.length > 0 ? ` and ${detectedSocialLinks.length} social profiles` : ''}!`, { id: 'import' });
        // Auto-refresh preview
        setTimeout(refreshPreview, 500);
      } else {
        throw new Error('No new links to import (may already exist).');
      }
      
    } catch (error: any) {
      console.error('Import error:', error);
      toast.error(error.message || 'Failed to import links. Please try again.', { id: 'import' });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading your bio dashboard...</p>
        </div>
      </div>
    );
  }

  if (authError) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-4">
        <SparklesIcon className="h-16 w-16 text-red-500 mb-4" />
        <h1 className="text-2xl font-bold text-white mb-2">Authentication Required</h1>
        <p className="text-gray-400 mb-6 text-center max-w-md">{authError}</p>
        <a
          href="https://shoutout.us/dashboard?tab=bio"
          className="px-6 py-3 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition-colors"
        >
          Go to ShoutOut Dashboard
        </a>
      </div>
    );
  }

  const bioUrl = `bio.shoutout.us/${talentProfile?.username || talentProfile?.id}`;

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div 
          className="absolute inset-0"
          style={{
            background: `linear-gradient(${bioSettings?.gradient_direction === 'to-b' ? '180deg' : '135deg'}, ${bioSettings?.gradient_start || '#0a0a0a'}, ${bioSettings?.gradient_end || '#1a1a2e'})`
          }}
        />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-black/40 border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <SparklesIcon className="h-8 w-8 text-blue-400" />
              {/* Main View Tabs */}
              <div className="flex bg-white/5 rounded-xl p-1">
                <button
                  onClick={() => setMainView('customize')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    mainView === 'customize'
                      ? 'bg-white/20 text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Customize
                </button>
                <button
                  onClick={() => setMainView('send_updates')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                    mainView === 'send_updates'
                      ? 'bg-white/20 text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Send Updates
                  {subscriberCount > 0 && (
                    <span className="bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded-full">{subscriberCount}</span>
                  )}
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={togglePublish}
                disabled={saving}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition-all ${
                  bioSettings?.is_published
                    ? 'bg-green-500/20 border border-green-500/50 text-green-400'
                    : 'bg-blue-500 text-white hover:bg-blue-600'
                }`}
              >
                {bioSettings?.is_published ? (
                  <>
                    <CheckIcon className="h-4 w-4" />
                    Published
                  </>
                ) : (
                  <>
                    <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                    Publish
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6 relative z-10">
        {mainView === 'customize' ? (
          <>
            {/* Tab Navigation */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
              {[
                { key: 'links', label: 'Links', icon: LinkIcon },
                { key: 'social', label: 'Social', icon: SparklesIcon },
                { key: 'style', label: 'Style', icon: PaintBrushIcon },
                { key: 'settings', label: 'Settings', icon: Cog6ToothIcon },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as typeof activeTab)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm whitespace-nowrap transition-all ${
                    activeTab === tab.key
                      ? 'bg-white/20 text-white'
                      : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </button>
              ))}
            </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left Column - Editor */}
          <div className="space-y-6">
            {activeTab === 'links' && (
              <>
                {/* Action Buttons */}
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition-colors"
                  >
                    <PlusIcon className="h-5 w-5" />
                    Add Link
                  </button>
                  <button
                    onClick={() => setShowAddServiceModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-xl font-medium hover:from-pink-600 hover:to-purple-600 transition-colors"
                  >
                    <PlusIcon className="h-5 w-5" />
                    Service
                  </button>
                  <button
                    onClick={() => setShowAddEventModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-medium hover:from-orange-600 hover:to-amber-600 transition-colors"
                  >
                    <PlusIcon className="h-5 w-5" />
                    Event
                  </button>
                </div>

                {/* Links List */}
                <div className="space-y-3">
                  {links.length === 0 ? (
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
                      <LinkIcon className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-400 mb-2">No links yet</h3>
                      <p className="text-gray-500 mb-4">Add your first link or import from another platform</p>
                    </div>
                  ) : (
                    links.map((link, index) => (
                      <div
                        key={link.id}
                        className={`bg-white/5 border rounded-xl p-4 transition-all border-white/10 hover:border-white/20 ${!link.is_active ? 'opacity-50' : ''}`}
                      >
                        <div className="flex items-center gap-3">
                          {/* Reorder buttons */}
                          <div className="flex flex-col gap-1">
                            <button
                              onClick={() => moveLink(index, 'up')}
                              disabled={index === 0}
                              className="p-1 text-gray-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <ArrowsUpDownIcon className="h-4 w-4 rotate-180" />
                            </button>
                            <button
                              onClick={() => moveLink(index, 'down')}
                              disabled={index === links.length - 1}
                              className="p-1 text-gray-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <ArrowsUpDownIcon className="h-4 w-4" />
                            </button>
                          </div>

                          {/* Thumbnail */}
                          {link.thumbnail_url ? (
                            <img src={link.thumbnail_url} alt="" className="w-12 h-12 rounded-lg object-cover" />
                          ) : (
                            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                              link.link_type === 'basic' ? 'bg-blue-500/20' :
                              link.link_type === 'grid' ? 'bg-purple-500/20' :
                              'bg-yellow-500/20'
                            }`}>
                              {link.link_type === 'basic' && <LinkIcon className="h-5 w-5 text-blue-400" />}
                              {link.link_type === 'grid' && <Squares2X2Icon className="h-5 w-5 text-purple-400" />}
                              {link.link_type === 'sponsor' && <GiftIcon className="h-5 w-5 text-yellow-400" />}
                            </div>
                          )}

                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-white truncate">
                              {link.title || `${link.link_type.charAt(0).toUpperCase() + link.link_type.slice(1)} Link`}
                            </h3>
                            {link.url && (
                              <p className="text-sm text-gray-400 truncate">{link.url}</p>
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setEditingLink(link)}
                              className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                            >
                              <PencilIcon className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => deleteLink(link.id!)}
                              className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                            >
                              <TrashIcon className="h-5 w-5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Rumble Card Toggle - Compact */}
                {talentProfile?.rumble_handle && (
                  <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30 rounded-xl p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 text-green-400 flex-shrink-0">
                          <path d="M14.4528 13.5458c0.8064 -0.6542 0.9297 -1.8381 0.2756 -2.6445a1.8802 1.8802 0 0 0 -0.2756 -0.2756 21.2127 21.2127 0 0 0 -4.3121 -2.776c-1.066 -0.51 -2.256 0.2 -2.4261 1.414a23.5226 23.5226 0 0 0 -0.14 5.5021c0.116 1.23 1.292 1.964 2.372 1.492a19.6285 19.6285 0 0 0 4.5062 -2.704v-0.008zm6.9322 -5.4002c2.0335 2.228 2.0396 5.637 0.014 7.8723A26.1487 26.1487 0 0 1 8.2946 23.846c-2.6848 0.6713 -5.4168 -0.914 -6.1662 -3.5781 -1.524 -5.2002 -1.3 -11.0803 0.17 -16.3045 0.772 -2.744 3.3521 -4.4661 6.0102 -3.832 4.9242 1.174 9.5443 4.196 13.0764 8.0121v0.002z"/>
                        </svg>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium text-white text-sm">Rumble</h3>
                            <span className="text-xs text-gray-500">@{talentProfile.rumble_handle}</span>
                            <button
                              onClick={() => {
                                const newHandle = prompt('Enter Rumble channel handle:', talentProfile.rumble_handle);
                                if (newHandle && newHandle !== talentProfile.rumble_handle) {
                                  supabase
                                    .from('talent_profiles')
                                    .update({ rumble_handle: newHandle })
                                    .eq('id', talentProfile.id)
                                    .then(() => {
                                      setTalentProfile({ ...talentProfile, rumble_handle: newHandle });
                                      toast.success('Rumble channel updated');
                                      setTimeout(refreshPreview, 500);
                                    });
                                }
                              }}
                              className="p-1 text-gray-500 hover:text-white hover:bg-white/10 rounded transition-colors"
                            >
                              <PencilIcon className="h-3 w-3" />
                            </button>
                          </div>
                          <p className="text-xs text-gray-400">Shows your latest video or live stream</p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                        <input
                          type="checkbox"
                          checked={bioSettings?.show_rumble_card !== false}
                          onChange={(e) => {
                            if (bioSettings) {
                              const updated = { ...bioSettings, show_rumble_card: e.target.checked };
                              setBioSettings(updated);
                              supabase
                                .from('bio_settings')
                                .update({ show_rumble_card: e.target.checked })
                                .eq('id', bioSettings.id)
                                .then(() => {
                                  toast.success(e.target.checked ? 'Rumble card enabled' : 'Rumble card disabled');
                                  setTimeout(refreshPreview, 500);
                                });
                            }
                          }}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-500"></div>
                      </label>
                    </div>
                  </div>
                )}

                {/* YouTube Card Toggle - Compact */}
                {talentProfile?.youtube_handle && (
                  <div className="bg-gradient-to-r from-red-500/20 to-rose-500/20 border border-red-500/30 rounded-xl p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 text-red-400 flex-shrink-0">
                          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                        </svg>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium text-white text-sm">YouTube</h3>
                            <span className="text-xs text-gray-500">@{talentProfile.youtube_handle}</span>
                            <button
                              onClick={() => {
                                const newHandle = prompt('Enter YouTube channel handle:', talentProfile.youtube_handle);
                                if (newHandle && newHandle !== talentProfile.youtube_handle) {
                                  supabase
                                    .from('talent_profiles')
                                    .update({ youtube_handle: newHandle })
                                    .eq('id', talentProfile.id)
                                    .then(() => {
                                      setTalentProfile({ ...talentProfile, youtube_handle: newHandle });
                                      toast.success('YouTube channel updated');
                                      setTimeout(refreshPreview, 500);
                                    });
                                }
                              }}
                              className="p-1 text-gray-500 hover:text-white hover:bg-white/10 rounded transition-colors"
                            >
                              <PencilIcon className="h-3 w-3" />
                            </button>
                          </div>
                          <p className="text-xs text-gray-400">Shows your latest video or live stream</p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                        <input
                          type="checkbox"
                          checked={bioSettings?.show_youtube_card !== false}
                          onChange={(e) => {
                            if (bioSettings) {
                              const updated = { ...bioSettings, show_youtube_card: e.target.checked };
                              setBioSettings(updated);
                              supabase
                                .from('bio_settings')
                                .update({ show_youtube_card: e.target.checked })
                                .eq('id', bioSettings.id)
                                .then(() => {
                                  toast.success(e.target.checked ? 'YouTube card enabled' : 'YouTube card disabled');
                                  setTimeout(refreshPreview, 500);
                                });
                            }
                          }}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-red-500"></div>
                      </label>
                    </div>
                  </div>
                )}

                {/* Service Offerings Section */}
                {serviceOfferings.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Services</h3>
                    {serviceOfferings.map((service) => (
                      <div
                        key={service.id}
                        className={`bg-gradient-to-r from-pink-500/20 to-purple-500/20 border border-pink-500/30 rounded-2xl p-4 ${!service.is_active ? 'opacity-50' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-pink-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                              <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-white">
                                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                              </svg>
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-medium text-white">{service.title}</h3>
                              <p className="text-sm text-gray-400">
                                ${(service.pricing / 100).toFixed(0)} • {service.video_length_seconds}s video
                              </p>
                              <div className="flex flex-wrap gap-1 mt-2">
                                {service.benefits.slice(0, 2).map((benefit, i) => (
                                  <span key={i} className="text-xs bg-white/10 text-gray-300 px-2 py-0.5 rounded-full">
                                    {benefit}
                                  </span>
                                ))}
                                {service.benefits.length > 2 && (
                                  <span className="text-xs text-gray-500">+{service.benefits.length - 2} more</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                              <input
                                type="checkbox"
                                checked={service.is_active}
                                onChange={async (e) => {
                                  const updated = serviceOfferings.map(s => 
                                    s.id === service.id ? { ...s, is_active: e.target.checked } : s
                                  );
                                  setServiceOfferings(updated);
                                  await supabase
                                    .from('service_offerings')
                                    .update({ is_active: e.target.checked })
                                    .eq('id', service.id);
                                  toast.success(e.target.checked ? 'Service enabled' : 'Service disabled');
                                  setTimeout(refreshPreview, 500);
                                }}
                                className="sr-only peer"
                              />
                              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pink-500"></div>
                            </label>
                            <button
                              onClick={() => setEditingService(service)}
                              className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                            >
                              <PencilIcon className="h-5 w-5" />
                            </button>
                            <button
                              onClick={async () => {
                                if (window.confirm('Are you sure you want to delete this service?')) {
                                  await supabase.from('service_offerings').delete().eq('id', service.id);
                                  setServiceOfferings(serviceOfferings.filter(s => s.id !== service.id));
                                  toast.success('Service deleted');
                                  setTimeout(refreshPreview, 500);
                                }
                              }}
                              className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                            >
                              <TrashIcon className="h-5 w-5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Events Summary Card */}
                {bioEvents.length > 0 && (
                  <div 
                    onClick={() => setShowAddEventModal(true)}
                    className="bg-gradient-to-r from-orange-500/20 to-amber-500/20 border border-orange-500/30 rounded-xl p-3 cursor-pointer hover:border-orange-500/50 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 text-orange-400 flex-shrink-0">
                          <path fillRule="evenodd" d="M6.75 2.25A.75.75 0 017.5 3v1.5h9V3A.75.75 0 0118 3v1.5h.75a3 3 0 013 3v11.25a3 3 0 01-3 3H5.25a3 3 0 01-3-3V7.5a3 3 0 013-3H6V3a.75.75 0 01.75-.75zm13.5 9a1.5 1.5 0 00-1.5-1.5H5.25a1.5 1.5 0 00-1.5 1.5v7.5a1.5 1.5 0 001.5 1.5h13.5a1.5 1.5 0 001.5-1.5v-7.5z" clipRule="evenodd" />
                        </svg>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium text-white text-sm">Events</h3>
                            <span className="text-xs text-orange-400">{bioEvents.length} event{bioEvents.length !== 1 ? 's' : ''}</span>
                          </div>
                          <p className="text-xs text-gray-400">
                            Next: {(() => {
                              const nextEvent = [...bioEvents]
                                .filter(e => e.is_active)
                                .sort((a, b) => {
                                  if (!a.event_date) return 1;
                                  if (!b.event_date) return -1;
                                  return new Date(a.event_date).getTime() - new Date(b.event_date).getTime();
                                })[0];
                              return nextEvent ? `${nextEvent.title}${nextEvent.event_date ? ` • ${new Date(nextEvent.event_date).toLocaleDateString()}` : ''}` : 'No upcoming events';
                            })()}
                          </p>
                        </div>
                      </div>
                      <PencilIcon className="h-4 w-4 text-gray-500" />
                    </div>
                  </div>
                )}

                {/* ShoutOut Card Info */}
                <div className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-500/30 rounded-2xl p-4">
                  <div className="flex items-start gap-3">
                    <GiftIcon className="h-6 w-6 text-blue-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-medium text-white mb-1">ShoutOut Card</h3>
                      <p className="text-sm text-gray-300">
                        A special card linking to your ShoutOut profile with a random review is always shown at the bottom of your bio page.
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'social' && (
              <div className="space-y-6">
                {/* Add Social Button */}
                <button
                  onClick={() => setShowAddSocialModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition-colors"
                >
                  <PlusIcon className="h-5 w-5" />
                  Add Social Link
                </button>

                {/* Social Links List */}
                <div className="space-y-3">
                  {socialLinks.length === 0 ? (
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
                      <SparklesIcon className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-400 mb-2">No social links yet</h3>
                      <p className="text-gray-500 mb-4">Add your social media profiles to display at the bottom of your bio page</p>
                    </div>
                  ) : (
                    socialLinks.map((social) => {
                      const platform = SOCIAL_PLATFORMS.find(p => p.id === social.platform);
                      return (
                        <div
                          key={social.id}
                          className="bg-white/5 border border-white/10 rounded-xl p-4 transition-all hover:border-white/20"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-white/10 text-blue-400">
                              {platform?.icon || <LinkIcon className="w-6 h-6" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-medium text-white">
                                {platform?.name || social.platform}
                              </h3>
                              <p className="text-sm text-gray-400">@{social.handle}</p>
                              {/* Show follower count if set */}
                              {social.follower_count && social.follower_count > 0 && (
                                <p className="text-xs text-pink-400 mt-1">
                                  {social.follower_count >= 1000000 
                                    ? `${(social.follower_count / 1000000).toFixed(1)}M followers`
                                    : social.follower_count >= 1000 
                                      ? `${(social.follower_count / 1000).toFixed(1)}K followers`
                                      : `${social.follower_count} followers`
                                  }
                                </p>
                              )}
                            </div>
                            <button
                              onClick={async () => {
                                const updated = socialLinks.filter(s => s.id !== social.id);
                                setSocialLinks(updated);
                                
                                // Build the update object
                                const updateData: Record<string, unknown> = { social_accounts: updated };
                                
                                // If removing YouTube, also clear youtube_handle
                                if (social.platform === 'youtube') {
                                  updateData.youtube_handle = null;
                                  setTalentProfile(prev => prev ? { ...prev, youtube_handle: undefined } : prev);
                                }
                                
                                // If removing Rumble, also clear rumble_handle
                                if (social.platform === 'rumble') {
                                  updateData.rumble_handle = null;
                                  setTalentProfile(prev => prev ? { ...prev, rumble_handle: undefined } : prev);
                                }
                                
                                await supabase
                                  .from('talent_profiles')
                                  .update(updateData)
                                  .eq('id', talentProfile?.id);
                                toast.success('Social link removed');
                                setTimeout(refreshPreview, 500);
                              }}
                              className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                            >
                              <TrashIcon className="h-5 w-5" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Info about social icons */}
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-2xl p-4">
                  <div className="flex items-start gap-3">
                    <SparklesIcon className="h-6 w-6 text-blue-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-medium text-white mb-1">Social Icons</h3>
                      <p className="text-sm text-gray-300">
                        Social links appear as icons at the bottom of your bio page, just above the footer.
                        They're automatically imported when you use the Import Links feature.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'style' && (
              <div className="space-y-6">
                {/* Background Gradient */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <SwatchIcon className="h-5 w-5 text-purple-400" />
                    Background
                  </h3>
                  <div className="grid grid-cols-4 gap-3">
                    {GRADIENT_PRESETS.map((preset) => (
                      <button
                        key={preset.name}
                        onClick={() => saveSettings({
                          gradient_start: preset.start,
                          gradient_end: preset.end,
                          gradient_direction: preset.direction,
                        })}
                        className={`aspect-square rounded-xl border-2 transition-all ${
                          bioSettings?.gradient_start === preset.start && bioSettings?.gradient_end === preset.end
                            ? 'border-white scale-105'
                            : 'border-transparent hover:border-white/50'
                        }`}
                        style={{
                          background: `linear-gradient(${preset.direction === 'to-b' ? '180deg' : '135deg'}, ${preset.start}, ${preset.end})`
                        }}
                        title={preset.name}
                      />
                    ))}
                  </div>
                </div>

                {/* Button Color */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <PaintBrushIcon className="h-5 w-5 text-blue-400" />
                    Button Color
                  </h3>
                  <div className="flex flex-wrap gap-3">
                    {BUTTON_COLORS.map((color) => (
                      <button
                        key={color.name}
                        onClick={() => saveSettings({ button_color: color.value })}
                        className={`w-10 h-10 rounded-full border-2 transition-all ${
                          bioSettings?.button_color === color.value
                            ? 'border-white scale-110'
                            : 'border-transparent hover:scale-105'
                        }`}
                        style={{ backgroundColor: color.value }}
                        title={color.name}
                      />
                    ))}
                  </div>
                </div>

                {/* Button Style */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Button Style</h3>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { id: 'rounded', label: 'Rounded', className: 'rounded-xl' },
                      { id: 'pill', label: 'Pill', className: 'rounded-full' },
                      { id: 'square', label: 'Square', className: 'rounded-md' },
                    ].map((style) => (
                      <button
                        key={style.id}
                        onClick={() => saveSettings({ button_style: style.id })}
                        className={`p-4 border-2 transition-all ${style.className} ${
                          bioSettings?.button_style === style.id
                            ? 'border-blue-500 bg-blue-500/20'
                            : 'border-white/20 hover:border-white/40'
                        }`}
                      >
                        <div 
                          className={`h-8 ${style.className}`}
                          style={{ backgroundColor: bioSettings?.button_color || '#3b82f6' }}
                        />
                        <p className="text-xs text-gray-400 mt-2">{style.label}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Card Style */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Card Style</h3>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { id: 'glass', label: 'Glass', desc: 'Transparent with blur' },
                      { id: 'solid', label: 'Solid', desc: 'Opaque background' },
                      { id: 'outline', label: 'Outline', desc: 'Border only' },
                    ].map((style) => (
                      <button
                        key={style.id}
                        onClick={() => saveSettings({ card_style: style.id })}
                        className={`p-4 border-2 rounded-xl text-left transition-all ${
                          bioSettings?.card_style === style.id
                            ? 'border-blue-500 bg-blue-500/20'
                            : 'border-white/20 hover:border-white/40'
                        }`}
                      >
                        <p className="font-medium text-white">{style.label}</p>
                        <p className="text-xs text-gray-400">{style.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="space-y-6">
                {/* Profile Settings */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Profile</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Display Name</label>
                      <div className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white">
                        {talentProfile?.full_name || 'Your name'}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        This is pulled from your ShoutOut profile. Update it there to change it here.
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">One-liner / Tagline</label>
                      <input
                        type="text"
                        value={bioSettings?.one_liner || ''}
                        onChange={(e) => setBioSettings({ ...bioSettings!, one_liner: e.target.value })}
                        onBlur={() => saveSettings({ one_liner: bioSettings?.one_liner })}
                        placeholder="Your catchy tagline..."
                        maxLength={100}
                        className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">{bioSettings?.one_liner?.length || 0}/100</p>
                    </div>
                  </div>
                </div>

                {/* Newsletter Integration */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                      <EnvelopeIcon className="h-5 w-5 text-green-400" />
                      Newsletter Integration
                    </h3>
                    <button
                      onClick={() => setShowNewsletterModal(true)}
                      className="text-sm text-blue-400 hover:text-blue-300"
                    >
                      Configure
                    </button>
                  </div>
                  <p className="text-sm text-gray-400 mb-4">
                    Connect your email service to collect subscribers directly from your bio page.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {NEWSLETTER_PROVIDERS.map((provider) => {
                      const config = newsletterConfigs.find(c => c.provider === provider.id);
                      return (
                        <div
                          key={provider.id}
                          className={`px-3 py-1.5 rounded-lg text-sm ${
                            config?.is_active
                              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                              : 'bg-white/5 text-gray-500 border border-white/10'
                          }`}
                        >
                          {provider.icon} {provider.name}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Live Preview */}
          <div className="lg:sticky lg:top-24 lg:self-start">
            <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
              {/* Browser Chrome */}
              <div className="bg-gray-900/80 px-3 py-2 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500/60"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-500/60"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500/60"></div>
                  </div>
                  <div className="flex-1 flex items-center gap-2 bg-white/5 rounded-lg px-3 py-1.5 ml-2">
                    <button
                      onClick={copyBioUrl}
                      className="text-gray-400 hover:text-white transition-colors text-xs truncate flex-1 text-left cursor-pointer"
                      title="Click to copy URL"
                    >
                      {bioUrl}
                    </button>
                    <button
                      onClick={copyBioUrl}
                      className="text-gray-400 hover:text-white transition-colors"
                      title="Copy URL"
                    >
                      <ClipboardIcon className="h-4 w-4" />
                    </button>
                    <a
                      href={`https://${bioUrl}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-400 hover:text-white transition-colors"
                      title="Open in new tab"
                    >
                      <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                    </a>
                  </div>
                </div>
              </div>
              
              {/* Iframe Embed */}
              <div className="relative w-full" style={{ height: '680px' }}>
                {bioSettings?.is_published ? (
                  <iframe
                    id="bio-preview-iframe"
                    key={previewKey}
                    src={`https://${bioUrl}?t=${previewKey}`}
                    className="w-full h-full border-0"
                    title="Bio Preview"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center"
                    style={{
                      background: `linear-gradient(${bioSettings?.gradient_direction === 'to-b' ? '180deg' : '135deg'}, ${bioSettings?.gradient_start || '#0a0a0a'}, ${bioSettings?.gradient_end || '#1a1a2e'})`
                    }}
                  >
                    <EyeIcon className="h-12 w-12 text-gray-500 mb-4" />
                    <h3 className="text-lg font-semibold text-white mb-2">Preview Not Available</h3>
                    <p className="text-gray-400 text-sm mb-4">
                      Publish your bio page to see the live preview here.
                    </p>
                    <button
                      onClick={togglePublish}
                      disabled={saving}
                      className="px-6 py-2 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition-colors"
                    >
                      Publish Now
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
          </>
        ) : (
          /* Send Updates View */
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Left Column - Email Composer */}
            <div className="space-y-6">
              {/* Stats */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                    <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-white">{subscriberCount}</p>
                    <p className="text-gray-400 text-sm">Subscribers</p>
                  </div>
                </div>
              </div>

              {/* Email Composer */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
                <h3 className="text-lg font-semibold text-white">Compose Update</h3>
                
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Subject</label>
                  <input
                    type="text"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    placeholder="What's new this week..."
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Content</label>
                  <textarea
                    value={emailContent}
                    onChange={(e) => setEmailContent(e.target.value)}
                    placeholder="Share your latest news, upcoming events, or anything you want your subscribers to know..."
                    rows={6}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Button Text (optional)</label>
                    <input
                      type="text"
                      value={emailButtonText}
                      onChange={(e) => setEmailButtonText(e.target.value)}
                      placeholder="Learn More"
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Button URL</label>
                    <input
                      type="url"
                      value={emailButtonUrl}
                      onChange={(e) => setEmailButtonUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Image URL (optional)</label>
                  <input
                    type="url"
                    value={emailImageUrl}
                    onChange={(e) => setEmailImageUrl(e.target.value)}
                    placeholder="https://example.com/image.jpg"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50"
                  />
                </div>

                {/* Schedule Section */}
                <div className="border-t border-white/10 pt-4">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-400 mb-3">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Schedule Send (optional)
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="date"
                      value={emailScheduledDate}
                      onChange={(e) => setEmailScheduledDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-blue-500/50"
                    />
                    <input
                      type="time"
                      value={emailScheduledTime}
                      onChange={(e) => setEmailScheduledTime(e.target.value)}
                      className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-blue-500/50"
                    />
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setEmailDraftSaved(true);
                      toast.success('Draft saved!');
                      setTimeout(() => setEmailDraftSaved(false), 3000);
                    }}
                    disabled={!emailSubject && !emailContent}
                    className="flex-1 py-3 bg-white/5 border border-white/10 text-gray-300 rounded-xl font-medium hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {emailDraftSaved ? (
                      <>
                        <CheckIcon className="w-4 h-4 text-green-400" />
                        Saved
                      </>
                    ) : (
                      'Save Draft'
                    )}
                  </button>
                  <button
                    onClick={() => {
                      if (!emailSubject || !emailContent) {
                        toast.error('Please add a subject and content');
                        return;
                      }
                      if (emailScheduledDate && emailScheduledTime) {
                        toast.success(`Email scheduled for ${emailScheduledDate} at ${emailScheduledTime}`);
                      } else {
                        toast.success('Email updates coming soon!');
                      }
                    }}
                    disabled={subscriberCount === 0}
                    className="flex-1 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-xl font-medium hover:from-blue-600 hover:to-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {subscriberCount === 0 
                      ? 'No Subscribers Yet' 
                      : emailScheduledDate && emailScheduledTime 
                        ? 'Schedule Send'
                        : `Send Now (${subscriberCount})`}
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column - Email Preview */}
            <div className="lg:sticky lg:top-24 lg:self-start">
              <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                {/* Browser Chrome */}
                <div className="bg-gray-900/80 px-3 py-2 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-red-500/60"></div>
                      <div className="w-3 h-3 rounded-full bg-yellow-500/60"></div>
                      <div className="w-3 h-3 rounded-full bg-green-500/60"></div>
                    </div>
                    <div className="flex-1 flex items-center gap-2 bg-white/5 rounded-lg px-3 py-1.5 ml-2">
                      <span className="text-gray-400 text-xs">Email Preview</span>
                    </div>
                  </div>
                </div>
                
                {/* Email Preview */}
                <div 
                  className="p-6 overflow-y-auto"
                  style={{ 
                    height: '680px',
                    background: `linear-gradient(${bioSettings?.gradient_direction === 'to-b' ? '180deg' : '135deg'}, ${bioSettings?.gradient_start || '#0a0a0a'}, ${bioSettings?.gradient_end || '#1a1a2e'})`
                  }}
                >
                  {/* Email Content */}
                  <div className="max-w-md mx-auto space-y-6">
                    {/* Header with profile */}
                    <div className="text-center">
                      <div className="w-20 h-20 mx-auto mb-4 rounded-full overflow-hidden border-2 border-white/20 shadow-xl">
                        {talentProfile?.temp_avatar_url || bioSettings?.profile_image_url ? (
                          <img 
                            src={talentProfile?.temp_avatar_url || bioSettings?.profile_image_url} 
                            alt={talentProfile?.full_name || ''} 
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-2xl text-white font-bold">
                            {(talentProfile?.full_name || 'C')[0]}
                          </div>
                        )}
                      </div>
                      <h2 className="text-xl font-bold text-white">{talentProfile?.full_name || 'Creator'}</h2>
                    </div>

                    {/* Subject */}
                    {emailSubject && (
                      <h1 className="text-2xl font-bold text-white text-center">{emailSubject}</h1>
                    )}

                    {/* Image */}
                    {emailImageUrl && (
                      <div className="rounded-xl overflow-hidden">
                        <img src={emailImageUrl} alt="" className="w-full h-auto" />
                      </div>
                    )}

                    {/* Content */}
                    {emailContent ? (
                      <div className="text-gray-300 whitespace-pre-wrap leading-relaxed">
                        {emailContent}
                      </div>
                    ) : (
                      <div className="text-gray-500 italic text-center py-8">
                        Your message will appear here...
                      </div>
                    )}

                    {/* Button */}
                    {emailButtonText && emailButtonUrl && (
                      <div className="text-center">
                        <a
                          href={emailButtonUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block px-8 py-3 rounded-full font-medium transition-colors"
                          style={{
                            backgroundColor: bioSettings?.button_color || '#3b82f6',
                            color: '#ffffff'
                          }}
                        >
                          {emailButtonText}
                        </a>
                      </div>
                    )}

                    {/* Divider */}
                    <div className="border-t border-white/10 pt-6 mt-6 space-y-4">
                      {/* Connect Card - Show bio links preview */}
                      <div 
                        className="p-5 rounded-2xl overflow-hidden relative"
                        style={{
                          background: 'rgba(255,255,255,0.05)',
                          border: '1px solid rgba(255,255,255,0.15)'
                        }}
                      >
                        <p className="text-white font-semibold text-sm mb-3">✨ More ways to connect</p>
                        
                        {/* Show up to 3 bio links as preview */}
                        <div className="space-y-2 mb-3">
                          {links.filter(l => l.is_active && l.link_type === 'basic').slice(0, 3).map((link, i) => (
                            <div 
                              key={i}
                              className="flex items-center gap-2 text-xs text-gray-300 bg-black/30 rounded-lg px-3 py-2"
                            >
                              {link.icon_url ? (
                                <img src={link.icon_url} alt="" className="w-4 h-4 rounded" />
                              ) : (
                                <LinkIcon className="w-4 h-4 text-gray-400" />
                              )}
                              <span className="truncate">{link.title || 'Link'}</span>
                            </div>
                          ))}
                          {links.filter(l => l.is_active && l.link_type === 'basic').length === 0 && (
                            <p className="text-gray-500 text-xs italic">Add links to your bio to show them here</p>
                          )}
                          {links.filter(l => l.is_active && l.link_type === 'basic').length > 3 && (
                            <p className="text-gray-400 text-xs">+{links.filter(l => l.is_active && l.link_type === 'basic').length - 3} more links</p>
                          )}
                        </div>
                        
                        <a
                          href={`https://${bioUrl}`}
                          className="inline-flex items-center gap-1 text-sm font-medium px-4 py-2 rounded-full transition-colors bg-gradient-to-r from-blue-500 to-purple-500 text-white"
                        >
                          Visit my bio
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </a>
                      </div>

                      {/* ShoutOut Card - Redesigned with flush image */}
                      <a
                        href={`https://shoutout.us/${talentProfile?.username || talentProfile?.id}`}
                        className="block rounded-2xl bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-500/30 hover:border-blue-500/50 transition-colors overflow-hidden"
                      >
                        <div className="flex items-stretch">
                          {/* Image flush to edges with play button */}
                          <div className="w-24 flex-shrink-0 relative bg-black/30">
                            {talentProfile?.temp_avatar_url || bioSettings?.profile_image_url ? (
                              <img 
                                src={talentProfile?.temp_avatar_url || bioSettings?.profile_image_url} 
                                alt="" 
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                                <GiftIcon className="w-8 h-8 text-white" />
                              </div>
                            )}
                            {/* Play button overlay */}
                            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                              <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
                                <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M8 5v14l11-7z"/>
                                </svg>
                              </div>
                            </div>
                          </div>
                          
                          {/* Content */}
                          <div className="flex-1 p-4 min-w-0">
                            <p className="text-white text-sm font-semibold mb-1">Get a Personalized Video Shoutout</p>
                            
                            {/* Show review */}
                            {randomReview ? (
                              <div>
                                <div className="flex items-center gap-0.5 mb-1">
                                  {[...Array(5)].map((_, i) => (
                                    <svg 
                                      key={i} 
                                      className={`w-3 h-3 ${i < randomReview.rating ? 'text-yellow-400' : 'text-gray-600'}`} 
                                      fill="currentColor" 
                                      viewBox="0 0 20 20"
                                    >
                                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                    </svg>
                                  ))}
                                </div>
                                {randomReview.comment && (
                                  <p className="text-gray-300 text-xs line-clamp-2">
                                    "{randomReview.comment.split('\n')[0]}"
                                  </p>
                                )}
                                {randomReview.users?.full_name && (
                                  <p className="text-gray-500 text-[10px] mt-1">
                                    — {randomReview.users.full_name}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <p className="text-gray-400 text-xs">Book a personalized video message</p>
                            )}
                          </div>
                        </div>
                      </a>
                    </div>

                    {/* Footer */}
                    <div className="text-center pt-4">
                      <p className="text-gray-500 text-xs">
                        Powered by <a href="https://shoutout.us/creators" className="text-gray-400 hover:text-white transition-colors">ShoutOut</a>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showAddModal && (
        <AddLinkModal
          onClose={() => setShowAddModal(false)}
          onAdd={addLink}
          onAddMultiple={addMultipleLinks}
          talentId={talentProfile?.id || ''}
        />
      )}

      {editingLink && (
        <EditLinkModal
          link={editingLink}
          onClose={() => setEditingLink(null)}
          onSave={updateLink}
        />
      )}

      {showNewsletterModal && (
        <NewsletterModal
          configs={newsletterConfigs}
          talentId={talentProfile?.id || ''}
          onClose={() => setShowNewsletterModal(false)}
          onSave={setNewsletterConfigs}
        />
      )}

      {showImportModal && (
        <ImportModal
          onClose={() => setShowImportModal(false)}
          onImport={importFromUrl}
        />
      )}

      {showAddSocialModal && (
        <AddSocialModal
          onClose={() => setShowAddSocialModal(false)}
          onAdd={async (social) => {
            const newSocial: SocialAccount = {
              id: `social-${Date.now()}`,
              platform: social.platform as SocialAccount['platform'],
              handle: social.handle,
            };
            const updated = [...socialLinks, newSocial];
            setSocialLinks(updated);
            
            // Build the update object
            const updateData: Record<string, unknown> = { social_accounts: updated };
            
            // If adding YouTube, also set youtube_handle for the card feature
            if (social.platform === 'youtube') {
              updateData.youtube_handle = social.handle.replace(/^@/, '');
              // Update local state so the card toggle shows immediately
              setTalentProfile(prev => prev ? { ...prev, youtube_handle: social.handle.replace(/^@/, '') } : prev);
            }
            
            // If adding Rumble, also set rumble_handle for the card feature
            if (social.platform === 'rumble') {
              updateData.rumble_handle = social.handle.replace(/^@/, '');
              // Update local state so the card toggle shows immediately
              setTalentProfile(prev => prev ? { ...prev, rumble_handle: social.handle.replace(/^@/, '') } : prev);
            }
            
            await supabase
              .from('talent_profiles')
              .update(updateData)
              .eq('id', talentProfile?.id);
            toast.success('Social link added!');
            setTimeout(refreshPreview, 500);
            setShowAddSocialModal(false);
          }}
          existingPlatforms={socialLinks.map(s => s.platform)}
        />
      )}

      {(showAddServiceModal || editingService) && (
        <AddServiceModal
          service={editingService || undefined}
          socialLinks={socialLinks}
          onUpdateFollowerCount={async (socialId: string, count: number) => {
            // Update local state
            setSocialLinks(prev => prev.map(s => 
              s.id === socialId ? { ...s, follower_count: count } : s
            ));
            // Save to database
            await supabase
              .from('social_accounts')
              .update({ follower_count: count })
              .eq('id', socialId);
          }}
          onClose={() => {
            setShowAddServiceModal(false);
            setEditingService(null);
          }}
          onSave={async (service) => {
            if (editingService) {
              // Update existing service
              const { error } = await supabase
                .from('service_offerings')
                .update({
                  title: service.title,
                  pricing: service.pricing,
                  video_length_seconds: service.video_length_seconds,
                  benefits: service.benefits,
                  platforms: service.platforms,
                  description: service.description,
                  is_active: service.is_active,
                })
                .eq('id', editingService.id);
              
              if (error) {
                toast.error('Failed to update service');
                return;
              }
              
              setServiceOfferings(serviceOfferings.map(s => 
                s.id === editingService.id ? { ...s, ...service } : s
              ));
              toast.success('Service updated!');
            } else {
              // Create new service
              const { data, error } = await supabase
                .from('service_offerings')
                .insert([{
                  talent_id: talentProfile?.id,
                  service_type: service.service_type,
                  title: service.title,
                  pricing: service.pricing,
                  video_length_seconds: service.video_length_seconds,
                  benefits: service.benefits,
                  platforms: service.platforms,
                  description: service.description,
                  is_active: service.is_active,
                  display_order: serviceOfferings.length,
                }])
                .select()
                .single();
              
              if (error) {
                toast.error('Failed to create service');
                return;
              }
              
              setServiceOfferings([...serviceOfferings, { ...data, benefits: service.benefits, platforms: service.platforms }]);
              toast.success('Service created!');
            }
            
            setShowAddServiceModal(false);
            setEditingService(null);
            setTimeout(refreshPreview, 500);
          }}
        />
      )}

      {showAddEventModal && talentProfile && (
        <AddEventModal
          events={bioEvents}
          talentId={talentProfile.id}
          onClose={() => {
            setShowAddEventModal(false);
            setTimeout(refreshPreview, 500);
          }}
          onEventsChange={(newEvents) => {
            setBioEvents(newEvents);
          }}
        />
      )}
    </div>
  );
};

// Grid link data for carousel
interface GridLinkData {
  title: string;
  url: string;
  thumbnailUrl: string;
}

// Add Link Modal
const AddLinkModal: React.FC<{
  onClose: () => void;
  onAdd: (link: Omit<BioLink, 'id' | 'display_order'>) => void;
  onAddMultiple?: (links: Omit<BioLink, 'id' | 'display_order'>[]) => void;
  talentId: string;
}> = ({ onClose, onAdd, onAddMultiple, talentId }) => {
  const [linkType, setLinkType] = useState<'basic' | 'grid' | 'sponsor'>('basic');
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [gridColumns, setGridColumns] = useState(2);
  const [isFeatured, setIsFeatured] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [linkFormat, setLinkFormat] = useState<'thin' | 'tall' | 'square'>('thin');
  const [gridFormat, setGridFormat] = useState<'thin' | 'tall' | 'square'>('square'); // Default to square for grids
  
  // Grid carousel state
  const [currentGridSlot, setCurrentGridSlot] = useState(0);
  const [gridLinks, setGridLinks] = useState<GridLinkData[]>([
    { title: '', url: '', thumbnailUrl: '' },
    { title: '', url: '', thumbnailUrl: '' },
  ]);

  // Update grid links array when columns change
  useEffect(() => {
    if (linkType === 'grid') {
      setGridLinks(prevLinks => {
        const newGridLinks = Array(gridColumns).fill(null).map((_, i) => 
          prevLinks[i] || { title: '', url: '', thumbnailUrl: '' }
        );
        return newGridLinks;
      });
      setCurrentGridSlot(prev => prev >= gridColumns ? gridColumns - 1 : prev);
    }
  }, [gridColumns, linkType]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, slotIndex?: number) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const result = await uploadImageToWasabi(file, `bio-images/${talentId}`);
      if (result.success && result.imageUrl) {
        if (linkType === 'grid' && slotIndex !== undefined) {
          const newGridLinks = [...gridLinks];
          newGridLinks[slotIndex] = { ...newGridLinks[slotIndex], thumbnailUrl: result.imageUrl };
          setGridLinks(newGridLinks);
        } else {
          setThumbnailUrl(result.imageUrl);
        }
        toast.success('Image uploaded!');
      } else {
        toast.error(result.error || 'Upload failed');
      }
    } catch (error) {
      toast.error('Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  // Helper to auto-add https://
  const ensureHttps = (inputUrl: string) => {
    if (!inputUrl) return inputUrl;
    if (inputUrl.startsWith('http://') || inputUrl.startsWith('https://')) return inputUrl;
    return 'https://' + inputUrl;
  };

  // Auto-add https:// when URL loses focus
  const handleUrlBlur = () => {
    if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
      setUrl('https://' + url);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (linkType === 'grid' && onAddMultiple) {
      // Add all grid links at once
      const validLinks = gridLinks
        .filter(gl => gl.title || gl.url || gl.thumbnailUrl)
        .map(gl => ({
          talent_id: talentId,
          link_type: 'grid' as const,
          title: gl.title,
          url: ensureHttps(gl.url),
          thumbnail_url: gl.thumbnailUrl || undefined,
          grid_columns: gridColumns,
          is_active: true,
          is_featured: false,
          link_format: gridFormat, // Apply the chosen format to grid cards
        }));
      
      if (validLinks.length > 0) {
        onAddMultiple(validLinks);
      } else {
        toast.error('Please fill in at least one grid card');
      }
    } else {
      onAdd({
        talent_id: talentId,
        link_type: linkType,
        title,
        url: ensureHttps(url),
        thumbnail_url: thumbnailUrl || undefined,
        grid_columns: gridColumns,
        is_active: true,
        is_featured: linkType === 'basic' ? isFeatured : false,
        link_format: linkType === 'basic' ? linkFormat : undefined,
      });
    }
  };

  const updateGridLink = (index: number, field: keyof GridLinkData, value: string) => {
    const newGridLinks = [...gridLinks];
    newGridLinks[index] = { ...newGridLinks[index], [field]: value };
    setGridLinks(newGridLinks);
  };

  const linkTypes = [
    { type: 'basic' as const, label: 'Basic Link', icon: LinkIcon, color: 'blue', desc: 'Simple link with title' },
    { type: 'grid' as const, label: 'Grid Card', icon: Squares2X2Icon, color: 'purple', desc: 'Image card with link' },
    { type: 'sponsor' as const, label: 'Become a Sponsor', icon: GiftIcon, color: 'yellow', desc: 'Sponsorship CTA' },
  ];

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1a1a] border border-white/20 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Add New Link</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Link Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">Link Type</label>
            <div className="grid grid-cols-2 gap-2">
              {linkTypes.map((lt) => (
                <button
                  key={lt.type}
                  type="button"
                  onClick={() => setLinkType(lt.type)}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    linkType === lt.type
                      ? 'border-blue-500 bg-blue-500/20'
                      : 'border-white/20 hover:border-white/40'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <lt.icon className="h-5 w-5 text-blue-400" />
                    <span className="text-sm font-medium text-white">{lt.label}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{lt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Basic Link Fields */}
          {linkType !== 'grid' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="My Website"
                  className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">URL</label>
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onBlur={handleUrlBlur}
                  placeholder="example.com"
                  className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">https:// will be added automatically</p>
              </div>

              {/* Image Upload for basic links */}
              {linkType === 'basic' && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Icon/Image (optional)</label>
                  
                  {thumbnailUrl ? (
                    <div className="flex items-center gap-4">
                      <img src={thumbnailUrl} alt="Preview" className="w-16 h-16 rounded-lg object-cover" />
                      <button type="button" onClick={() => setThumbnailUrl('')} className="text-sm text-red-400 hover:text-red-300">
                        Remove
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-white/20 rounded-xl cursor-pointer hover:border-white/40 transition-colors">
                      <div className="flex flex-col items-center justify-center">
                        {uploading ? (
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                        ) : (
                          <>
                            <CloudArrowUpIcon className="h-8 w-8 text-gray-400 mb-1" />
                            <p className="text-xs text-gray-400">Upload image</p>
                          </>
                        )}
                      </div>
                      <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e)} disabled={uploading} />
                    </label>
                  )}
                </div>
              )}

              {/* Link Format for basic links */}
              {linkType === 'basic' && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Link Format</label>
                  <div className="grid grid-cols-3 gap-3">
                    {/* Thin */}
                    <button
                      type="button"
                      onClick={() => setLinkFormat('thin')}
                      className={`p-3 rounded-xl transition-all ${
                        linkFormat === 'thin'
                          ? 'bg-blue-500/20 border-2 border-blue-500'
                          : 'bg-white/5 border-2 border-white/10 hover:border-white/30'
                      }`}
                    >
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-full h-6 bg-current opacity-40 rounded flex items-center px-2">
                          <div className="w-3 h-3 bg-white/60 rounded mr-2" />
                          <div className="flex-1 h-2 bg-white/40 rounded" />
                        </div>
                        <span className="text-xs text-gray-300">Thin</span>
                      </div>
                    </button>
                    
                    {/* Tall */}
                    <button
                      type="button"
                      onClick={() => setLinkFormat('tall')}
                      className={`p-3 rounded-xl transition-all ${
                        linkFormat === 'tall'
                          ? 'bg-blue-500/20 border-2 border-blue-500'
                          : 'bg-white/5 border-2 border-white/10 hover:border-white/30'
                      }`}
                    >
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-full h-12 bg-current opacity-40 rounded flex items-center px-2">
                          <div className="w-8 h-8 bg-white/60 rounded mr-2" />
                          <div className="flex-1">
                            <div className="h-2 bg-white/40 rounded mb-1" />
                            <div className="h-1.5 bg-white/20 rounded w-2/3" />
                          </div>
                        </div>
                        <span className="text-xs text-gray-300">Tall</span>
                      </div>
                    </button>
                    
                    {/* Square (no title) */}
                    <button
                      type="button"
                      onClick={() => setLinkFormat('square')}
                      className={`p-3 rounded-xl transition-all ${
                        linkFormat === 'square'
                          ? 'bg-blue-500/20 border-2 border-blue-500'
                          : 'bg-white/5 border-2 border-white/10 hover:border-white/30'
                      }`}
                    >
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-10 h-10 bg-current opacity-40 rounded flex items-center justify-center">
                          <div className="w-6 h-6 bg-white/60 rounded" />
                        </div>
                        <span className="text-xs text-gray-300">Square</span>
                      </div>
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    {linkFormat === 'square' ? 'Image only, no title displayed' : 'Choose how your link appears'}
                  </p>
                </div>
              )}

              {/* Featured option for basic links */}
              {linkType === 'basic' && (
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isFeatured}
                    onChange={(e) => setIsFeatured(e.target.checked)}
                    className="w-5 h-5 rounded bg-white/10 border-white/20 text-yellow-500 focus:ring-yellow-500"
                  />
                  <div className="flex items-center gap-2">
                    <span className="text-white">Featured link</span>
                    <span className="text-yellow-400">⭐</span>
                  </div>
                  <span className="text-xs text-gray-400">(gradient highlight)</span>
                </label>
              )}
            </>
          )}

          {/* Grid Link Fields with Carousel */}
          {linkType === 'grid' && (
            <>
              {/* Grid Layout Selection - Only 2 or 3 columns */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Grid Layout</label>
                <div className="grid grid-cols-2 gap-3">
                  {/* 2 Columns (1x2) */}
                  <button
                    type="button"
                    onClick={() => setGridColumns(2)}
                    className={`p-3 rounded-xl transition-all ${
                      gridColumns === 2 ? 'bg-blue-500/20 border-2 border-blue-500' : 'bg-white/5 border-2 border-white/10 hover:border-white/30'
                    }`}
                  >
                    <div className="grid grid-cols-2 gap-1 mb-2">
                      <div className="aspect-square bg-current opacity-40 rounded" />
                      <div className="aspect-square bg-current opacity-40 rounded" />
                    </div>
                    <div className="text-xs text-center text-gray-300">1×2</div>
                  </button>
                  
                  {/* 4 Columns (2x2) */}
                  <button
                    type="button"
                    onClick={() => setGridColumns(4)}
                    className={`p-3 rounded-xl transition-all ${
                      gridColumns === 4 ? 'bg-blue-500/20 border-2 border-blue-500' : 'bg-white/5 border-2 border-white/10 hover:border-white/30'
                    }`}
                  >
                    <div className="grid grid-cols-2 gap-1 mb-2">
                      <div className="aspect-square bg-current opacity-40 rounded" />
                      <div className="aspect-square bg-current opacity-40 rounded" />
                      <div className="aspect-square bg-current opacity-40 rounded" />
                      <div className="aspect-square bg-current opacity-40 rounded" />
                    </div>
                    <div className="text-xs text-center text-gray-300">2×2</div>
                  </button>
                </div>
              </div>

              {/* Card Format Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Card Format</label>
                <div className="grid grid-cols-3 gap-3">
                  {/* Thin */}
                  <button
                    type="button"
                    onClick={() => setGridFormat('thin')}
                    className={`p-3 rounded-xl transition-all ${
                      gridFormat === 'thin'
                        ? 'bg-purple-500/20 border-2 border-purple-500'
                        : 'bg-white/5 border-2 border-white/10 hover:border-white/30'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-full h-6 bg-current opacity-40 rounded flex items-center px-2">
                        <div className="w-3 h-3 bg-white/60 rounded mr-2" />
                        <div className="flex-1 h-2 bg-white/40 rounded" />
                      </div>
                      <span className="text-xs text-gray-300">Thin</span>
                    </div>
                  </button>
                  
                  {/* Tall */}
                  <button
                    type="button"
                    onClick={() => setGridFormat('tall')}
                    className={`p-3 rounded-xl transition-all ${
                      gridFormat === 'tall'
                        ? 'bg-purple-500/20 border-2 border-purple-500'
                        : 'bg-white/5 border-2 border-white/10 hover:border-white/30'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-full h-12 bg-current opacity-40 rounded overflow-hidden">
                        <div className="w-full h-6 bg-white/60" />
                        <div className="px-2 py-1">
                          <div className="h-1.5 bg-white/40 rounded w-2/3" />
                        </div>
                      </div>
                      <span className="text-xs text-gray-300">Tall</span>
                    </div>
                  </button>
                  
                  {/* Square (no title) */}
                  <button
                    type="button"
                    onClick={() => setGridFormat('square')}
                    className={`p-3 rounded-xl transition-all ${
                      gridFormat === 'square'
                        ? 'bg-purple-500/20 border-2 border-purple-500'
                        : 'bg-white/5 border-2 border-white/10 hover:border-white/30'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-10 h-10 bg-current opacity-40 rounded flex items-center justify-center">
                        <div className="w-6 h-6 bg-white/60 rounded" />
                      </div>
                      <span className="text-xs text-gray-300">Square</span>
                    </div>
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  {gridFormat === 'square' ? 'Image only, no title displayed' : 
                   gridFormat === 'tall' ? 'Image with title below' : 'Compact card with title'}
                </p>
              </div>

              {/* Carousel Navigation */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-300">
                  Card {currentGridSlot + 1} of {gridColumns}
                </span>
                <div className="flex items-center gap-2">
                  {Array(gridColumns).fill(null).map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setCurrentGridSlot(i)}
                      className={`w-2.5 h-2.5 rounded-full transition-all ${
                        currentGridSlot === i ? 'bg-blue-500 w-6' : 'bg-white/30 hover:bg-white/50'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Carousel Card Editor */}
              <div className="relative">
                <div className="flex items-center">
                  {/* Left Arrow */}
                  <button
                    type="button"
                    onClick={() => setCurrentGridSlot(Math.max(0, currentGridSlot - 1))}
                    disabled={currentGridSlot === 0}
                    className={`p-2 rounded-lg mr-2 transition-colors ${
                      currentGridSlot === 0 ? 'text-gray-600 cursor-not-allowed' : 'text-white hover:bg-white/10'
                    }`}
                  >
                    <ChevronLeftIcon className="h-6 w-6" />
                  </button>

                  {/* Card Content */}
                  <div className="flex-1 bg-white/5 border border-white/20 rounded-xl p-4 space-y-4">
                    <div className="text-center text-sm font-medium text-blue-400 mb-3">
                      Grid Card {currentGridSlot + 1}
                    </div>

                    {/* Image Upload */}
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-2">Image</label>
                      {gridLinks[currentGridSlot]?.thumbnailUrl ? (
                        <div className="flex items-center gap-3">
                          <img 
                            src={gridLinks[currentGridSlot].thumbnailUrl} 
                            alt="Preview" 
                            className="w-20 h-20 rounded-lg object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => updateGridLink(currentGridSlot, 'thumbnailUrl', '')}
                            className="text-xs text-red-400 hover:text-red-300"
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-white/20 rounded-xl cursor-pointer hover:border-white/40 transition-colors">
                          {uploading ? (
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                          ) : (
                            <>
                              <CloudArrowUpIcon className="h-8 w-8 text-gray-400 mb-1" />
                              <p className="text-xs text-gray-400">Upload image</p>
                            </>
                          )}
                          <input 
                            type="file" 
                            className="hidden" 
                            accept="image/*"
                            onChange={(e) => handleImageUpload(e, currentGridSlot)}
                            disabled={uploading}
                          />
                        </label>
                      )}
                    </div>

                    {/* Title */}
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">Title</label>
                      <input
                        type="text"
                        value={gridLinks[currentGridSlot]?.title || ''}
                        onChange={(e) => updateGridLink(currentGridSlot, 'title', e.target.value)}
                        placeholder="Card title"
                        className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    {/* URL */}
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">URL</label>
                      <input
                        type="url"
                        value={gridLinks[currentGridSlot]?.url || ''}
                        onChange={(e) => updateGridLink(currentGridSlot, 'url', e.target.value)}
                        placeholder="https://example.com"
                        className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  {/* Right Arrow */}
                  <button
                    type="button"
                    onClick={() => setCurrentGridSlot(Math.min(gridColumns - 1, currentGridSlot + 1))}
                    disabled={currentGridSlot === gridColumns - 1}
                    className={`p-2 rounded-lg ml-2 transition-colors ${
                      currentGridSlot === gridColumns - 1 ? 'text-gray-600 cursor-not-allowed' : 'text-white hover:bg-white/10'
                    }`}
                  >
                    <ChevronRightIcon className="h-6 w-6" />
                  </button>
                </div>
              </div>

              {/* Preview of all cards */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-2">Preview</label>
                <div className="grid grid-cols-2 gap-2">
                  {gridLinks.slice(0, gridColumns).map((gl, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setCurrentGridSlot(i)}
                      className={`aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                        currentGridSlot === i ? 'border-blue-500' : 'border-white/10'
                      }`}
                    >
                      {gl.thumbnailUrl ? (
                        <div className="relative w-full h-full">
                          <img src={gl.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                          {gl.title && (
                            <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5">
                              <p className="text-[8px] text-white truncate">{gl.title}</p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="w-full h-full bg-white/5 flex items-center justify-center">
                          <span className="text-xs text-gray-500">{i + 1}</span>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-white/10 border border-white/20 text-white rounded-xl font-medium hover:bg-white/20 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium transition-colors"
            >
              {linkType === 'grid' ? `Add ${gridColumns} Card${gridColumns > 1 ? 's' : ''}` : 'Add Link'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Edit Link Modal
const EditLinkModal: React.FC<{
  link: BioLink;
  onClose: () => void;
  onSave: (link: BioLink) => void;
}> = ({ link, onClose, onSave }) => {
  const [title, setTitle] = useState(link.title || '');
  const [url, setUrl] = useState(link.url || '');
  const [thumbnailUrl, setThumbnailUrl] = useState(link.thumbnail_url || '');
  const [gridColumns, setGridColumns] = useState(link.grid_columns || 2);
  const [isActive, setIsActive] = useState(link.is_active);
  const [isFeatured, setIsFeatured] = useState(link.is_featured || false);
  const [linkFormat, setLinkFormat] = useState<'thin' | 'tall' | 'square'>(link.link_format as 'thin' | 'tall' | 'square' || 'thin');
  const [uploading, setUploading] = useState(false);

  // Auto-add https:// when URL loses focus
  const handleUrlBlur = () => {
    if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
      setUrl('https://' + url);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const result = await uploadImageToWasabi(file, `bio-images/${link.talent_id}`);
      if (result.success && result.imageUrl) {
        setThumbnailUrl(result.imageUrl);
        toast.success('Image uploaded!');
      } else {
        toast.error(result.error || 'Upload failed');
      }
    } catch (error) {
      toast.error('Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Auto-add https:// before saving
    let finalUrl = url;
    if (finalUrl && !finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
      finalUrl = 'https://' + finalUrl;
    }
    onSave({
      ...link,
      title,
      url: finalUrl,
      thumbnail_url: thumbnailUrl || undefined,
      grid_columns: gridColumns,
      is_active: isActive,
      is_featured: isFeatured,
      link_format: linkFormat,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1a1a] border border-white/20 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Edit Link</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="My Website"
              className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">URL</label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onBlur={handleUrlBlur}
              placeholder="example.com"
              className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">https:// will be added automatically</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Image (optional)</label>
            
            {thumbnailUrl ? (
              <div className="flex items-center gap-4">
                <img 
                  src={thumbnailUrl} 
                  alt="Preview" 
                  className="w-20 h-20 rounded-lg object-cover"
                />
                <button
                  type="button"
                  onClick={() => setThumbnailUrl('')}
                  className="text-sm text-red-400 hover:text-red-300"
                >
                  Remove
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-white/20 rounded-xl cursor-pointer hover:border-white/40 transition-colors">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  {uploading ? (
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                  ) : (
                    <>
                      <CloudArrowUpIcon className="h-10 w-10 text-gray-400 mb-2" />
                      <p className="text-sm text-gray-400">Click to upload image</p>
                      <p className="text-xs text-gray-500 mt-1">PNG, JPG up to 5MB</p>
                    </>
                  )}
                </div>
                <input 
                  type="file" 
                  className="hidden" 
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={uploading}
                />
              </label>
            )}
          </div>

          {link.link_type === 'grid' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Grid Layout</label>
              <div className="grid grid-cols-2 gap-3">
                {/* 2 Columns (1x2) */}
                <button
                  type="button"
                  onClick={() => setGridColumns(2)}
                  className={`p-3 rounded-xl transition-all ${
                    gridColumns === 2
                      ? 'bg-blue-500/20 border-2 border-blue-500'
                      : 'bg-white/5 border-2 border-white/10 hover:border-white/30'
                  }`}
                >
                  <div className="grid grid-cols-2 gap-1 mb-2">
                    <div className="aspect-square bg-current opacity-40 rounded" />
                    <div className="aspect-square bg-current opacity-40 rounded" />
                  </div>
                  <div className="text-xs text-center text-gray-300">1×2</div>
                </button>
                
                {/* 4 Columns (2x2) */}
                <button
                  type="button"
                  onClick={() => setGridColumns(4)}
                  className={`p-3 rounded-xl transition-all ${
                    gridColumns === 4
                      ? 'bg-blue-500/20 border-2 border-blue-500'
                      : 'bg-white/5 border-2 border-white/10 hover:border-white/30'
                  }`}
                >
                  <div className="grid grid-cols-2 gap-1 mb-2">
                    <div className="aspect-square bg-current opacity-40 rounded" />
                    <div className="aspect-square bg-current opacity-40 rounded" />
                    <div className="aspect-square bg-current opacity-40 rounded" />
                    <div className="aspect-square bg-current opacity-40 rounded" />
                  </div>
                  <div className="text-xs text-center text-gray-300">2×2</div>
                </button>
              </div>
            </div>
          )}

          {/* Link Format for basic links */}
          {link.link_type === 'basic' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Link Format</label>
              <div className="grid grid-cols-3 gap-3">
                {/* Thin */}
                <button
                  type="button"
                  onClick={() => setLinkFormat('thin')}
                  className={`p-3 rounded-xl transition-all ${
                    linkFormat === 'thin'
                      ? 'bg-blue-500/20 border-2 border-blue-500'
                      : 'bg-white/5 border-2 border-white/10 hover:border-white/30'
                  }`}
                >
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-full h-6 bg-current opacity-40 rounded flex items-center px-2">
                      <div className="w-3 h-3 bg-white/60 rounded mr-2" />
                      <div className="flex-1 h-2 bg-white/40 rounded" />
                    </div>
                    <span className="text-xs text-gray-300">Thin</span>
                  </div>
                </button>
                
                {/* Tall */}
                <button
                  type="button"
                  onClick={() => setLinkFormat('tall')}
                  className={`p-3 rounded-xl transition-all ${
                    linkFormat === 'tall'
                      ? 'bg-blue-500/20 border-2 border-blue-500'
                      : 'bg-white/5 border-2 border-white/10 hover:border-white/30'
                  }`}
                >
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-full h-12 bg-current opacity-40 rounded flex items-center px-2">
                      <div className="w-8 h-8 bg-white/60 rounded mr-2" />
                      <div className="flex-1">
                        <div className="h-2 bg-white/40 rounded mb-1" />
                        <div className="h-1.5 bg-white/20 rounded w-2/3" />
                      </div>
                    </div>
                    <span className="text-xs text-gray-300">Tall</span>
                  </div>
                </button>
                
                {/* Square (no title) */}
                <button
                  type="button"
                  onClick={() => setLinkFormat('square')}
                  className={`p-3 rounded-xl transition-all ${
                    linkFormat === 'square'
                      ? 'bg-blue-500/20 border-2 border-blue-500'
                      : 'bg-white/5 border-2 border-white/10 hover:border-white/30'
                  }`}
                >
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-10 h-10 bg-current opacity-40 rounded flex items-center justify-center">
                      <div className="w-6 h-6 bg-white/60 rounded" />
                    </div>
                    <span className="text-xs text-gray-300">Square</span>
                  </div>
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {linkFormat === 'square' ? 'Image only, no title displayed' : 'Choose how your link appears'}
              </p>
            </div>
          )}

          {/* Card Format for grid links */}
          {link.link_type === 'grid' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Card Format</label>
              <div className="grid grid-cols-3 gap-3">
                {/* Thin */}
                <button
                  type="button"
                  onClick={() => setLinkFormat('thin')}
                  className={`p-3 rounded-xl transition-all ${
                    linkFormat === 'thin'
                      ? 'bg-purple-500/20 border-2 border-purple-500'
                      : 'bg-white/5 border-2 border-white/10 hover:border-white/30'
                  }`}
                >
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-full h-6 bg-current opacity-40 rounded flex items-center px-2">
                      <div className="w-3 h-3 bg-white/60 rounded mr-2" />
                      <div className="flex-1 h-2 bg-white/40 rounded" />
                    </div>
                    <span className="text-xs text-gray-300">Thin</span>
                  </div>
                </button>
                
                {/* Tall */}
                <button
                  type="button"
                  onClick={() => setLinkFormat('tall')}
                  className={`p-3 rounded-xl transition-all ${
                    linkFormat === 'tall'
                      ? 'bg-purple-500/20 border-2 border-purple-500'
                      : 'bg-white/5 border-2 border-white/10 hover:border-white/30'
                  }`}
                >
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-full h-12 bg-current opacity-40 rounded overflow-hidden">
                      <div className="w-full h-6 bg-white/60" />
                      <div className="px-2 py-1">
                        <div className="h-1.5 bg-white/40 rounded w-2/3" />
                      </div>
                    </div>
                    <span className="text-xs text-gray-300">Tall</span>
                  </div>
                </button>
                
                {/* Square (no title) */}
                <button
                  type="button"
                  onClick={() => setLinkFormat('square')}
                  className={`p-3 rounded-xl transition-all ${
                    linkFormat === 'square'
                      ? 'bg-purple-500/20 border-2 border-purple-500'
                      : 'bg-white/5 border-2 border-white/10 hover:border-white/30'
                  }`}
                >
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-10 h-10 bg-current opacity-40 rounded flex items-center justify-center">
                      <div className="w-6 h-6 bg-white/60 rounded" />
                    </div>
                    <span className="text-xs text-gray-300">Square</span>
                  </div>
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {linkFormat === 'square' ? 'Image only, flush edges' : 
                 linkFormat === 'tall' ? 'Image with title below' : 'Compact card with title'}
              </p>
            </div>
          )}

          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-5 h-5 rounded bg-white/10 border-white/20 text-blue-500 focus:ring-blue-500"
              />
              <span className="text-white">Link is active</span>
            </label>

            {link.link_type === 'basic' && (
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isFeatured}
                  onChange={(e) => setIsFeatured(e.target.checked)}
                  className="w-5 h-5 rounded bg-white/10 border-white/20 text-yellow-500 focus:ring-yellow-500"
                />
                <div className="flex items-center gap-2">
                  <span className="text-white">Featured link</span>
                  <span className="text-yellow-400">⭐</span>
                </div>
                <span className="text-xs text-gray-400">(gradient highlight)</span>
              </label>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-white/10 border border-white/20 text-white rounded-xl font-medium hover:bg-white/20 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium transition-colors"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Newsletter Modal
const NewsletterModal: React.FC<{
  configs: NewsletterConfig[];
  talentId: string;
  onClose: () => void;
  onSave: (configs: NewsletterConfig[]) => void;
}> = ({ configs, talentId, onClose, onSave }) => {
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [listId, setListId] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!selectedProvider) return;
    
    setSaving(true);
    try {
      const existingConfig = configs.find(c => c.provider === selectedProvider);
      
      const configData = {
        talent_id: talentId,
        provider: selectedProvider,
        api_key: apiKey || null,
        list_id: listId || null,
        webhook_url: webhookUrl || null,
        is_active: true,
      };

      if (existingConfig?.id) {
        const { error } = await supabase
          .from('bio_newsletter_configs')
          .update(configData)
          .eq('id', existingConfig.id);
        
        if (error) throw error;
        onSave(configs.map(c => c.id === existingConfig.id ? { ...c, ...configData } : c));
      } else {
        const { data, error } = await supabase
          .from('bio_newsletter_configs')
          .insert([configData])
          .select()
          .single();
        
        if (error) throw error;
        onSave([...configs, data]);
      }

      toast.success('Newsletter integration saved!');
      setSelectedProvider(null);
      setApiKey('');
      setListId('');
      setWebhookUrl('');
    } catch (error) {
      console.error('Error saving newsletter config:', error);
      toast.error('Failed to save integration');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1a1a] border border-white/20 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Newsletter Integration</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {!selectedProvider ? (
          <div className="space-y-3">
            <p className="text-gray-400 text-sm mb-4">
              Select a provider to connect your email list:
            </p>
            {NEWSLETTER_PROVIDERS.map((provider) => {
              const config = configs.find(c => c.provider === provider.id);
              return (
                <button
                  key={provider.id}
                  onClick={() => {
                    setSelectedProvider(provider.id);
                    if (config) {
                      setApiKey(config.api_key || '');
                      setListId(config.list_id || '');
                      setWebhookUrl(config.webhook_url || '');
                    }
                  }}
                  className={`w-full p-4 rounded-xl border-2 text-left transition-all flex items-center justify-between ${
                    config?.is_active
                      ? 'border-green-500/50 bg-green-500/10'
                      : 'border-white/20 hover:border-white/40'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{provider.icon}</span>
                    <div>
                      <h3 className="font-medium text-white">{provider.name}</h3>
                      {config?.is_active && (
                        <p className="text-xs text-green-400">Connected</p>
                      )}
                    </div>
                  </div>
                  <PencilIcon className="h-5 w-5 text-gray-400" />
                </button>
              );
            })}
          </div>
        ) : (
          <div className="space-y-4">
            <button
              onClick={() => setSelectedProvider(null)}
              className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1"
            >
              ← Back to providers
            </button>

            <div className="p-4 bg-white/5 rounded-xl">
              <h3 className="font-medium text-white mb-1">
                {NEWSLETTER_PROVIDERS.find(p => p.id === selectedProvider)?.name}
              </h3>
              <p className="text-sm text-gray-400">
                Enter your API credentials to connect.
              </p>
            </div>

            {selectedProvider === 'zapier' ? (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Webhook URL</label>
                <input
                  type="url"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://hooks.zapier.com/..."
                  className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Create a Zap with "Webhooks by Zapier" as the trigger
                </p>
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">API Key</label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Enter your API key"
                    className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">List/Audience ID</label>
                  <input
                    type="text"
                    value={listId}
                    onChange={(e) => setListId(e.target.value)}
                    placeholder="Enter your list ID"
                    className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </>
            )}

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => setSelectedProvider(null)}
                className="flex-1 px-4 py-3 bg-white/5 border border-white/20 text-white rounded-xl font-medium hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 px-4 py-3 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Import Modal
const ImportModal: React.FC<{
  onClose: () => void;
  onImport: (url: string) => void;
}> = ({ onClose, onImport }) => {
  const [url, setUrl] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onImport(url);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1a1a] border border-white/20 rounded-2xl p-6 w-full max-w-lg">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Import Links</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Link-in-Bio URL
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://linktr.ee/username"
              className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              required
            />
            <p className="text-xs text-gray-500 mt-2">
              Supports Linktree, Beacons, Stan Store, and other link-in-bio pages
            </p>
          </div>

          <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
            <div className="flex items-start gap-3">
              <CloudArrowUpIcon className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-white font-medium">How it works</p>
                <p className="text-xs text-gray-400 mt-1">
                  We'll scan your existing link-in-bio page and import all your links and images automatically.
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-white/5 border border-white/20 text-white rounded-xl font-medium hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-3 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition-colors"
            >
              Import
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Add Social Modal
const AddSocialModal: React.FC<{
  onClose: () => void;
  onAdd: (social: { platform: string; handle: string }) => void;
  existingPlatforms: string[];
}> = ({ onClose, onAdd, existingPlatforms }) => {
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [handle, setHandle] = useState('');

  const availablePlatforms = SOCIAL_PLATFORMS.filter(p => !existingPlatforms.includes(p.id));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedPlatform && handle) {
      onAdd({ platform: selectedPlatform, handle: handle.replace(/^@/, '') });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1a1a] border border-white/20 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Add Social Link</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {!selectedPlatform ? (
          <div className="space-y-3">
            <p className="text-gray-400 text-sm mb-4">
              Select a platform to add:
            </p>
            {availablePlatforms.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                You've added all available social platforms!
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {availablePlatforms.map((platform) => (
                  <button
                    key={platform.id}
                    onClick={() => setSelectedPlatform(platform.id)}
                    className="p-4 rounded-xl border-2 border-white/20 hover:border-white/40 text-left transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 flex items-center justify-center text-blue-400">
                        {platform.icon}
                      </div>
                      <span className="font-medium text-white">{platform.name}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <button
              type="button"
              onClick={() => setSelectedPlatform(null)}
              className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1"
            >
              ← Back to platforms
            </button>

            <div className="p-4 bg-white/5 rounded-xl flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center text-blue-400">
                {SOCIAL_PLATFORMS.find(p => p.id === selectedPlatform)?.icon}
              </div>
              <div>
                <h3 className="font-medium text-white">
                  {SOCIAL_PLATFORMS.find(p => p.id === selectedPlatform)?.name}
                </h3>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Username / Handle</label>
              <div className="flex items-center">
                <span className="text-gray-500 mr-2">@</span>
                <input
                  type="text"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                  placeholder="username"
                  className="flex-1 bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  required
                />
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-3 bg-white/5 border border-white/20 text-white rounded-xl font-medium hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-3 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition-colors"
              >
                Add Social
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

// Available collab platforms
const COLLAB_PLATFORMS = [
  { id: 'instagram', name: 'Instagram', icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg> },
  { id: 'tiktok', name: 'TikTok', icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/></svg> },
  { id: 'youtube', name: 'YouTube', icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg> },
  { id: 'twitter', name: 'X (Twitter)', icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg> },
  { id: 'facebook', name: 'Facebook', icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg> },
];

// Add Service Modal
const AddServiceModal: React.FC<{
  service?: ServiceOffering;
  socialLinks: SocialAccount[];
  onUpdateFollowerCount: (socialId: string, count: number) => void;
  onClose: () => void;
  onSave: (service: Partial<ServiceOffering> & { service_type: string }) => void;
}> = ({ service, socialLinks, onUpdateFollowerCount, onClose, onSave }) => {
  const [serviceType] = useState<'instagram_collab'>('instagram_collab');
  const [title, setTitle] = useState(service?.title || 'Collaborate with me');
  const [pricing, setPricing] = useState(service ? (service.pricing / 100).toString() : '250');
  const [videoLength, setVideoLength] = useState(service?.video_length_seconds?.toString() || '60');
  const [benefits, setBenefits] = useState<string[]>(
    service?.benefits || [
      'Personalized video mention',
      'Story share to followers',
      'Permanent post on feed'
    ]
  );
  const [newBenefit, setNewBenefit] = useState('');
  const [description, setDescription] = useState(service?.description || '');
  const [isActive, setIsActive] = useState(service?.is_active !== false);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(
    service?.platforms || ['instagram']
  );

  const togglePlatform = (platformId: string) => {
    if (selectedPlatforms.includes(platformId)) {
      // Don't allow removing all platforms
      if (selectedPlatforms.length > 1) {
        setSelectedPlatforms(selectedPlatforms.filter(p => p !== platformId));
      }
    } else {
      setSelectedPlatforms([...selectedPlatforms, platformId]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      service_type: serviceType,
      title,
      pricing: Math.round(parseFloat(pricing) * 100), // Convert to cents
      video_length_seconds: parseInt(videoLength),
      benefits,
      platforms: selectedPlatforms,
      description,
      is_active: isActive,
    });
  };

  const addBenefit = () => {
    if (newBenefit.trim()) {
      setBenefits([...benefits, newBenefit.trim()]);
      setNewBenefit('');
    }
  };

  const removeBenefit = (index: number) => {
    setBenefits(benefits.filter((_, i) => i !== index));
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1a1a] border border-white/20 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">
            {service ? 'Edit Service' : 'Add Service'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Service Type (for now just Instagram Collab) */}
          <div className="p-4 bg-gradient-to-r from-pink-500/20 to-purple-500/20 border border-pink-500/30 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-pink-500 to-purple-500 flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-white">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
              </div>
              <div>
                <h3 className="font-medium text-white">Instagram Collab</h3>
                <p className="text-sm text-gray-400">Sponsored content collaboration</p>
              </div>
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Card Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Collaborate with me"
              className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-pink-500"
              required
            />
          </div>

          {/* Pricing */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Price</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">$</span>
              <input
                type="number"
                value={pricing}
                onChange={(e) => setPricing(e.target.value)}
                min="1"
                step="1"
                className="w-full bg-white/5 border border-white/20 rounded-xl pl-8 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-pink-500"
                required
              />
            </div>
          </div>

          {/* Video Length */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Video Length (seconds)</label>
            <select
              value={videoLength}
              onChange={(e) => setVideoLength(e.target.value)}
              className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-pink-500"
            >
              <option value="15">15 seconds</option>
              <option value="30">30 seconds</option>
              <option value="60">60 seconds</option>
              <option value="90">90 seconds</option>
              <option value="120">2 minutes</option>
              <option value="180">3 minutes</option>
            </select>
          </div>

          {/* Platforms */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Platforms Included</label>
            <p className="text-xs text-gray-500 mb-3">Select which social platforms this collab covers. Add follower counts for selected platforms.</p>
            <div className="space-y-2">
              {COLLAB_PLATFORMS.map((platform) => {
                const socialAccount = socialLinks.find(s => s.platform === platform.id);
                const isSelected = selectedPlatforms.includes(platform.id);
                const formatFollowers = (count: number): string => {
                  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
                  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
                  return count.toString();
                };
                
                return (
                  <div key={platform.id} className="space-y-2">
                    <button
                      type="button"
                      onClick={() => togglePlatform(platform.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                        isSelected
                          ? 'bg-pink-500/20 border-pink-500'
                          : 'bg-white/5 border-white/10 hover:border-white/30'
                      }`}
                    >
                      <div className={`${isSelected ? 'text-pink-400' : 'text-gray-400'}`}>
                        {platform.icon}
                      </div>
                      <span className={`text-sm font-medium ${isSelected ? 'text-white' : 'text-gray-400'}`}>
                        {platform.name}
                      </span>
                      {socialAccount && (
                        <span className="text-xs text-gray-500">@{socialAccount.handle}</span>
                      )}
                      {isSelected && (
                        <CheckIcon className="h-4 w-4 text-pink-400 ml-auto" />
                      )}
                    </button>
                    
                    {/* Follower count input for selected platforms */}
                    {isSelected && socialAccount && (
                      <div className="ml-8 flex items-center gap-2 bg-white/5 rounded-lg p-2">
                        <span className="text-xs text-gray-400">Followers:</span>
                        <input
                          type="number"
                          placeholder="Enter count"
                          value={socialAccount.follower_count || ''}
                          onChange={(e) => {
                            const count = parseInt(e.target.value) || 0;
                            onUpdateFollowerCount(socialAccount.id, count);
                          }}
                          className="w-28 px-2 py-1 text-sm bg-white/10 border border-white/20 rounded text-white placeholder-gray-500 focus:outline-none focus:border-pink-500"
                        />
                        {socialAccount.follower_count && socialAccount.follower_count > 0 && (
                          <span className="text-xs text-pink-400 font-semibold">
                            {formatFollowers(socialAccount.follower_count)}
                          </span>
                        )}
                      </div>
                    )}
                    
                    {/* Warning if platform selected but no social account linked */}
                    {isSelected && !socialAccount && (
                      <div className="ml-8 flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-2">
                        <span className="text-xs text-yellow-400">⚠️ Add @{platform.name.toLowerCase()} handle in Social tab first</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Benefits */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">What they get</label>
            <div className="space-y-2 mb-3">
              {benefits.map((benefit, index) => (
                <div key={index} className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
                  <CheckIcon className="h-4 w-4 text-green-400 flex-shrink-0" />
                  <span className="flex-1 text-white text-sm">{benefit}</span>
                  <button
                    type="button"
                    onClick={() => removeBenefit(index)}
                    className="p-1 text-gray-400 hover:text-red-400 transition-colors"
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newBenefit}
                onChange={(e) => setNewBenefit(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addBenefit())}
                placeholder="Add a benefit..."
                className="flex-1 bg-white/5 border border-white/20 rounded-xl px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-pink-500 text-sm"
              />
              <button
                type="button"
                onClick={addBenefit}
                className="px-4 py-2 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-colors"
              >
                Add
              </button>
            </div>
          </div>

          {/* Description (optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Additional details about your collaboration service..."
              rows={3}
              className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-pink-500 resize-none"
            />
          </div>

          {/* Active Toggle */}
          <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
            <div>
              <h4 className="font-medium text-white">Active</h4>
              <p className="text-sm text-gray-400">Show this service on your bio page</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pink-500"></div>
            </label>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-white/5 border border-white/20 text-white rounded-xl font-medium hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-3 bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-xl font-medium hover:from-pink-600 hover:to-purple-600 transition-colors"
            >
              {service ? 'Save Changes' : 'Create Service'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Events Manager Modal - manages multiple events, shows table of all events
const AddEventModal: React.FC<{
  events: BioEvent[];
  talentId: string;
  onClose: () => void;
  onEventsChange: (events: BioEvent[]) => void;
}> = ({ events, talentId, onClose, onEventsChange }) => {
  const [sourceType, setSourceType] = useState<'manual' | 'ical' | 'rss'>('manual');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [location, setLocation] = useState('');
  const [registrationUrl, setRegistrationUrl] = useState('');
  const [buttonText, setButtonText] = useState('Get Tickets');
  const [sourceUrl, setSourceUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Load event data when editing
  const loadEventForEdit = (event: BioEvent) => {
    setEditingEventId(event.id || null);
    setSourceType(event.source_type);
    setTitle(event.title);
    setDescription(event.description || '');
    setEventDate(event.event_date || '');
    setEventTime(event.event_time || '');
    setLocation(event.location || '');
    setRegistrationUrl(event.registration_url || '');
    setButtonText(event.button_text || 'Get Tickets');
    setSourceUrl(event.source_url || '');
    setImageUrl(event.image_url || '');
  };

  const clearForm = () => {
    setEditingEventId(null);
    setTitle('');
    setDescription('');
    setEventDate('');
    setEventTime('');
    setLocation('');
    setRegistrationUrl('');
    setButtonText('Get Tickets');
    setSourceUrl('');
    setImageUrl('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (sourceType === 'manual' && !title) {
      toast.error('Please enter an event title');
      return;
    }
    
    if ((sourceType === 'ical' || sourceType === 'rss') && !sourceUrl) {
      toast.error('Please enter a feed URL');
      return;
    }

    setSaving(true);

    const eventData = {
      talent_id: talentId,
      title: sourceType === 'manual' ? title : `${sourceType.toUpperCase()} Feed`,
      description: description || undefined,
      event_date: eventDate || undefined,
      event_time: eventTime || undefined,
      location: location || undefined,
      registration_url: registrationUrl || undefined,
      button_text: buttonText,
      source_type: sourceType,
      source_url: sourceUrl || undefined,
      image_url: imageUrl || undefined,
      is_active: true,
    };

    try {
      if (editingEventId) {
        // Update existing event
        const { error } = await supabase
          .from('bio_events')
          .update(eventData)
          .eq('id', editingEventId);
        
        if (error) throw error;
        
        onEventsChange(events.map(ev => 
          ev.id === editingEventId ? { ...ev, ...eventData } : ev
        ));
        toast.success('Event updated!');
      } else {
        // Create new event
        const { data, error } = await supabase
          .from('bio_events')
          .insert([{ ...eventData, display_order: events.length }])
          .select()
          .single();
        
        if (error) throw error;
        
        onEventsChange([...events, data]);
        toast.success('Event added!');
      }
      clearForm();
    } catch (error: any) {
      console.error('Failed to save event:', error);
      toast.error(`Failed to save event: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (eventId: string) => {
    if (!window.confirm('Delete this event?')) return;
    
    try {
      await supabase.from('bio_events').delete().eq('id', eventId);
      onEventsChange(events.filter(ev => ev.id !== eventId));
      toast.success('Event deleted');
      if (editingEventId === eventId) clearForm();
    } catch (error) {
      toast.error('Failed to delete event');
    }
  };

  // Sort events by date (soonest first)
  const sortedEvents = [...events].sort((a, b) => {
    if (!a.event_date) return 1;
    if (!b.event_date) return -1;
    return new Date(a.event_date).getTime() - new Date(b.event_date).getTime();
  });

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-white/10 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Manage Events</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <p className="text-sm text-gray-400 mb-4">
          Only the next upcoming event will be shown on your bio page.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Source Type Selection */}
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setSourceType('manual')}
              className={`p-2 rounded-lg transition-all text-center text-sm ${
                sourceType === 'manual'
                  ? 'bg-orange-500/20 border border-orange-500 text-white'
                  : 'bg-white/5 border border-white/10 text-gray-400 hover:border-white/30'
              }`}
            >
              ✏️ Manual
            </button>
            <button
              type="button"
              onClick={() => setSourceType('ical')}
              className={`p-2 rounded-lg transition-all text-center text-sm ${
                sourceType === 'ical'
                  ? 'bg-orange-500/20 border border-orange-500 text-white'
                  : 'bg-white/5 border border-white/10 text-gray-400 hover:border-white/30'
              }`}
            >
              📅 iCal
            </button>
            <button
              type="button"
              onClick={() => setSourceType('rss')}
              className={`p-2 rounded-lg transition-all text-center text-sm ${
                sourceType === 'rss'
                  ? 'bg-orange-500/20 border border-orange-500 text-white'
                  : 'bg-white/5 border border-white/10 text-gray-400 hover:border-white/30'
              }`}
            >
              📡 RSS
            </button>
          </div>

          {/* Feed URL for iCal/RSS */}
          {(sourceType === 'ical' || sourceType === 'rss') && (
            <div>
              <input
                type="url"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder={sourceType === 'ical' ? 'https://calendar.google.com/...' : 'https://example.com/events.rss'}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-orange-500/50"
              />
              <p className="text-xs text-gray-500 mt-1">Most recent event from feed will be shown</p>
            </div>
          )}

          {/* Manual Event Fields */}
          {sourceType === 'manual' && (
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Event Title *"
                className="col-span-2 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-orange-500/50"
              />
              <input
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-orange-500/50"
              />
              <input
                type="time"
                value={eventTime}
                onChange={(e) => setEventTime(e.target.value)}
                className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-orange-500/50"
              />
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Location"
                className="col-span-2 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-orange-500/50"
              />
              <input
                type="url"
                value={registrationUrl}
                onChange={(e) => setRegistrationUrl(e.target.value)}
                placeholder="Ticket/Registration URL"
                className="col-span-2 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-orange-500/50"
              />
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="Image URL (optional)"
                className="col-span-2 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-orange-500/50"
              />
            </div>
          )}

          {/* Button Text */}
          <input
            type="text"
            value={buttonText}
            onChange={(e) => setButtonText(e.target.value)}
            placeholder="Button Text (default: Get Tickets)"
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-orange-500/50"
          />

          <div className="flex gap-2">
            {editingEventId && (
              <button
                type="button"
                onClick={clearForm}
                className="px-4 py-2 bg-white/10 text-white rounded-lg text-sm hover:bg-white/20 transition-colors"
              >
                Cancel Edit
              </button>
            )}
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-lg text-sm font-medium hover:from-orange-600 hover:to-amber-600 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : editingEventId ? 'Update Event' : 'Add Event'}
            </button>
          </div>
        </form>

        {/* Events Table */}
        {events.length > 0 && (
          <div className="mt-6 border-t border-white/10 pt-4">
            <h3 className="text-sm font-medium text-gray-400 mb-3">Your Events ({events.length})</h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {sortedEvents.map((event, index) => (
                <div
                  key={event.id}
                  className={`flex items-center justify-between p-2 rounded-lg ${
                    index === 0 ? 'bg-orange-500/20 border border-orange-500/30' : 'bg-white/5'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {index === 0 && <span className="text-xs bg-orange-500 text-white px-1.5 py-0.5 rounded">NEXT</span>}
                      <span className="text-white text-sm truncate">{event.title}</span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {event.event_date ? new Date(event.event_date).toLocaleDateString() : 'No date'}
                      {event.location && ` • ${event.location}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => loadEventForEdit(event)}
                      className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors"
                    >
                      <PencilIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(event.id!)}
                      className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-white/10">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-white/10 text-white rounded-lg font-medium hover:bg-white/20 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default BioDashboard;
