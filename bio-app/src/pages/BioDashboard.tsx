import React, { useState, useEffect } from 'react';
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
  GlobeAltIcon,
  ClipboardIcon,
  ArrowTopRightOnSquareIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';
import { supabase } from '../services/supabase';
import toast from 'react-hot-toast';

// Types
interface TalentProfile {
  id: string;
  user_id: string;
  username?: string;
  full_name?: string;
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
}

interface BioLinkIcon {
  id: string;
  name: string;
  icon_url: string;
  category: string;
}

const BioDashboard: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [user, setUser] = useState<User | null>(null);
  const [talentProfile, setTalentProfile] = useState<TalentProfile | null>(null);
  const [bioSettings, setBioSettings] = useState<BioSettings | null>(null);
  const [links, setLinks] = useState<BioLink[]>([]);
  const [icons, setIcons] = useState<BioLinkIcon[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingLink, setEditingLink] = useState<BioLink | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

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
        // Token is the user ID - fetch user data
        console.log('Bio Dashboard: Authenticating with token:', token);
        console.log('Bio Dashboard: Supabase URL:', process.env.REACT_APP_SUPABASE_URL);
        
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('id', token)
          .single();

        console.log('Bio Dashboard: User query result:', { userData, userError });

        if (userError || !userData) {
          console.error('Bio Dashboard: User lookup failed:', userError);
          setAuthError(`Invalid authentication token. Error: ${userError?.message || 'User not found'}. Please try again from your ShoutOut dashboard.`);
          setLoading(false);
          return;
        }

        setUser(userData);

        // Get talent profile
        const { data: profile, error: profileError } = await supabase
          .from('talent_profiles')
          .select('*')
          .eq('user_id', userData.id)
          .single();

        console.log('Bio Dashboard: Talent profile query result:', { profile, profileError });

        if (profileError || !profile) {
          console.error('Bio Dashboard: Talent profile lookup failed:', profileError);
          setAuthError(`No talent profile found. Error: ${profileError?.message || 'Profile not found'}. You must be a talent to use ShoutOut Bio.`);
          setLoading(false);
          return;
        }

        setTalentProfile(profile);

        // Get or create bio settings
        let { data: settings, error: settingsError } = await supabase
          .from('bio_settings')
          .select('*')
          .eq('talent_id', profile.id)
          .single();

        if (settingsError && settingsError.code === 'PGRST116') {
          // Create default settings
          const defaultSettings: BioSettings = {
            talent_id: profile.id,
            theme: 'glass',
            background_color: '#0a0a0a',
            accent_color: '#3b82f6',
            font_family: 'Inter',
            show_shoutout_card: true,
            is_published: false,
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

        // Get icons
        const { data: iconsData } = await supabase
          .from('bio_link_icons')
          .select('*')
          .eq('is_active', true);

        setIcons(iconsData || []);

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
  const saveSettings = async (updates: Partial<BioSettings>) => {
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
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

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
          updated_at: new Date().toISOString(),
        })
        .eq('id', link.id);

      if (error) throw error;
      setLinks(links.map(l => l.id === link.id ? link : l));
      setEditingLink(null);
      toast.success('Link updated!');
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
    } catch (error) {
      console.error('Error deleting link:', error);
      toast.error('Failed to delete link');
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
    <div className="min-h-screen bg-[#0a0a0a] py-8 px-4">
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full blur-[120px] opacity-20 bg-blue-500" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full blur-[100px] opacity-10 bg-purple-500" />
      </div>

      <div className="max-w-4xl mx-auto relative z-10">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <SparklesIcon className="h-8 w-8 text-blue-400" />
                ShoutOut Bio
              </h1>
              <p className="text-gray-400 mt-1">
                Welcome, {user?.full_name}! Create your personalized link-in-bio page.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={copyBioUrl}
                className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/20 rounded-xl text-white hover:bg-white/10 transition-colors"
              >
                <ClipboardIcon className="h-5 w-5" />
                <span className="hidden sm:inline">{bioUrl}</span>
              </button>
              <a
                href={`https://${bioUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/20 rounded-xl text-white hover:bg-white/10 transition-colors"
              >
                <ArrowTopRightOnSquareIcon className="h-5 w-5" />
                Preview
              </a>
              <button
                onClick={togglePublish}
                disabled={saving}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all ${
                  bioSettings?.is_published
                    ? 'bg-green-500/20 border border-green-500/50 text-green-400 hover:bg-green-500/30'
                    : 'bg-blue-500 text-white hover:bg-blue-600'
                }`}
              >
                {bioSettings?.is_published ? (
                  <>
                    <CheckIcon className="h-5 w-5" />
                    Published
                  </>
                ) : (
                  <>
                    <EyeIcon className="h-5 w-5" />
                    Publish
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Settings Panel */}
          <div className="lg:col-span-1 space-y-6">
            {/* Profile Settings */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <GlobeAltIcon className="h-5 w-5 text-blue-400" />
                Profile Settings
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Instagram Username
                  </label>
                  <div className="flex items-center">
                    <span className="text-gray-500 mr-2">@</span>
                    <input
                      type="text"
                      value={bioSettings?.instagram_username || ''}
                      onChange={(e) => setBioSettings({ ...bioSettings!, instagram_username: e.target.value })}
                      onBlur={() => saveSettings({ instagram_username: bioSettings?.instagram_username })}
                      placeholder="username"
                      className="flex-1 bg-white/5 border border-white/20 rounded-xl px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    One-liner / Tagline
                  </label>
                  <input
                    type="text"
                    value={bioSettings?.one_liner || ''}
                    onChange={(e) => setBioSettings({ ...bioSettings!, one_liner: e.target.value })}
                    onBlur={() => saveSettings({ one_liner: bioSettings?.one_liner })}
                    placeholder="Your catchy tagline..."
                    maxLength={100}
                    className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">{bioSettings?.one_liner?.length || 0}/100</p>
                </div>
              </div>
            </div>

            {/* ShoutOut Card Settings */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <GiftIcon className="h-5 w-5 text-pink-400" />
                ShoutOut Card
              </h2>
              <p className="text-sm text-gray-400 mb-4">
                This card links to your ShoutOut profile and shows a random review.
              </p>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={bioSettings?.show_shoutout_card ?? true}
                  onChange={(e) => saveSettings({ show_shoutout_card: e.target.checked })}
                  className="w-5 h-5 rounded bg-white/10 border-white/20 text-blue-500 focus:ring-blue-500"
                />
                <span className="text-white">Show ShoutOut card on bio page</span>
              </label>
            </div>
          </div>

          {/* Links Panel */}
          <div className="lg:col-span-2">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <LinkIcon className="h-5 w-5 text-blue-400" />
                  Your Links
                </h2>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition-colors"
                >
                  <PlusIcon className="h-5 w-5" />
                  Add Link
                </button>
              </div>

              {links.length === 0 ? (
                <div className="text-center py-12">
                  <LinkIcon className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-400 mb-2">No links yet</h3>
                  <p className="text-gray-500 mb-4">Add your first link to get started</p>
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition-colors"
                  >
                    <PlusIcon className="h-5 w-5" />
                    Add Link
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {links.map((link, index) => (
                    <div
                      key={link.id}
                      className={`bg-white/5 border rounded-xl p-4 transition-all border-white/10 hover:border-white/20 ${!link.is_active ? 'opacity-50' : ''}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex-shrink-0">
                          {link.link_type === 'basic' && (
                            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                              <LinkIcon className="h-5 w-5 text-blue-400" />
                            </div>
                          )}
                          {link.link_type === 'grid' && (
                            <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                              <Squares2X2Icon className="h-5 w-5 text-purple-400" />
                            </div>
                          )}
                          {link.link_type === 'newsletter' && (
                            <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                              <EnvelopeIcon className="h-5 w-5 text-green-400" />
                            </div>
                          )}
                          {link.link_type === 'sponsor' && (
                            <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                              <GiftIcon className="h-5 w-5 text-yellow-400" />
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-white truncate">
                            {link.title || `${link.link_type.charAt(0).toUpperCase() + link.link_type.slice(1)} Link`}
                          </h3>
                          {link.url && (
                            <p className="text-sm text-gray-400 truncate">{link.url}</p>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
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
                  ))}
                </div>
              )}
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

      {/* Add Link Modal */}
      {showAddModal && (
        <AddLinkModal
          onClose={() => setShowAddModal(false)}
          onAdd={addLink}
          talentId={talentProfile?.id || ''}
          icons={icons}
        />
      )}

      {/* Edit Link Modal */}
      {editingLink && (
        <EditLinkModal
          link={editingLink}
          onClose={() => setEditingLink(null)}
          onSave={updateLink}
          icons={icons}
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
  icons: BioLinkIcon[];
}> = ({ onClose, onAdd, talentId, icons }) => {
  const [linkType, setLinkType] = useState<'basic' | 'grid' | 'newsletter' | 'sponsor'>('basic');
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd({
      talent_id: talentId,
      link_type: linkType,
      title,
      url,
      is_active: true,
    });
  };

  const linkTypes = [
    { type: 'basic' as const, label: 'Basic Link', icon: LinkIcon, color: 'blue', desc: 'Simple link with icon and title' },
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
            <div className="space-y-2">
              {linkTypes.map((lt) => (
                <button
                  key={lt.type}
                  type="button"
                  onClick={() => setLinkType(lt.type)}
                  className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                    linkType === lt.type
                      ? 'border-blue-500 bg-blue-500/20'
                      : 'border-white/20 hover:border-white/40'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <lt.icon className="h-6 w-6 text-blue-400" />
                    <div>
                      <h3 className="font-medium text-white">{lt.label}</h3>
                      <p className="text-xs text-gray-400">{lt.desc}</p>
                    </div>
                  </div>
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
              placeholder="My Website"
              className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              required
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
              required={linkType !== 'newsletter'}
            />
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
  icons: BioLinkIcon[];
}> = ({ link, onClose, onSave, icons }) => {
  const [title, setTitle] = useState(link.title || '');
  const [url, setUrl] = useState(link.url || '');
  const [isActive, setIsActive] = useState(link.is_active);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...link,
      title,
      url,
      is_active: isActive,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1a1a] border border-white/20 rounded-2xl p-6 w-full max-w-lg">
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

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-5 h-5 rounded bg-white/10 border-white/20 text-blue-500 focus:ring-blue-500"
            />
            <span className="text-white">Link is active</span>
          </label>

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
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BioDashboard;

