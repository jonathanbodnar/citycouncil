import React, { useState, useEffect, useCallback } from 'react';
import { 
  PlusIcon, 
  TrashIcon, 
  PencilIcon,
  LinkIcon,
  Squares2X2Icon,
  EnvelopeIcon,
  GiftIcon,
  ArrowsUpDownIcon,
  EyeIcon,
  CheckIcon,
  XMarkIcon,
  PhotoIcon,
  GlobeAltIcon,
  ClipboardIcon,
  ArrowTopRightOnSquareIcon,
  SparklesIcon,
  CloudArrowUpIcon
} from '@heroicons/react/24/outline';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { TalentProfile, Review } from '../types';
import toast from 'react-hot-toast';

// Types
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
  grid_cards?: BioGridCard[];
}

interface BioGridCard {
  id?: string;
  bio_link_id?: string;
  title?: string;
  url: string;
  image_url: string;
  display_order: number;
}

interface LinkIcon {
  id: string;
  name: string;
  icon_url: string;
  category: string;
}

const BioDashboard: React.FC = () => {
  const { user } = useAuth();
  const [talentProfile, setTalentProfile] = useState<TalentProfile | null>(null);
  const [bioSettings, setBioSettings] = useState<BioSettings | null>(null);
  const [links, setLinks] = useState<BioLink[]>([]);
  const [icons, setIcons] = useState<LinkIcon[]>([]);
  const [randomReview, setRandomReview] = useState<Review | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingLink, setEditingLink] = useState<BioLink | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newLinkType, setNewLinkType] = useState<'basic' | 'grid' | 'newsletter' | 'sponsor'>('basic');
  const [importUrl, setImportUrl] = useState('');
  const [importing, setImporting] = useState(false);

  // Fetch data
  const fetchData = useCallback(async () => {
    if (!user?.id) return;

    try {
      setLoading(true);

      // Get talent profile
      const { data: profile, error: profileError } = await supabase
        .from('talent_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (profileError) throw profileError;
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

        if (createError) throw createError;
        settings = newSettings;
      } else if (settingsError) {
        throw settingsError;
      }

      setBioSettings(settings);

      // Get links
      const { data: linksData, error: linksError } = await supabase
        .from('bio_links')
        .select('*, bio_grid_cards(*)')
        .eq('talent_id', profile.id)
        .order('display_order');

      if (linksError) throw linksError;
      setLinks(linksData || []);

      // Get icons
      const { data: iconsData } = await supabase
        .from('bio_link_icons')
        .select('*')
        .eq('is_active', true);

      setIcons(iconsData || []);

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
      toast.error('Failed to load bio settings');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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

  // Reorder links
  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    const items = Array.from(links);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Update display order
    const updatedItems = items.map((item, index) => ({
      ...item,
      display_order: index,
    }));

    setLinks(updatedItems);

    // Save to database
    try {
      const updates = updatedItems.map(item => ({
        id: item.id,
        display_order: item.display_order,
      }));

      for (const update of updates) {
        await supabase
          .from('bio_links')
          .update({ display_order: update.display_order })
          .eq('id', update.id);
      }
    } catch (error) {
      console.error('Error reordering links:', error);
      toast.error('Failed to save order');
    }
  };

  // Copy bio URL
  const copyBioUrl = () => {
    const url = `https://shouts.bio/${talentProfile?.username || talentProfile?.id}`;
    navigator.clipboard.writeText(url);
    toast.success('Bio URL copied!');
  };

  // Publish/unpublish
  const togglePublish = async () => {
    await saveSettings({ is_published: !bioSettings?.is_published });
  };

  // Import from URL (placeholder - would need edge function)
  const handleImport = async () => {
    if (!importUrl.trim()) return;

    setImporting(true);
    toast.loading('Importing links...', { id: 'import' });

    try {
      // This would call an edge function to scrape the URL
      // For now, just show a placeholder message
      await new Promise(resolve => setTimeout(resolve, 2000));
      toast.success('Import feature coming soon!', { id: 'import' });
      setImportUrl('');
    } catch (error) {
      toast.error('Failed to import links', { id: 'import' });
    } finally {
      setImporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const bioUrl = `shouts.bio/${talentProfile?.username || talentProfile?.id}`;

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <SparklesIcon className="h-8 w-8 text-blue-400" />
              ShoutOut Bio
            </h1>
            <p className="text-gray-400 mt-1">
              Create your personalized link-in-bio page
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={copyBioUrl}
              className="flex items-center gap-2 px-4 py-2 glass border border-white/20 rounded-xl text-white hover:bg-white/10 transition-colors"
            >
              <ClipboardIcon className="h-5 w-5" />
              <span className="hidden sm:inline">{bioUrl}</span>
            </button>
            <a
              href={`https://${bioUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 glass border border-white/20 rounded-xl text-white hover:bg-white/10 transition-colors"
            >
              <ArrowTopRightOnSquareIcon className="h-5 w-5" />
              Preview
            </a>
            <button
              onClick={togglePublish}
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
          <div className="glass border border-white/20 rounded-2xl p-6">
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

          {/* Import Links */}
          <div className="glass border border-white/20 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <CloudArrowUpIcon className="h-5 w-5 text-purple-400" />
              Import Links
            </h2>
            <p className="text-sm text-gray-400 mb-4">
              Import links from your existing link-in-bio page
            </p>
            <div className="flex gap-2">
              <input
                type="url"
                value={importUrl}
                onChange={(e) => setImportUrl(e.target.value)}
                placeholder="https://linktr.ee/yourpage"
                className="flex-1 bg-white/5 border border-white/20 rounded-xl px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
              />
              <button
                onClick={handleImport}
                disabled={importing || !importUrl.trim()}
                className="px-4 py-2 bg-purple-500 text-white rounded-xl font-medium hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {importing ? '...' : 'Import'}
              </button>
            </div>
          </div>

          {/* ShoutOut Card Settings */}
          <div className="glass border border-white/20 rounded-2xl p-6">
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
          <div className="glass border border-white/20 rounded-2xl p-6">
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
              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="links">
                  {(provided) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className="space-y-3"
                    >
                      {links.map((link, index) => (
                        <Draggable key={link.id} draggableId={link.id!} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className={`glass border rounded-xl p-4 transition-all ${
                                snapshot.isDragging
                                  ? 'border-blue-500 shadow-lg shadow-blue-500/20'
                                  : 'border-white/20 hover:border-white/40'
                              } ${!link.is_active ? 'opacity-50' : ''}`}
                            >
                              <div className="flex items-center gap-4">
                                <div
                                  {...provided.dragHandleProps}
                                  className="cursor-grab active:cursor-grabbing"
                                >
                                  <ArrowsUpDownIcon className="h-5 w-5 text-gray-500" />
                                </div>

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
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            )}
          </div>

          {/* Preview Card */}
          {bioSettings?.show_shoutout_card && (
            <div className="mt-6 glass border border-white/20 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">ShoutOut Card Preview</h2>
              <div className="max-w-sm mx-auto">
                <ShoutOutCardPreview
                  talentProfile={talentProfile}
                  review={randomReview}
                />
              </div>
            </div>
          )}
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

// ShoutOut Card Preview Component
const ShoutOutCardPreview: React.FC<{
  talentProfile: TalentProfile | null;
  review: Review | null;
}> = ({ talentProfile, review }) => {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    const fetchAvatar = async () => {
      if (!talentProfile?.user_id) return;
      const { data } = await supabase
        .from('users')
        .select('avatar_url')
        .eq('id', talentProfile.user_id)
        .single();
      if (data?.avatar_url) setAvatarUrl(data.avatar_url);
    };
    fetchAvatar();
  }, [talentProfile?.user_id]);

  return (
    <div className="bg-gradient-to-br from-blue-600/20 to-purple-600/20 border border-white/20 rounded-2xl p-4 backdrop-blur-xl">
      <div className="flex items-center gap-4 mb-4">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt=""
            className="w-16 h-16 rounded-full object-cover border-2 border-white/30"
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
            <SparklesIcon className="h-8 w-8 text-white" />
          </div>
        )}
        <div>
          <p className="text-sm text-gray-300">Get a personalized ShoutOut from</p>
          <h3 className="text-lg font-bold text-white">{talentProfile?.full_name || 'Talent Name'}</h3>
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
      
      <button className="w-full py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity">
        Get Your ShoutOut →
      </button>
    </div>
  );
};

// Add Link Modal
const AddLinkModal: React.FC<{
  onClose: () => void;
  onAdd: (link: Omit<BioLink, 'id' | 'display_order'>) => void;
  talentId: string;
  icons: LinkIcon[];
}> = ({ onClose, onAdd, talentId, icons }) => {
  const [linkType, setLinkType] = useState<'basic' | 'grid' | 'newsletter' | 'sponsor'>('basic');
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [iconUrl, setIconUrl] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd({
      talent_id: talentId,
      link_type: linkType,
      title,
      url,
      icon_url: iconUrl,
      is_active: true,
    });
  };

  const linkTypes = [
    { type: 'basic' as const, label: 'Basic Link', icon: LinkIcon, color: 'blue', desc: 'Simple link with icon and title' },
    { type: 'grid' as const, label: 'Grid Cards', icon: Squares2X2Icon, color: 'purple', desc: 'Image grid with multiple links' },
    { type: 'newsletter' as const, label: 'Newsletter', icon: EnvelopeIcon, color: 'green', desc: 'Email signup form' },
    { type: 'sponsor' as const, label: 'Become a Sponsor', icon: GiftIcon, color: 'yellow', desc: 'Sponsorship CTA' },
  ];

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass border border-white/20 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
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
            <div className="grid grid-cols-2 gap-3">
              {linkTypes.map((lt) => (
                <button
                  key={lt.type}
                  type="button"
                  onClick={() => setLinkType(lt.type)}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    linkType === lt.type
                      ? `border-${lt.color}-500 bg-${lt.color}-500/20`
                      : 'border-white/20 hover:border-white/40'
                  }`}
                >
                  <lt.icon className={`h-6 w-6 text-${lt.color}-400 mb-2`} />
                  <h3 className="font-medium text-white">{lt.label}</h3>
                  <p className="text-xs text-gray-400">{lt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {linkType === 'basic' && (
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
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Icon (optional)</label>
                <div className="grid grid-cols-6 gap-2">
                  {icons.map((icon) => (
                    <button
                      key={icon.id}
                      type="button"
                      onClick={() => setIconUrl(icon.icon_url)}
                      className={`p-3 rounded-lg border-2 transition-all ${
                        iconUrl === icon.icon_url
                          ? 'border-blue-500 bg-blue-500/20'
                          : 'border-white/20 hover:border-white/40'
                      }`}
                    >
                      <img src={icon.icon_url} alt={icon.name} className="w-6 h-6 mx-auto invert" />
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {linkType === 'newsletter' && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
              <p className="text-green-300 text-sm">
                Newsletter integration settings will be configured after adding this link.
                You can connect to Mailchimp, GetResponse, Flodesk, and more.
              </p>
            </div>
          )}

          {linkType === 'grid' && (
            <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4">
              <p className="text-purple-300 text-sm">
                After adding this link, you can upload images and configure the grid layout.
              </p>
            </div>
          )}

          {linkType === 'sponsor' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Sponsor Link URL</label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://your-sponsor-page.com"
                className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500"
              />
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 glass border border-white/20 text-white rounded-xl font-medium hover:bg-white/10 transition-colors"
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
  icons: LinkIcon[];
}> = ({ link, onClose, onSave, icons }) => {
  const [title, setTitle] = useState(link.title || '');
  const [url, setUrl] = useState(link.url || '');
  const [iconUrl, setIconUrl] = useState(link.icon_url || '');
  const [isActive, setIsActive] = useState(link.is_active);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...link,
      title,
      url,
      icon_url: iconUrl,
      is_active: isActive,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass border border-white/20 rounded-2xl p-6 w-full max-w-lg">
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

          {link.link_type === 'basic' && (
            <>
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
                <label className="block text-sm font-medium text-gray-300 mb-2">Icon</label>
                <div className="grid grid-cols-6 gap-2">
                  {icons.map((icon) => (
                    <button
                      key={icon.id}
                      type="button"
                      onClick={() => setIconUrl(icon.icon_url)}
                      className={`p-3 rounded-lg border-2 transition-all ${
                        iconUrl === icon.icon_url
                          ? 'border-blue-500 bg-blue-500/20'
                          : 'border-white/20 hover:border-white/40'
                      }`}
                    >
                      <img src={icon.icon_url} alt={icon.name} className="w-6 h-6 mx-auto invert" />
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

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
              className="flex-1 px-4 py-3 glass border border-white/20 text-white rounded-xl font-medium hover:bg-white/10 transition-colors"
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




