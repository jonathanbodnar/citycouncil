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
}

interface SocialAccount {
  id: string;
  platform: string;
  handle: string;
}

// Social platform configurations
const SOCIAL_PLATFORMS: Record<string, { icon: string; baseUrl: string; name: string }> = {
  instagram: { icon: '📸', baseUrl: 'https://instagram.com/', name: 'Instagram' },
  twitter: { icon: '𝕏', baseUrl: 'https://x.com/', name: 'X' },
  tiktok: { icon: '🎵', baseUrl: 'https://tiktok.com/@', name: 'TikTok' },
  youtube: { icon: '▶️', baseUrl: 'https://youtube.com/@', name: 'YouTube' },
  facebook: { icon: '📘', baseUrl: 'https://facebook.com/', name: 'Facebook' },
  linkedin: { icon: '💼', baseUrl: 'https://linkedin.com/in/', name: 'LinkedIn' },
  threads: { icon: '🧵', baseUrl: 'https://threads.net/@', name: 'Threads' },
  snapchat: { icon: '👻', baseUrl: 'https://snapchat.com/add/', name: 'Snapchat' },
  pinterest: { icon: '📌', baseUrl: 'https://pinterest.com/', name: 'Pinterest' },
  spotify: { icon: '🎧', baseUrl: 'https://open.spotify.com/user/', name: 'Spotify' },
  twitch: { icon: '🎮', baseUrl: 'https://twitch.tv/', name: 'Twitch' },
  discord: { icon: '💬', baseUrl: 'https://discord.gg/', name: 'Discord' },
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

const BioPage: React.FC = () => {
  const { username } = useParams<{ username: string }>();
  const [talentProfile, setTalentProfile] = useState<TalentProfile | null>(null);
  const [bioSettings, setBioSettings] = useState<BioSettings | null>(null);
  const [links, setLinks] = useState<BioLink[]>([]);
  const [randomReview, setRandomReview] = useState<Review | null>(null);
  const [newsletterConfig, setNewsletterConfig] = useState<NewsletterConfig | null>(null);
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

        // Get bio settings
        const { data: settings, error: settingsError } = await supabase
          .from('bio_settings')
          .select('*')
          .eq('talent_id', profile.id)
          .single();

        if (settingsError || !settings || !settings.is_published) {
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

      } catch (error) {
        console.error('Error fetching bio data:', error);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };

    fetchBioData();
  }, [username]);

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
          {/* Regular Links */}
          {links.filter(l => l.link_type === 'basic').map((link) => (
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => handleLinkClick(link)}
              className={`${getRadiusClass()} hover:scale-[1.02] active:scale-[0.98]`}
              style={getButtonStyle()}
            >
              <div className="flex items-center justify-center gap-3">
                {link.thumbnail_url ? (
                  <img src={link.thumbnail_url} alt="" className="w-8 h-8 rounded-lg object-cover" />
                ) : link.icon_url ? (
                  <img src={link.icon_url} alt="" className="w-6 h-6" />
                ) : null}
                <span className="text-white font-medium">{link.title}</span>
                <ArrowTopRightOnSquareIcon className="h-4 w-4 text-white/60" />
              </div>
            </a>
          ))}

          {/* Grid Links - Support 1x2, 2x2, 2x3 layouts */}
          {links.filter(l => l.link_type === 'grid').length > 0 && (() => {
            const gridLinks = links.filter(l => l.link_type === 'grid');
            // Determine grid columns based on the grid_columns value (1=full, 2=half, 3=third)
            const maxCols = Math.max(...gridLinks.map(l => l.grid_columns || 2));
            const gridClass = maxCols === 3 ? 'grid-cols-3' : 'grid-cols-2';
            
            return (
              <div className={`grid ${gridClass} gap-3`}>
                {gridLinks.map((link) => {
                  // Calculate span: 1 col = full width, 2 = half, 3 = third
                  const colSpan = link.grid_columns === 1 ? (maxCols === 3 ? 'col-span-3' : 'col-span-2') : 
                                  link.grid_columns === 3 ? 'col-span-1' : 'col-span-1';
                  
                  return (
                    <a
                      key={link.id}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => handleLinkClick(link)}
                      className={`${colSpan} aspect-square ${getRadiusClass()} overflow-hidden relative group`}
                      style={getButtonStyle()}
                    >
                      {link.thumbnail_url ? (
                        <>
                          <img 
                            src={link.thumbnail_url} 
                            alt={link.title || ''} 
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end p-3">
                            <span className="text-white font-medium text-sm">{link.title}</span>
                          </div>
                        </>
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center p-4">
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
          {hasNewsletterLink && (
            <div 
              className={`${getRadiusClass()}`}
              style={{
                ...getButtonStyle(),
                padding: bioSettings?.button_style === 'pill' ? '24px 32px' : '16px',
              }}
            >
              <div className="flex items-center gap-3 mb-3">
                <EnvelopeIcon className="h-6 w-6 text-green-400" />
                <h3 className="text-white font-medium">
                  {links.find(l => l.link_type === 'newsletter')?.title || 'Join my newsletter'}
                </h3>
              </div>
              <form onSubmit={handleNewsletterSignup} className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={newsletterEmail}
                    onChange={(e) => setNewsletterEmail(e.target.value)}
                    placeholder="Enter your email"
                    required
                    className="flex-1 bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-white/40"
                  />
                  <button
                    type="submit"
                    disabled={subscribing || !newsletterConfig || !privacyAccepted}
                    className="px-4 py-2 rounded-lg font-medium text-white transition-colors disabled:opacity-50"
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
              <div className="flex items-center justify-center gap-3">
                <GiftIcon className="h-6 w-6 text-yellow-400" />
                <span className="text-white font-medium">{link.title || 'Become a Sponsor'}</span>
              </div>
            </a>
          ))}

          {/* ShoutOut Card - Always at the bottom */}
          {bioSettings?.show_shoutout_card && (
            <a
              href={`https://shoutout.us/${talentProfile?.username || talentProfile?.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block mt-6"
            >
              <div className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-2xl p-5 border border-blue-500/30 hover:border-blue-500/50 transition-all duration-300 hover:scale-[1.02]">
                <div className="flex items-start gap-4">
                  {/* Profile Image */}
                  <div className="w-14 h-14 rounded-full overflow-hidden flex-shrink-0 border-2 border-blue-500/50">
                    {profileImage ? (
                      <img 
                        src={profileImage} 
                        alt="" 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                        <GiftIcon className="h-6 w-6 text-white" />
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <GiftIcon className="h-5 w-5 text-blue-400" />
                      <span className="text-blue-400 text-sm font-medium">ShoutOut</span>
                    </div>
                    <h3 className="text-white font-semibold mb-1">
                      Get a personalized video from {displayName}
                    </h3>
                    
                    {/* Random Review - Show first line only */}
                    {randomReview && (
                      <div className="mt-3 pt-3 border-t border-white/10">
                        <div className="flex items-center gap-1 mb-1">
                          {[...Array(5)].map((_, i) => (
                            i < randomReview.rating ? (
                              <StarSolidIcon key={i} className="h-4 w-4 text-yellow-400" />
                            ) : (
                              <StarIcon key={i} className="h-4 w-4 text-gray-600" />
                            )
                          ))}
                        </div>
                        {randomReview.comment && (
                          <p className="text-gray-300 text-sm line-clamp-1">
                            "{randomReview.comment.split('\n')[0]}"
                          </p>
                        )}
                        {randomReview.users?.full_name && (
                          <p className="text-gray-500 text-xs mt-1">
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
        {talentProfile?.social_accounts && talentProfile.social_accounts.length > 0 && (
          <div className="mt-8 flex justify-center gap-4 flex-wrap">
            {talentProfile.social_accounts.map((social) => {
              const platform = SOCIAL_PLATFORMS[social.platform];
              if (!platform) return null;
              
              return (
                <a
                  key={social.id}
                  href={`${platform.baseUrl}${social.handle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-12 h-12 rounded-full flex items-center justify-center text-2xl transition-all hover:scale-110"
                  style={{
                    backgroundColor: `${bioSettings?.button_color || '#3b82f6'}30`,
                    border: `1px solid ${bioSettings?.button_color || '#3b82f6'}50`,
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
