import React, { useState, useEffect } from 'react';
import { MagnifyingGlassIcon, HeartIcon } from '@heroicons/react/24/outline';
import { supabase } from '../services/supabase';
import { TalentProfile, TalentCategory } from '../types';
import TalentCard from '../components/TalentCard';
import FeaturedCarousel from '../components/FeaturedCarousel';

interface TalentWithUser extends TalentProfile {
  users: {
    id: string;
    full_name: string;
    avatar_url?: string;
  };
}

const TALENT_CATEGORIES = [
  { key: 'politician', label: 'Politicians' },
  { key: 'candidate', label: 'Candidates' },
  { key: 'party-leader', label: 'Party Leaders' },
  { key: 'reporter', label: 'Reporters' },
  { key: 'tv-host', label: 'TV/Radio Hosts' },
  { key: 'commentator', label: 'Commentators' },
  { key: 'author', label: 'Authors/Speakers' },
  { key: 'comedian', label: 'Comedians' },
  { key: 'musician', label: 'Musicians' },
  { key: 'actor', label: 'Actors' },
  { key: 'influencer', label: 'Influencers' },
  { key: 'activist', label: 'Activists' },
  { key: 'faith-leader', label: 'Faith Leaders' },
  { key: 'academic', label: 'Academics' },
  { key: 'military', label: 'Military/Veterans' },
  { key: 'youth-leader', label: 'Youth Leaders' },
  { key: 'patriotic-entertainer', label: 'Patriotic Entertainers' },
  { key: 'other', label: 'Other' },
];

const HomePage: React.FC = () => {
  const [talent, setTalent] = useState<TalentWithUser[]>([]);
  const [featuredTalent, setFeaturedTalent] = useState<TalentWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<TalentCategory | 'all'>('all');
  const [availableCategories, setAvailableCategories] = useState<TalentCategory[]>([]);

  useEffect(() => {
    fetchTalent();
    fetchFeaturedTalent();
  }, []);

  const fetchTalent = async () => {
    try {
      const { data, error } = await supabase
        .from('talent_profiles')
        .select(`
          *,
          users!talent_profiles_user_id_fkey (
            id,
            full_name,
            avatar_url
          )
        `)
        .eq('is_active', true)
        .order('total_orders', { ascending: false });

      if (error) throw error;

      const talentWithUsers = data.map(profile => ({
        ...profile,
        user: profile.users,
      }));

      setTalent(talentWithUsers);

      // Get available categories from both single category and categories array
      const allCategories = data.flatMap(t => 
        t.categories && t.categories.length > 0 ? t.categories : [t.category]
      );
      const categories = Array.from(new Set(allCategories));
      setAvailableCategories(categories);
    } catch (error) {
      console.error('Error fetching talent:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFeaturedTalent = async () => {
    try {
      const { data, error } = await supabase
        .from('talent_profiles')
        .select(`
          *,
          users!talent_profiles_user_id_fkey (
            id,
            full_name,
            avatar_url
          )
        `)
        .eq('is_featured', true)
        .eq('is_active', true)
        .limit(5);

      if (error) throw error;

      console.log('Featured talent raw data:', data);

      // Filter out any profiles without valid user data
      const featuredWithUsers = (data || [])
        .filter(profile => {
          const hasValidUser = profile.users && profile.users.id;
          if (!hasValidUser) {
            console.warn('Skipping featured talent without valid user:', profile.id);
          }
          return hasValidUser;
        })
        .map(profile => ({
          ...profile,
          user: profile.users,
        }));

      console.log('Featured talent after filtering:', featuredWithUsers);
      setFeaturedTalent(featuredWithUsers);
    } catch (error) {
      console.error('Error fetching featured talent:', error);
    }
  };

  const filteredTalent = talent.filter(t => {
    const matchesSearch = !searchQuery || 
      t.users.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.bio.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = selectedCategory === 'all' || 
      (t.categories && t.categories.length > 0 
        ? t.categories.includes(selectedCategory) 
        : t.category === selectedCategory);
    
    return matchesSearch && matchesCategory;
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-white">

      {/* Featured Talent Carousel */}
      {featuredTalent.length > 0 && (
        <div className="mb-12">
          <FeaturedCarousel talent={featuredTalent} />
        </div>
      )}

      {/* Category Filter with Search */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Browse by Category</h3>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setSearchQuery(searchQuery ? '' : 'search')}
              className="p-2 text-gray-600 hover:text-blue-600 rounded-xl hover:bg-blue-50 transition-all duration-200"
              title="Search talent"
            >
              <MagnifyingGlassIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
        
        {/* Expandable Search */}
        {searchQuery !== '' && (
          <div className="mb-4">
            <div className="max-w-md relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search talent..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                value={searchQuery === 'search' ? '' : searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
              selectedCategory === 'all'
                ? 'glass-strong text-white shadow-lg border-white/30'
                : 'glass text-white/80 hover:glass-strong hover:text-white border-white/10'
            }`}
          >
            All Categories
          </button>
          {TALENT_CATEGORIES
            .filter(cat => availableCategories.includes(cat.key as TalentCategory))
            .map(category => (
              <button
                key={category.key}
                onClick={() => setSelectedCategory(category.key as TalentCategory)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                  selectedCategory === category.key
                    ? 'glass-strong text-white shadow-lg border-white/30'
                    : 'glass text-white/80 hover:glass-strong hover:text-white border-white/10'
                }`}
              >
                {category.label}
              </button>
            ))}
        </div>
      </div>

      {/* Talent Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredTalent.map(talentProfile => (
          <TalentCard key={talentProfile.id} talent={talentProfile} />
        ))}
      </div>

      {filteredTalent.length === 0 && (
        <div className="text-center py-12">
          <HeartIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No talent found</h3>
          <p className="mt-1 text-sm text-gray-500">
            Try adjusting your search or category filter.
          </p>
        </div>
      )}

    </div>
  );
};

export default HomePage;
