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
  SwatchIcon
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
}

interface SocialAccount {
  id: string;
  platform: 'twitter' | 'facebook' | 'instagram' | 'tiktok' | 'linkedin' | 'youtube' | 'threads' | 'snapchat' | 'pinterest';
  handle: string;
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

// Social platforms with their URL patterns and icons
const SOCIAL_PLATFORMS = [
  { id: 'instagram', name: 'Instagram', urlPattern: 'instagram.com', icon: '📸', baseUrl: 'https://instagram.com/' },
  { id: 'twitter', name: 'X (Twitter)', urlPattern: 'twitter.com|x.com', icon: '𝕏', baseUrl: 'https://x.com/' },
  { id: 'tiktok', name: 'TikTok', urlPattern: 'tiktok.com', icon: '🎵', baseUrl: 'https://tiktok.com/@' },
  { id: 'youtube', name: 'YouTube', urlPattern: 'youtube.com|youtu.be', icon: '▶️', baseUrl: 'https://youtube.com/' },
  { id: 'facebook', name: 'Facebook', urlPattern: 'facebook.com|fb.com', icon: '📘', baseUrl: 'https://facebook.com/' },
  { id: 'linkedin', name: 'LinkedIn', urlPattern: 'linkedin.com', icon: '💼', baseUrl: 'https://linkedin.com/in/' },
  { id: 'threads', name: 'Threads', urlPattern: 'threads.net', icon: '🧵', baseUrl: 'https://threads.net/@' },
  { id: 'snapchat', name: 'Snapchat', urlPattern: 'snapchat.com', icon: '👻', baseUrl: 'https://snapchat.com/add/' },
  { id: 'pinterest', name: 'Pinterest', urlPattern: 'pinterest.com', icon: '📌', baseUrl: 'https://pinterest.com/' },
  { id: 'spotify', name: 'Spotify', urlPattern: 'spotify.com|open.spotify', icon: '🎧', baseUrl: 'https://open.spotify.com/' },
  { id: 'twitch', name: 'Twitch', urlPattern: 'twitch.tv', icon: '🎮', baseUrl: 'https://twitch.tv/' },
  { id: 'discord', name: 'Discord', urlPattern: 'discord.gg|discord.com', icon: '💬', baseUrl: 'https://discord.gg/' },
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
  const [authError, setAuthError] = useState<string | null>(null);
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
        
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('id', token)
          .single();

        if (userError || !userData) {
          console.error('Bio Dashboard: User lookup failed:', userError);
          setAuthError(`Invalid authentication token. Please try again from your ShoutOut dashboard.`);
          setLoading(false);
          return;
        }

        setUser(userData);

        const { data: profile, error: profileError } = await supabase
          .from('talent_profiles')
          .select('*')
          .eq('user_id', userData.id)
          .single();

        if (profileError || !profile) {
          console.error('Bio Dashboard: Talent profile lookup failed:', profileError);
          setAuthError(`No talent profile found. You must be a talent to use ShoutOut Bio.`);
          setLoading(false);
          return;
        }

        setTalentProfile(profile);
        
        // Load social accounts from the social_accounts table (not JSONB field)
        const { data: socialData } = await supabase
          .from('social_accounts')
          .select('id, platform, handle')
          .eq('talent_id', profile.id);
        
        if (socialData && socialData.length > 0) {
          setSocialLinks(socialData.map(s => ({
            id: s.id,
            platform: s.platform,
            handle: s.handle.replace(/^@/, ''), // Remove @ prefix if present
          })));
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
            is_published: false,
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
    if (!bioSettings?.id) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('bio_settings')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', bioSettings.id);

      if (error) throw error;
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

  // Update link
  const updateLink = async (link: BioLink) => {
    if (!link.id) return;

    try {
      const { error } = await supabase
        .from('bio_links')
        .update({
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
          updated_at: new Date().toISOString(),
        })
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
            <div className="flex items-center gap-3">
              <SparklesIcon className="h-8 w-8 text-blue-400" />
              <div>
                <h1 className="text-xl font-bold text-white">ShoutOut Bio</h1>
                <p className="text-sm text-gray-400">@{talentProfile?.username || 'username'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={copyBioUrl}
                className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/20 rounded-xl text-white text-sm hover:bg-white/10 transition-colors"
              >
                <ClipboardIcon className="h-4 w-4" />
                <span className="hidden sm:inline">{bioUrl}</span>
              </button>
              <a
                href={`https://${bioUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/20 rounded-xl text-white text-sm hover:bg-white/10 transition-colors"
              >
                <EyeIcon className="h-4 w-4" />
                <span className="hidden sm:inline">Preview</span>
              </a>
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
                    Live
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
                    onClick={() => setShowImportModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-white/10 text-white rounded-xl font-medium hover:bg-white/20 transition-colors"
                  >
                    <CloudArrowUpIcon className="h-5 w-5" />
                    Import Links
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
                              link.link_type === 'newsletter' ? 'bg-green-500/20' :
                              'bg-yellow-500/20'
                            }`}>
                              {link.link_type === 'basic' && <LinkIcon className="h-5 w-5 text-blue-400" />}
                              {link.link_type === 'grid' && <Squares2X2Icon className="h-5 w-5 text-purple-400" />}
                              {link.link_type === 'newsletter' && <EnvelopeIcon className="h-5 w-5 text-green-400" />}
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
                            <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-white/10 text-2xl">
                              {platform?.icon || '🔗'}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-medium text-white">
                                {platform?.name || social.platform}
                              </h3>
                              <p className="text-sm text-gray-400">@{social.handle}</p>
                            </div>
                            <button
                              onClick={async () => {
                                const updated = socialLinks.filter(s => s.id !== social.id);
                                setSocialLinks(updated);
                                await supabase
                                  .from('talent_profiles')
                                  .update({ social_accounts: updated })
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
                      <label className="block text-sm font-medium text-gray-300 mb-2">Instagram Username</label>
                      <div className="flex items-center">
                        <span className="text-gray-500 mr-2">@</span>
                        <input
                          type="text"
                          value={bioSettings?.instagram_username || ''}
                          onChange={(e) => setBioSettings({ ...bioSettings!, instagram_username: e.target.value })}
                          onBlur={() => saveSettings({ instagram_username: bioSettings?.instagram_username })}
                          placeholder="username"
                          className="flex-1 bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                        />
                      </div>
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
              <div className="flex items-center justify-between p-4 border-b border-white/10">
                <h3 className="text-sm font-medium text-gray-400">Live Preview</h3>
                <a
                  href={`https://${bioUrl}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1"
                >
                  Open <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                </a>
              </div>
              
              {/* Iframe Embed */}
              <div className="relative w-full" style={{ height: '700px' }}>
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

        {/* Back to ShoutOut link */}
        <div className="mt-8 text-center">
          <a
            href="https://shoutout.us/dashboard"
            className="text-gray-500 hover:text-gray-400 text-sm transition-colors"
          >
            ← Back to ShoutOut Dashboard
          </a>
        </div>
      </div>

      {/* Modals */}
      {showAddModal && (
        <AddLinkModal
          onClose={() => setShowAddModal(false)}
          onAdd={addLink}
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
            await supabase
              .from('talent_profiles')
              .update({ social_accounts: updated })
              .eq('id', talentProfile?.id);
            toast.success('Social link added!');
            setTimeout(refreshPreview, 500);
            setShowAddSocialModal(false);
          }}
          existingPlatforms={socialLinks.map(s => s.platform)}
        />
      )}
    </div>
  );
};

// Add Link Modal
const AddLinkModal: React.FC<{
  onClose: () => void;
  onAdd: (link: Omit<BioLink, 'id' | 'display_order'>) => void;
  talentId: string;
}> = ({ onClose, onAdd, talentId }) => {
  const [linkType, setLinkType] = useState<'basic' | 'grid' | 'newsletter' | 'sponsor'>('basic');
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [gridColumns, setGridColumns] = useState(1);
  const [isFeatured, setIsFeatured] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const result = await uploadImageToWasabi(file, `bio-images/${talentId}`);
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
    onAdd({
      talent_id: talentId,
      link_type: linkType,
      title,
      url,
      thumbnail_url: thumbnailUrl || undefined,
      grid_columns: gridColumns,
      is_active: true,
      is_featured: linkType === 'basic' ? isFeatured : false,
    });
  };

  const linkTypes = [
    { type: 'basic' as const, label: 'Basic Link', icon: LinkIcon, color: 'blue', desc: 'Simple link with title' },
    { type: 'grid' as const, label: 'Grid Card', icon: Squares2X2Icon, color: 'purple', desc: 'Image card with link' },
    { type: 'newsletter' as const, label: 'Newsletter', icon: EnvelopeIcon, color: 'green', desc: 'Email signup form' },
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

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={linkType === 'newsletter' ? 'Join my newsletter' : 'My Website'}
              className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              required
            />
          </div>

          {linkType !== 'newsletter' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">URL</label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
                className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                required
              />
            </div>
          )}

          {/* Image Upload for basic and grid links */}
          {(linkType === 'basic' || linkType === 'grid') && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {linkType === 'basic' ? 'Icon/Image (optional)' : 'Image (optional)'}
              </label>
              
              {thumbnailUrl ? (
                <div className="flex items-center gap-4">
                  <img 
                    src={thumbnailUrl} 
                    alt="Preview" 
                    className={`${linkType === 'basic' ? 'w-16 h-16' : 'w-24 h-24'} rounded-lg object-cover`}
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
              <p className="text-xs text-gray-500 mt-2">
                {linkType === 'basic' 
                  ? 'Add a small icon or image to display next to your link'
                  : 'Add an image to display on the card'
                }
              </p>
            </div>
          )}

          {linkType === 'grid' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Grid Layout</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { cols: 1, label: '1×2', desc: 'Full width' },
                  { cols: 2, label: '2×2', desc: '2 columns' },
                  { cols: 3, label: '2×3', desc: '3 columns' },
                ].map((size) => (
                  <button
                    key={size.cols}
                    type="button"
                    onClick={() => setGridColumns(size.cols)}
                    className={`py-3 px-3 rounded-lg text-sm transition-all ${
                      gridColumns === size.cols
                        ? 'bg-blue-500 text-white'
                        : 'bg-white/10 text-gray-300 hover:bg-white/20'
                    }`}
                  >
                    <div className="font-semibold">{size.label}</div>
                    <div className="text-xs opacity-70">{size.desc}</div>
                  </button>
                ))}
              </div>
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
              Add Link
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
  const [gridColumns, setGridColumns] = useState(link.grid_columns || 1);
  const [isActive, setIsActive] = useState(link.is_active);
  const [isFeatured, setIsFeatured] = useState(link.is_featured || false);
  const [uploading, setUploading] = useState(false);

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
    onSave({
      ...link,
      title,
      url,
      thumbnail_url: thumbnailUrl || undefined,
      grid_columns: gridColumns,
      is_active: isActive,
      is_featured: isFeatured,
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
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
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
              <div className="grid grid-cols-3 gap-2">
                {[
                  { cols: 1, label: '1×2', desc: 'Full width' },
                  { cols: 2, label: '2×2', desc: '2 columns' },
                  { cols: 3, label: '2×3', desc: '3 columns' },
                ].map((size) => (
                  <button
                    key={size.cols}
                    type="button"
                    onClick={() => setGridColumns(size.cols)}
                    className={`py-3 px-3 rounded-lg text-sm transition-all ${
                      gridColumns === size.cols
                        ? 'bg-blue-500 text-white'
                        : 'bg-white/10 text-gray-300 hover:bg-white/20'
                    }`}
                  >
                    <div className="font-semibold">{size.label}</div>
                    <div className="text-xs opacity-70">{size.desc}</div>
                  </button>
                ))}
              </div>
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
                      <span className="text-2xl">{platform.icon}</span>
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
              <span className="text-3xl">
                {SOCIAL_PLATFORMS.find(p => p.id === selectedPlatform)?.icon}
              </span>
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

export default BioDashboard;
