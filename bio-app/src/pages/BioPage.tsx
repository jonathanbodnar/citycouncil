import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { 
  SparklesIcon,
  ArrowTopRightOnSquareIcon,
  EnvelopeIcon,
  GiftIcon
} from '@heroicons/react/24/outline';
import { supabase } from '../services/supabase';
import { TalentProfile, Review, BioSettings, BioLink } from '../types';
import toast from 'react-hot-toast';

interface TalentUser {
  full_name: string;
  avatar_url?: string;
}

const BioPage: React.FC = () => {
  const { username } = useParams<{ username: string }>();
  const [talentProfile, setTalentProfile] = useState<TalentProfile | null>(null);
  const [talentUser, setTalentUser] = useState<TalentUser | null>(null);
  const [bioSettings, setBioSettings] = useState<BioSettings | null>(null);
  const [links, setLinks] = useState<BioLink[]>([]);
  const [randomReview, setRandomReview] = useState<Review | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [email, setEmail] = useState('');
  const [subscribing, setSubscribing] = useState(false);

  useEffect(() => {
    const fetchBioData = async () => {
      if (!username) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      try {
        // Find talent by username or ID
        let { data: profile, error: profileError } = await supabase
          .from('talent_profiles')
          .select('*')
          .eq('username', username)
          .single();

        if (profileError) {
          // Try by ID
          const { data: profileById, error: idError } = await supabase
            .from('talent_profiles')
            .select('*')
            .eq('id', username)
            .single();

          if (idError) {
            setNotFound(true);
            setLoading(false);
            return;
          }
          profile = profileById;
        }

        setTalentProfile(profile);

        // Get user info
        if (profile.user_id) {
          const { data: userData } = await supabase
            .from('users')
            .select('full_name, avatar_url')
            .eq('id', profile.user_id)
            .single();

          if (userData) {
            setTalentUser(userData);
          }
        }

        // Get bio settings
        const { data: settings, error: settingsError } = await supabase
          .from('bio_settings')
          .select('*')
          .eq('talent_id', profile.id)
          .single();

        if (settingsError || !settings?.is_published) {
          setNotFound(true);
          setLoading(false);
          return;
        }

        setBioSettings(settings);

        // Get links
        const { data: linksData } = await supabase
          .from('bio_links')
          .select('*, bio_grid_cards(*)')
          .eq('talent_id', profile.id)
          .eq('is_active', true)
          .order('display_order');

        setLinks(linksData || []);

        // Get random review for ShoutOut card
        const { data: reviews } = await supabase
          .from('reviews')
          .select('*')
          .eq('talent_id', profile.id)
          .gte('rating', 4);

        if (reviews && reviews.length > 0) {
          setRandomReview(reviews[Math.floor(Math.random() * reviews.length)]);
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

  const handleNewsletterSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setSubscribing(true);
    try {
      // This would integrate with the newsletter provider
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast.success('Successfully subscribed!');
      setEmail('');
    } catch (error) {
      toast.error('Failed to subscribe');
    } finally {
      setSubscribing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-4">
        <SparklesIcon className="h-16 w-16 text-gray-600 mb-4" />
        <h1 className="text-2xl font-bold text-white mb-2">Bio Not Found</h1>
        <p className="text-gray-400 mb-6">This bio page doesn't exist or isn't published yet.</p>
        <a
          href="https://shoutout.us"
          className="px-6 py-3 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition-colors"
        >
          Go to ShoutOut
        </a>
      </div>
    );
  }

  const displayName = talentUser?.full_name || talentProfile?.full_name || 'Creator';
  const avatarUrl = talentUser?.avatar_url || talentProfile?.temp_avatar_url;

  return (
    <div 
      className="min-h-screen py-8 px-4"
      style={{ 
        backgroundColor: bioSettings?.background_color || '#0a0a0a',
        fontFamily: bioSettings?.font_family || 'Inter',
      }}
    >
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div 
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full blur-[120px] opacity-20"
          style={{ backgroundColor: bioSettings?.accent_color || '#3b82f6' }}
        />
        <div 
          className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full blur-[100px] opacity-10"
          style={{ backgroundColor: bioSettings?.accent_color || '#3b82f6' }}
        />
      </div>

      <div className="max-w-md mx-auto relative z-10">
        {/* Profile Header */}
        <div className="text-center mb-8">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={displayName}
              className="w-24 h-24 rounded-full object-cover mx-auto mb-4 border-2 border-white/20 shadow-lg"
            />
          ) : (
            <div 
              className="w-24 h-24 rounded-full mx-auto mb-4 flex items-center justify-center border-2 border-white/20"
              style={{ backgroundColor: bioSettings?.accent_color || '#3b82f6' }}
            >
              <SparklesIcon className="h-12 w-12 text-white" />
            </div>
          )}

          <h1 className="text-2xl font-bold text-white mb-1">{displayName}</h1>
          
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

          {bioSettings?.one_liner && (
            <p className="text-gray-300 mt-3 max-w-xs mx-auto">{bioSettings.one_liner}</p>
          )}
        </div>

        {/* Links */}
        <div className="space-y-4">
          {links.map((link) => (
            <BioLinkItem
              key={link.id}
              link={link}
              accentColor={bioSettings?.accent_color || '#3b82f6'}
              email={email}
              setEmail={setEmail}
              onSubscribe={handleNewsletterSubscribe}
              subscribing={subscribing}
            />
          ))}

          {/* ShoutOut Card */}
          {bioSettings?.show_shoutout_card && (
            <ShoutOutCard
              talentProfile={talentProfile}
              displayName={displayName}
              avatarUrl={avatarUrl}
              review={randomReview}
              accentColor={bioSettings?.accent_color || '#3b82f6'}
            />
          )}
        </div>

        {/* Footer */}
        <div className="mt-12 text-center">
          <a
            href="https://shoutout.us"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-400 text-sm transition-colors"
          >
            <SparklesIcon className="h-4 w-4" />
            Powered by ShoutOut
          </a>
        </div>
      </div>
    </div>
  );
};

// Bio Link Item Component
const BioLinkItem: React.FC<{
  link: BioLink;
  accentColor: string;
  email: string;
  setEmail: (email: string) => void;
  onSubscribe: (e: React.FormEvent) => void;
  subscribing: boolean;
}> = ({ link, accentColor, email, setEmail, onSubscribe, subscribing }) => {
  if (link.link_type === 'basic') {
    return (
      <a
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block w-full p-4 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all group"
      >
        <div className="flex items-center gap-4">
          {link.icon_url ? (
            <img src={link.icon_url} alt="" className="w-6 h-6 invert opacity-70 group-hover:opacity-100 transition-opacity" />
          ) : (
            <ArrowTopRightOnSquareIcon className="w-6 h-6 text-gray-400 group-hover:text-white transition-colors" />
          )}
          <span className="flex-1 text-white font-medium">{link.title}</span>
          <ArrowTopRightOnSquareIcon className="w-5 h-5 text-gray-500 group-hover:text-white transition-colors" />
        </div>
      </a>
    );
  }

  if (link.link_type === 'grid' && link.bio_grid_cards && link.bio_grid_cards.length > 0) {
    const gridCols = link.grid_size === 'small' ? 'grid-cols-4' : link.grid_size === 'large' ? 'grid-cols-2' : 'grid-cols-3';
    
    return (
      <div className="p-4 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10">
        {link.title && (
          <h3 className="text-white font-medium mb-4">{link.title}</h3>
        )}
        <div className={`grid ${gridCols} gap-2`}>
          {link.bio_grid_cards.map((card) => (
            <a
              key={card.id}
              href={card.url}
              target="_blank"
              rel="noopener noreferrer"
              className="aspect-square rounded-xl overflow-hidden hover:opacity-80 transition-opacity"
            >
              <img
                src={card.image_url}
                alt={card.title || ''}
                className="w-full h-full object-cover"
              />
            </a>
          ))}
        </div>
      </div>
    );
  }

  if (link.link_type === 'newsletter') {
    return (
      <div className="p-4 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10">
        <div className="flex items-center gap-3 mb-4">
          <div 
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${accentColor}30` }}
          >
            <EnvelopeIcon className="w-5 h-5" style={{ color: accentColor }} />
          </div>
          <div>
            <h3 className="text-white font-medium">{link.title || 'Join the Newsletter'}</h3>
            <p className="text-sm text-gray-400">Get updates straight to your inbox</p>
          </div>
        </div>
        <form onSubmit={onSubscribe} className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/20 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            required
          />
          <button
            type="submit"
            disabled={subscribing}
            className="px-6 py-3 rounded-xl font-medium text-white transition-colors disabled:opacity-50"
            style={{ backgroundColor: accentColor }}
          >
            {subscribing ? '...' : 'Join'}
          </button>
        </form>
      </div>
    );
  }

  if (link.link_type === 'sponsor') {
    return (
      <a
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block w-full p-4 rounded-2xl border-2 border-dashed border-yellow-500/50 hover:border-yellow-500 hover:bg-yellow-500/10 transition-all group"
      >
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
            <GiftIcon className="w-5 h-5 text-yellow-400" />
          </div>
          <div className="flex-1">
            <span className="text-white font-medium">{link.title || 'Become a Sponsor'}</span>
            <p className="text-sm text-yellow-400/70">Support this creator</p>
          </div>
          <ArrowTopRightOnSquareIcon className="w-5 h-5 text-yellow-500/50 group-hover:text-yellow-500 transition-colors" />
        </div>
      </a>
    );
  }

  return null;
};

// ShoutOut Card Component
const ShoutOutCard: React.FC<{
  talentProfile: TalentProfile | null;
  displayName: string;
  avatarUrl?: string;
  review: Review | null;
  accentColor: string;
}> = ({ talentProfile, displayName, avatarUrl, review, accentColor }) => {
  // Link to the main ShoutOut site for ordering
  const profileUrl = `https://shoutout.us/${talentProfile?.username || talentProfile?.id}`;

  return (
    <div 
      className="p-4 rounded-2xl backdrop-blur-xl border border-white/10 overflow-hidden relative"
      style={{ 
        background: `linear-gradient(135deg, ${accentColor}20 0%, ${accentColor}10 50%, transparent 100%)`,
        borderColor: `${accentColor}30`,
      }}
    >
      {/* Decorative gradient */}
      <div 
        className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-30"
        style={{ backgroundColor: accentColor }}
      />
      
      <div className="relative">
        <div className="flex items-center gap-4 mb-4">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt=""
              className="w-14 h-14 rounded-full object-cover border-2 border-white/20"
            />
          ) : (
            <div 
              className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{ backgroundColor: accentColor }}
            >
              <SparklesIcon className="h-7 w-7 text-white" />
            </div>
          )}
          <div>
            <p className="text-sm text-gray-400">Get a personalized ShoutOut from</p>
            <h3 className="text-lg font-bold text-white">{displayName}</h3>
          </div>
        </div>

        {review && (
          <div className="bg-white/5 rounded-xl p-3 mb-4">
            <div className="flex items-center gap-1 mb-1">
              {[...Array(5)].map((_, i) => (
                <span key={i} className={i < review.rating ? 'text-yellow-400' : 'text-gray-600'}>★</span>
              ))}
            </div>
            <p className="text-sm text-gray-300 line-clamp-2">"{review.comment}"</p>
          </div>
        )}

        <a
          href={profileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full py-3 text-center font-semibold text-white rounded-xl transition-all hover:opacity-90"
          style={{ backgroundColor: accentColor }}
        >
          Get Your ShoutOut →
        </a>
      </div>
    </div>
  );
};

export default BioPage;

