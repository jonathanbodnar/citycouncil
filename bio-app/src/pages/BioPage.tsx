import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { 
  GiftIcon,
  StarIcon,
  ArrowTopRightOnSquareIcon,
  EnvelopeIcon,
  LinkIcon,
  Squares2X2Icon
} from '@heroicons/react/24/outline';
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid';
import { supabase } from '../services/supabase';
import toast from 'react-hot-toast';

interface TalentProfile {
  id: string;
  user_id: string;
  username?: string;
  full_name?: string;
  temp_avatar_url?: string;
  bio?: string;
  social_accounts?: SocialAccount[];
  promo_video_url?: string;
  rumble_handle?: string;
}

interface SocialAccount {
  id: string;
  platform: string;
  handle: string;
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
  id: string;
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
  provider: string;
  webhook_url?: string;
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

const BioPage: React.FC = () => {
  const { username } = useParams<{ username: string }>();
  const [talentProfile, setTalentProfile] = useState<TalentProfile | null>(null);
  const [bioSettings, setBioSettings] = useState<BioSettings | null>(null);
  const [links, setLinks] = useState<BioLink[]>([]);
  const [socialAccounts, setSocialAccounts] = useState<SocialAccount[]>([]);
  const [randomReview, setRandomReview] = useState<Review | null>(null);
  const [newsletterConfig, setNewsletterConfig] = useState<NewsletterConfig | null>(null);
  const [rumbleData, setRumbleData] = useState<RumbleVideoData | null>(null);
  const [rumbleLoading, setRumbleLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [subscribing, setSubscribing] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(true); // Pre-checked

  useEffect(() => {
    const fetchBioData = async () => {
      if (!username) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      try {
        // Try to find by username first, then by ID
        let { data: profile, error: profileError } = await supabase
          .from('talent_profiles')
          .select('*')
          .eq('username', username)
          .single();

        if (profileError || !profile) {
          // Try by ID
          const { data: profileById, error: idError } = await supabase
            .from('talent_profiles')
            .select('*')
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
          .select('id, platform, handle')
          .eq('talent_id', profile.id);
        
        if (socialData && socialData.length > 0) {
          setSocialAccounts(socialData.map(s => ({
            id: s.id,
            platform: s.platform,
            handle: s.handle.replace(/^@/, ''), // Remove @ prefix if present
          })));
        }

        // Fetch Rumble data - first try cache, then fall back to live scraping
        if (profile.rumble_handle) {
          fetchRumbleData(profile.id, profile.rumble_handle);
        }

      } catch (error) {
        console.error('Error fetching bio data:', error);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };

    fetchBioData();
  }, [username]);

  // Fetch Rumble channel data - first from cache, then fallback to live scraping
  const fetchRumbleData = async (talentId: string, rumbleHandle: string) => {
    try {
      // First, try to get cached data from rumble_cache table (no loading state for cache)
      const { data: cachedData, error: cacheError } = await supabase
        .from('rumble_cache')
        .select('*')
        .eq('talent_id', talentId)
        .single();
      
      if (!cacheError && cachedData && cachedData.latest_video_thumbnail) {
        // Use cached data - it's updated every 15 minutes by cron job
        // No loading spinner needed - cache is instant
        setRumbleData({
          title: cachedData.latest_video_title || 'Watch on Rumble',
          thumbnail: cachedData.latest_video_thumbnail || '',
          url: cachedData.latest_video_url || cachedData.channel_url || `https://rumble.com/user/${rumbleHandle.replace(/^@/, '')}`,
          views: cachedData.latest_video_views || 0,
          isLive: cachedData.is_live || false,
          liveViewers: cachedData.live_viewers || 0,
        });
        return;
      }
      
      // Fallback: scrape live if no cache exists - show loading only for live scraping
      setRumbleLoading(true);
      const cleanHandle = rumbleHandle.replace(/^@/, '');
      
      // Try both /user/ and /c/ URL formats
      const urlFormats = [
        `https://rumble.com/user/${cleanHandle}`,
        `https://rumble.com/c/${cleanHandle}`,
      ];
      
      let html = '';
      let successUrl = '';
      
      // Try each URL format with CORS proxies
      for (const channelUrl of urlFormats) {
        const corsProxies = [
          `https://api.allorigins.win/raw?url=${encodeURIComponent(channelUrl)}`,
          `https://corsproxy.io/?${encodeURIComponent(channelUrl)}`,
          `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(channelUrl)}`,
        ];
        
        for (const proxyUrl of corsProxies) {
          try {
            console.log('Trying Rumble proxy:', proxyUrl);
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
            
            const response = await fetch(proxyUrl, {
              headers: {
                'Accept': 'text/html,application/xhtml+xml',
              },
              signal: controller.signal,
            });
            clearTimeout(timeoutId);
            
            if (response.ok) {
              const text = await response.text();
              console.log('Rumble response length:', text.length);
              // Check if we got actual video content (not an error page)
              // Rumble uses various class patterns for thumbnails and CDN domains
              if (text.includes('thumbnail__image') || text.includes('thumbnail__title') || 
                  text.includes('1a-1791.com') || text.includes('videostream') || 
                  text.includes('rmbl.ws')) {
                html = text;
                successUrl = channelUrl;
                console.log('Rumble HTML fetched successfully from:', proxyUrl);
                break;
              } else {
                console.log('Rumble response did not contain expected content');
              }
            } else {
              console.log('Rumble proxy returned status:', response.status);
            }
          } catch (e: unknown) {
            const errorMessage = e instanceof Error ? e.message : 'Unknown error';
            console.log('Rumble proxy failed:', proxyUrl, errorMessage);
          }
        }
        if (html) break;
      }
      
      if (!html) {
        console.log('Could not fetch Rumble data - all proxies failed');
        // Set default data with channel URL
        setRumbleData({
          title: 'Watch on Rumble',
          thumbnail: '',
          url: `https://rumble.com/user/${cleanHandle}`,
          views: 0,
          isLive: false,
          liveViewers: 0,
        });
        setRumbleLoading(false);
        return;
      }
      
      // Strip out CSS/style sections AND script sections to avoid false positives
      const htmlWithoutStyles = html
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
      
      // Check for live stream - look for actual live stream elements in the video grid
      // The live badge appears as class="videostream__status--live" with text "LIVE"
      // or there's a live viewer count like "1,234 watching"
      const liveStatusMatch = htmlWithoutStyles.match(/class="[^"]*videostream__status--live[^"]*"[^>]*>([^<]*LIVE[^<]*)</i);
      const liveViewerMatch = htmlWithoutStyles.match(/class="[^"]*watching-now[^"]*"[^>]*>([\d,]+)/i) ||
                              htmlWithoutStyles.match(/([\d,]+)\s*watching\s*now/i) ||
                              htmlWithoutStyles.match(/>([\d,]+)\s*(?:watching|viewers)</i);
      
      const isLive: boolean = !!(liveStatusMatch || (liveViewerMatch && parseInt(liveViewerMatch[1].replace(/,/g, '')) > 0));
      const liveViewers = liveViewerMatch ? parseInt(liveViewerMatch[1].replace(/,/g, '')) : 0;
      
      // Try to find thumbnail - look specifically in the video grid section
      // The video grid contains the channel's own videos, not featured/related content
      let thumbnail = '';
      let title = 'Latest Video';
      let videoUrl = successUrl;
      let views = 0;
      
      // Try to extract the main video grid section (contains channel's videos)
      const gridMatch = htmlWithoutStyles.match(/class="thumbnail__grid"[\s\S]*?(<article[\s\S]*?<\/article>)/i);
      const videoSection = gridMatch ? gridMatch[1] : htmlWithoutStyles;
      
      // Find all video thumbnails with -small- in URL (these are video thumbs, not profile pics)
      // Use exec loop instead of matchAll for ES5 compatibility
      const thumbRegex = /src="(https:\/\/1a-1791\.com\/video\/[^"]*-small-[^"]*\.(jpg|jpeg|webp|png))"/gi;
      let thumbMatch = thumbRegex.exec(videoSection);
      if (thumbMatch && thumbMatch[1]) {
        thumbnail = thumbMatch[1];
      }
      
      // If no thumbnail in video section, try the whole page but be more careful
      if (!thumbnail) {
        thumbRegex.lastIndex = 0; // Reset regex state
        thumbMatch = thumbRegex.exec(htmlWithoutStyles);
        if (thumbMatch && thumbMatch[1]) {
          thumbnail = thumbMatch[1];
        }
      }
      
      // If still no thumbnail, try OG meta tag (should be channel-specific)
      if (!thumbnail) {
        const ogMatch = html.match(/property="og:image"[^>]*content="([^"]+)"/i) ||
                        html.match(/content="([^"]+)"[^>]*property="og:image"/i);
        if (ogMatch && ogMatch[1]) {
          thumbnail = ogMatch[1];
        }
      }
      
      // Find video title - look for title attribute on video links in the video section
      // Pattern: <a href="/vXXX-title.html" title="Video Title">
      const titleRegex = /<a[^>]*href="(\/v[a-z0-9]+-[^"]+\.html)"[^>]*title="([^"]{10,200})"/gi;
      const titleMatches = [...videoSection.matchAll(titleRegex)];
      if (titleMatches.length > 0) {
        title = titleMatches[0][2].trim();
        videoUrl = `https://rumble.com${titleMatches[0][1].split('?')[0]}`;
      } else {
        // Try whole page
        const allTitleMatches = [...htmlWithoutStyles.matchAll(titleRegex)];
        if (allTitleMatches.length > 0) {
          title = allTitleMatches[0][2].trim();
          videoUrl = `https://rumble.com${allTitleMatches[0][1].split('?')[0]}`;
        }
      }
      
      // Try to find views from data-views attribute
      const viewsMatch = videoSection.match(/data-views="(\d+)"/i) || 
                         htmlWithoutStyles.match(/data-views="(\d+)"/i);
      if (viewsMatch && viewsMatch[1]) {
        views = parseInt(viewsMatch[1]) || 0;
      }
      
      console.log('Rumble data extracted:', { title, thumbnail, videoUrl, views, isLive, liveViewers });
      
      setRumbleData({
        title,
        thumbnail: thumbnail.startsWith('//') ? `https:${thumbnail}` : thumbnail,
        url: videoUrl,
        views,
        isLive,
        liveViewers,
      });
    } catch (error) {
      console.error('Error fetching Rumble data:', error);
      // Set fallback data so the card still shows
      setRumbleData({
        title: 'Watch on Rumble',
        thumbnail: '',
        url: `https://rumble.com/user/${rumbleHandle.replace(/^@/, '')}`,
        views: 0,
        isLive: false,
        liveViewers: 0,
      });
    } finally {
      setRumbleLoading(false);
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

  // Handle newsletter signup
  const handleNewsletterSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsletterEmail || !newsletterConfig) return;

    setSubscribing(true);
    try {
      if (newsletterConfig.webhook_url) {
        // Send to Zapier webhook
        await fetch(newsletterConfig.webhook_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: newsletterEmail,
            talent_id: talentProfile?.id,
            talent_name: bioSettings?.display_name || talentProfile?.full_name,
            source: 'shoutout_bio',
          }),
        });
      }
      toast.success('Thanks for subscribing!');
      setNewsletterEmail('');
    } catch (error) {
      console.error('Newsletter signup error:', error);
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
  const displayName = talentProfile?.full_name || bioSettings?.display_name || 'Creator';
  const profileImage = talentProfile?.temp_avatar_url || bioSettings?.profile_image_url;
  const hasNewsletterLink = links.some(l => l.link_type === 'newsletter');

  return (
    <div 
      className="min-h-screen"
      style={{
        background: `linear-gradient(${gradientDirection}, ${bioSettings?.gradient_start || '#0a0a0a'}, ${bioSettings?.gradient_end || '#1a1a2e'})`
      }}
    >
      <div className="max-w-lg mx-auto px-4 py-8 min-h-screen flex flex-col">
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
          <h1 className="text-2xl font-bold text-white mb-1">
            {displayName}
          </h1>

          {/* Instagram Username */}
          {bioSettings?.instagram_username && (
            <a 
              href={`https://instagram.com/${bioSettings.instagram_username}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-white transition-colors"
            >
              @{bioSettings.instagram_username}
            </a>
          )}

          {/* One-liner */}
          {bioSettings?.one_liner && (
            <p className="text-gray-300 mt-3 max-w-sm mx-auto">
              {bioSettings.one_liner}
            </p>
          )}
        </div>

        {/* Links */}
        <div className="flex-1 space-y-4">
          {/* Rumble Card - Shows latest video or live status - AT THE TOP */}
          {talentProfile?.rumble_handle && bioSettings && bioSettings.show_rumble_card !== false && (
            <a
              href={rumbleData?.url || `https://rumble.com/user/${talentProfile.rumble_handle.replace(/^@/, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-2xl overflow-hidden border border-green-500/30 hover:border-green-500/50 transition-all duration-300 hover:scale-[1.02]">
                <div className="flex items-stretch">
                  {/* Thumbnail - wider for better video preview */}
                  <div className="w-44 h-[120px] flex-shrink-0 relative bg-black/20">
                    {rumbleLoading ? (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-400"></div>
                      </div>
                    ) : rumbleData?.thumbnail ? (
                      <img 
                        src={rumbleData.thumbnail} 
                        alt="" 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-green-600 to-emerald-600">
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-white/80">
                          <path d="M14.4528 13.5458c0.8064 -0.6542 0.9297 -1.8381 0.2756 -2.6445a1.8802 1.8802 0 0 0 -0.2756 -0.2756 21.2127 21.2127 0 0 0 -4.3121 -2.776c-1.066 -0.51 -2.256 0.2 -2.4261 1.414a23.5226 23.5226 0 0 0 -0.14 5.5021c0.116 1.23 1.292 1.964 2.372 1.492a19.6285 19.6285 0 0 0 4.5062 -2.704v-0.008zm6.9322 -5.4002c2.0335 2.228 2.0396 5.637 0.014 7.8723A26.1487 26.1487 0 0 1 8.2946 23.846c-2.6848 0.6713 -5.4168 -0.914 -6.1662 -3.5781 -1.524 -5.2002 -1.3 -11.0803 0.17 -16.3045 0.772 -2.744 3.3521 -4.4661 6.0102 -3.832 4.9242 1.174 9.5443 4.196 13.0764 8.0121v0.002z"/>
                        </svg>
                      </div>
                    )}
                    {/* Live indicator - top right */}
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
                      {rumbleData?.isLive && rumbleData.liveViewers && rumbleData.liveViewers > 0 && (
                        <span className="text-red-400 text-xs font-medium">
                          • {rumbleData.liveViewers.toLocaleString()} watching
                        </span>
                      )}
                    </div>
                    <h3 className="text-white font-medium text-sm line-clamp-2">
                      {rumbleData?.title || 'Watch on Rumble'}
                    </h3>
                    {!rumbleData?.isLive && rumbleData?.views && rumbleData.views > 0 && (
                      <p className="text-gray-400 text-xs mt-0.5">
                        {rumbleData.views.toLocaleString()} views
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </a>
          )}

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
            
            // Tall format - larger image with title below
            if (linkFormat === 'tall') {
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
                  {link.thumbnail_url && (
                    <div className="h-32 w-full">
                      <img src={link.thumbnail_url} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex-1">
                      <span className="text-white font-medium text-left block">{link.title}</span>
                      {link.subtitle && (
                        <span className="text-white/60 text-sm text-left block mt-0.5">{link.subtitle}</span>
                      )}
                    </div>
                    <ArrowTopRightOnSquareIcon className="h-4 w-4 text-white/60 flex-shrink-0 ml-2" />
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
                  
                  // Tall format - image with title below
                  if (linkFormat === 'tall') {
                    return (
                      <a
                        key={link.id}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => handleLinkClick(link)}
                        className={`${getRadiusClass()} overflow-hidden group`}
                        style={getButtonStyle()}
                      >
                        <div className="aspect-square w-full">
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
                        </div>
                        {link.title && (
                          <div className="p-2">
                            <span className="text-white font-medium text-sm line-clamp-2">{link.title}</span>
                          </div>
                        )}
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

          {/* Newsletter Signup - Show if there's a newsletter link (with or without config) */}
          {/* Always use rounded style for newsletter container since pill doesn't work well here */}
          {hasNewsletterLink && (
            <div 
              className="rounded-xl"
              style={{
                ...getButtonStyle(),
                borderRadius: '0.75rem', // Override pill style
                padding: '20px 24px',
              }}
            >
              <div className="flex items-center gap-3 mb-4">
                <EnvelopeIcon className="h-6 w-6 text-green-400" />
                <h3 className="text-white font-medium">
                  {links.find(l => l.link_type === 'newsletter')?.title || 'Join my newsletter'}
                </h3>
              </div>
              <form onSubmit={handleNewsletterSignup} className="space-y-4">
                <div className="flex gap-3">
                  <input
                    type="email"
                    value={newsletterEmail}
                    onChange={(e) => setNewsletterEmail(e.target.value)}
                    placeholder="Enter your email"
                    required
                    className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-white/40"
                  />
                  <button
                    type="submit"
                    disabled={subscribing || !newsletterConfig || !privacyAccepted}
                    className="px-6 py-3 rounded-xl font-medium text-white transition-colors disabled:opacity-50"
                    style={{ backgroundColor: bioSettings?.button_color || '#3b82f6' }}
                  >
                    {subscribing ? '...' : 'Join'}
                  </button>
                </div>
                {/* Privacy Policy Checkbox */}
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={privacyAccepted}
                    onChange={(e) => setPrivacyAccepted(e.target.checked)}
                    className="mt-1 w-4 h-4 rounded bg-white/10 border-white/30 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                  />
                  <span className="text-xs text-gray-400 leading-relaxed">
                    I agree to receive {displayName}'s newsletter and accept their{' '}
                    <a 
                      href={`/${username}/privacy`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 underline"
                    >
                      Privacy Policy
                    </a>
                  </span>
                </label>
              </form>
            </div>
          )}

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

          {/* ShoutOut Card - Always at the bottom (cannot be removed) */}
          {bioSettings && (
            <a
              href={`https://shoutout.us/${talentProfile?.username || talentProfile?.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block mt-4"
            >
              <div className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-2xl overflow-hidden border border-blue-500/30 hover:border-blue-500/50 transition-all duration-300 hover:scale-[1.02]">
                <div className="flex items-stretch">
                  {/* Promo Video Thumbnail */}
                  <div className="w-20 flex-shrink-0 relative bg-black/20">
                    {talentProfile?.promo_video_url ? (
                      <video 
                        src={talentProfile.promo_video_url}
                        className="w-full h-full object-cover"
                        muted
                        playsInline
                        preload="metadata"
                      />
                    ) : profileImage ? (
                      <img 
                        src={profileImage} 
                        alt="" 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-500">
                        <GiftIcon className="h-8 w-8 text-white" />
                      </div>
                    )}
                    {talentProfile?.promo_video_url && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                        <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                          <svg className="w-4 h-4 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z"/>
                          </svg>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <GiftIcon className="h-4 w-4 text-blue-400" />
                      <span className="text-blue-400 text-xs font-medium">ShoutOut</span>
                    </div>
                    <h3 className="text-white font-semibold text-sm mb-1">
                      Get a personalized video from {displayName}
                    </h3>
                    
                    {/* Random Review - Show first line only */}
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
        <div className="mt-8 text-center">
          <a 
            href="https://shoutout.us"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-white/40 hover:text-white/60 text-sm transition-colors"
          >
            <span>Powered by</span>
            <span className="font-semibold">ShoutOut</span>
          </a>
        </div>
      </div>
    </div>
  );
};

export default BioPage;
