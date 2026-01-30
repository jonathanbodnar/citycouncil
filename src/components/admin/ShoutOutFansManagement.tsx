import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { 
  MagnifyingGlassIcon, 
  EyeIcon, 
  CursorArrowRaysIcon, 
  UsersIcon,
  ArrowDownTrayIcon,
  ChartBarIcon,
  LinkIcon,
  PlayIcon,
  MicrophoneIcon,
  MegaphoneIcon,
  HeartIcon,
  BuildingOfficeIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  Cog6ToothIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

interface TalentBioStats {
  talent_id: string;
  talent_name: string;
  avatar_url: string | null;
  slug: string | null;
  username: string | null;
  page_views: number;
  total_clicks: number;
  link_clicks: number;
  youtube_clicks: number;
  rumble_clicks: number;
  podcast_clicks: number;
  shoutout_clicks: number;
  collab_clicks: number;
  sponsorship_clicks: number;
  services_clicks: number;
  fan_count: number;
  overall_ctr: number;
  view_to_fan_rate: number;
}

interface OverallStats {
  total_views: number;
  total_clicks: number;
  total_fans: number;
  overall_ctr: number;
  ctr_by_card_type: {
    type: string;
    clicks: number;
    ctr: number;
    label: string;
    icon: React.ElementType;
    color: string;
  }[];
}

type SortField = 'talent_name' | 'page_views' | 'total_clicks' | 'overall_ctr' | 'fan_count' | 'view_to_fan_rate';
type SortDirection = 'asc' | 'desc';

const CARD_TYPE_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  youtube: { label: 'YouTube', icon: PlayIcon, color: 'text-red-600 bg-red-100' },
  rumble: { label: 'Rumble', icon: PlayIcon, color: 'text-green-600 bg-green-100' },
  podcast: { label: 'Podcast', icon: MicrophoneIcon, color: 'text-purple-600 bg-purple-100' },
  link: { label: 'Links', icon: LinkIcon, color: 'text-blue-600 bg-blue-100' },
  shoutout: { label: 'ShoutOut Card', icon: MegaphoneIcon, color: 'text-pink-600 bg-pink-100' },
  collab: { label: 'Collab', icon: HeartIcon, color: 'text-orange-600 bg-orange-100' },
  sponsorship: { label: 'Sponsorship', icon: BuildingOfficeIcon, color: 'text-indigo-600 bg-indigo-100' },
  services: { label: 'Services', icon: CursorArrowRaysIcon, color: 'text-teal-600 bg-teal-100' },
};

// Special card types that should NOT be counted as generic "Links"
const SPECIAL_CARD_TYPES = ['youtube', 'rumble', 'podcast', 'shoutout', 'collab', 'sponsorship', 'services', 'newsletter'];

const ShoutOutFansManagement: React.FC = () => {
  const [talentStats, setTalentStats] = useState<TalentBioStats[]>([]);
  const [overallStats, setOverallStats] = useState<OverallStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('page_views');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Get yesterday's date at midnight UTC for CTR calculation baseline (launch date: Jan 29, 2026)
      const ctrBaseline = new Date('2026-01-29T00:00:00Z');
      const ctrBaselineISO = ctrBaseline.toISOString();

      // Fetch talent profiles first
      const { data: talentProfiles } = await supabase
        .from('talent_profiles')
        .select(`
          id,
          slug,
          username,
          temp_full_name,
          temp_avatar_url,
          users!talent_profiles_user_id_fkey (
            full_name,
            avatar_url
          )
        `)
        .eq('is_active', true);

      // Fetch ALL views with pagination (Supabase limits to 1000 per request)
      const pageSize = 1000;
      let allTimeViews: any[] = [];
      let page = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('bio_page_views')
          .select('talent_id')
          .range(page * pageSize, (page + 1) * pageSize - 1);
        
        if (error) {
          console.error('Pagination error:', error);
          break;
        }
        
        if (data && data.length > 0) {
          allTimeViews = [...allTimeViews, ...data];
          page++;
          hasMore = data.length === pageSize;
        } else {
          hasMore = false;
        }
      }

      // Fetch ALL TIME clicks with pagination (same as views)
      let allTimeClicks: any[] = [];
      let clickPage = 0;
      let hasMoreClicks = true;

      while (hasMoreClicks) {
        const { data, error } = await supabase
          .from('bio_link_clicks')
          .select('talent_id, card_type')
          .range(clickPage * pageSize, (clickPage + 1) * pageSize - 1);
        
        if (error) {
          console.error('Click pagination error:', error);
          break;
        }
        
        if (data && data.length > 0) {
          allTimeClicks = [...allTimeClicks, ...data];
          clickPage++;
          hasMoreClicks = data.length === pageSize;
        } else {
          hasMoreClicks = false;
        }
      }

      // Fetch data since launch for CTR and followers
      const [ctrViews, ctrClicks, followers] = await Promise.all([
        // Views since launch for CTR calculation
        supabase
          .from('bio_page_views')
          .select('talent_id')
          .gte('viewed_at', ctrBaselineISO)
          .limit(50000)
          .then(r => r.data || []),
        // Clicks since launch for CTR calculation
        supabase
          .from('bio_link_clicks')
          .select('talent_id, card_type')
          .gte('clicked_at', ctrBaselineISO)
          .limit(50000)
          .then(r => r.data || []),
        supabase
          .from('talent_followers')
          .select('talent_id, user_id')
          .limit(50000)
          .then(r => r.data || [])
      ]);

      console.log('📊 Fetched data:', {
        talentProfiles: talentProfiles?.length,
        allTimeViews: allTimeViews.length,
        allTimeClicks: allTimeClicks.length,
        ctrViews: ctrViews.length,
        ctrClicks: ctrClicks.length,
        followers: followers.length
      });

      // Count ALL TIME views by talent (for display and 10+ filter)
      const allTimeViewsByTalent = new Map<string, number>();
      allTimeViews.forEach((view: any) => {
        allTimeViewsByTalent.set(view.talent_id, (allTimeViewsByTalent.get(view.talent_id) || 0) + 1);
      });

      // Count views since launch by talent (for CTR calculation)
      const ctrViewsByTalent = new Map<string, number>();
      ctrViews.forEach((view: any) => {
        ctrViewsByTalent.set(view.talent_id, (ctrViewsByTalent.get(view.talent_id) || 0) + 1);
      });

      // Count ALL TIME clicks by talent and card type (for display)
      const clicksByTalent = new Map<string, {
        total: number;
        link: number;
        youtube: number;
        rumble: number;
        podcast: number;
        shoutout: number;
        collab: number;
        sponsorship: number;
        services: number;
      }>();

      // Also track overall clicks by card type (ALL TIME for display)
      const overallClicksByType = new Map<string, number>();
      let totalOverallViews = 0;
      let totalCtrViews = 0;
      let totalOverallClicks = 0;

      // Count ALL TIME clicks for display
      allTimeClicks.forEach((click: any) => {
        const current = clicksByTalent.get(click.talent_id) || {
          total: 0, link: 0, youtube: 0, rumble: 0, podcast: 0, shoutout: 0, collab: 0, sponsorship: 0, services: 0
        };

        current.total++;
        totalOverallClicks++;

        const cardType = (click.card_type || '').toLowerCase();
        
        // Track in overall clicks by type (for all types)
        overallClicksByType.set(cardType || 'link', (overallClicksByType.get(cardType || 'link') || 0) + 1);
        
        // Also track per-talent breakdown
        if (cardType === 'youtube') {
          current.youtube++;
        } else if (cardType === 'rumble') {
          current.rumble++;
        } else if (cardType === 'podcast') {
          current.podcast++;
        } else if (cardType === 'shoutout') {
          current.shoutout++;
        } else if (cardType === 'collab') {
          current.collab++;
        } else if (cardType === 'sponsorship') {
          current.sponsorship++;
        } else if (cardType === 'services') {
          current.services++;
        } else if (!SPECIAL_CARD_TYPES.includes(cardType)) {
          // Count as generic link if not a special type
          current.link++;
        }

        clicksByTalent.set(click.talent_id, current);
      });

      // Calculate totals
      allTimeViewsByTalent.forEach((count) => {
        totalOverallViews += count;
      });
      ctrViewsByTalent.forEach((count) => {
        totalCtrViews += count;
      });

      // Count clicks since launch by talent (for CTR calculation only)
      const ctrClicksByTalent = new Map<string, number>();
      const ctrClicksByType = new Map<string, number>();
      let totalCtrClicks = 0;
      ctrClicks.forEach((click: any) => {
        ctrClicksByTalent.set(click.talent_id, (ctrClicksByTalent.get(click.talent_id) || 0) + 1);
        totalCtrClicks++;
        // Also track by card type for CTR calculation
        const cardType = (click.card_type || '').toLowerCase();
        ctrClicksByType.set(cardType || 'link', (ctrClicksByType.get(cardType || 'link') || 0) + 1);
      });

      // Count fans by talent
      const fansByTalent = new Map<string, number>();
      let totalFans = 0;
      followers.forEach((follower: any) => {
        fansByTalent.set(follower.talent_id, (fansByTalent.get(follower.talent_id) || 0) + 1);
        totalFans++;
      });

      // Build talent stats
      const stats: TalentBioStats[] = (talentProfiles || []).map((talent: any) => {
        const allTimeViews = allTimeViewsByTalent.get(talent.id) || 0;
        const viewsForCTR = ctrViewsByTalent.get(talent.id) || 0;
        const clicksForCTR = ctrClicksByTalent.get(talent.id) || 0;
        const clicks = clicksByTalent.get(talent.id) || {
          total: 0, link: 0, youtube: 0, rumble: 0, podcast: 0, shoutout: 0, collab: 0, sponsorship: 0, services: 0
        };
        const fans = fansByTalent.get(talent.id) || 0;
        
        const name = talent.temp_full_name || talent.users?.full_name || 'Unknown';
        const avatar = talent.temp_avatar_url || talent.users?.avatar_url || null;

        return {
          talent_id: talent.id,
          talent_name: name,
          avatar_url: avatar,
          slug: talent.slug,
          username: talent.username,
          page_views: allTimeViews, // All time views for display
          total_clicks: clicks.total, // All time clicks for display
          link_clicks: clicks.link,
          youtube_clicks: clicks.youtube,
          rumble_clicks: clicks.rumble,
          podcast_clicks: clicks.podcast,
          shoutout_clicks: clicks.shoutout,
          collab_clicks: clicks.collab,
          sponsorship_clicks: clicks.sponsorship,
          services_clicks: clicks.services,
          fan_count: fans,
          // CTR based on views/clicks since launch (Jan 29, 2026)
          overall_ctr: viewsForCTR > 0 ? (clicksForCTR / viewsForCTR) * 100 : 0,
          view_to_fan_rate: allTimeViews > 0 ? (fans / allTimeViews) * 100 : 0,
        };
      });

      setTalentStats(stats);

      // Build overall stats - include ALL card types found in data
      const ctrByType: {
        type: string;
        clicks: number;
        ctr: number;
        label: string;
        icon: React.ElementType;
        color: string;
      }[] = [];

      // Use clicks since launch for CTR by card type
      ctrClicksByType.forEach((clicks, type) => {
        const config = CARD_TYPE_CONFIG[type] || {
          label: type.charAt(0).toUpperCase() + type.slice(1),
          icon: CursorArrowRaysIcon,
          color: 'text-gray-600 bg-gray-100'
        };
        ctrByType.push({
          type,
          clicks,
          // CTR based on views/clicks since launch (Jan 29, 2026)
          ctr: totalCtrViews > 0 ? (clicks / totalCtrViews) * 100 : 0,
          label: config.label,
          icon: config.icon,
          color: config.color,
        });
      });

      // Sort by clicks descending
      ctrByType.sort((a, b) => b.clicks - a.clicks);

      setOverallStats({
        total_views: totalOverallViews, // All time views
        total_clicks: totalOverallClicks, // All time clicks for display
        total_fans: totalFans,
        // CTR based on views/clicks since launch (Jan 29, 2026)
        overall_ctr: totalCtrViews > 0 ? (totalCtrClicks / totalCtrViews) * 100 : 0,
        ctr_by_card_type: ctrByType,
      });

    } catch (error) {
      console.error('Error fetching bio stats:', error);
      toast.error('Failed to load bio page stats');
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? 
      <ArrowUpIcon className="h-4 w-4 inline ml-1" /> : 
      <ArrowDownIcon className="h-4 w-4 inline ml-1" />;
  };

  // Filter and sort - only show talent with 10+ views
  const filteredAndSortedStats = talentStats
    .filter(talent => 
      talent.page_views >= 10 && (
        talent.talent_name.toLowerCase().includes(search.toLowerCase()) ||
        (talent.slug && talent.slug.toLowerCase().includes(search.toLowerCase()))
      )
    )
    .sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      const multiplier = sortDirection === 'asc' ? 1 : -1;
      
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return aVal.localeCompare(bVal) * multiplier;
      }
      return ((aVal as number) - (bVal as number)) * multiplier;
    });

  const exportToCSV = () => {
    const headers = [
      'Talent Name', 'Slug', 'Page Views', 'Total Clicks', 'CTR %',
      'Link Clicks', 'YouTube Clicks', 'Rumble Clicks', 'Podcast Clicks',
      'ShoutOut Clicks', 'Collab Clicks', 'Sponsorship Clicks',
      'Total Fans', 'View to Fan Rate %'
    ];
    
    const rows = filteredAndSortedStats.map(t => [
      t.talent_name,
      t.slug || '',
      t.page_views,
      t.total_clicks,
      t.overall_ctr.toFixed(2),
      t.link_clicks,
      t.youtube_clicks,
      t.rumble_clicks,
      t.podcast_clicks,
      t.shoutout_clicks,
      t.collab_clicks,
      t.sponsorship_clicks,
      t.fan_count,
      t.view_to_fan_rate.toFixed(2)
    ]);
    
    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shoutout-fans-stats-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('Exported to CSV');
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">📊 ShoutOut Fans Analytics</h2>
          <p className="text-gray-600">Bio page performance (CTR since Jan 29 launch, 10+ views only)</p>
        </div>
        <button
          onClick={exportToCSV}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          <ArrowDownTrayIcon className="h-5 w-5" />
          Export CSV
        </button>
      </div>

      {/* Overall Stats Summary */}
      {overallStats && (
        <div className="space-y-4">
          {/* Top Row Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="glass rounded-xl p-4 border-2 border-cyan-300">
              <div className="flex items-center gap-2 mb-1">
                <EyeIcon className="h-5 w-5 text-cyan-600" />
                <p className="text-sm text-gray-600">Total Views</p>
              </div>
              <p className="text-2xl font-bold text-gray-900">{overallStats.total_views.toLocaleString()}</p>
            </div>
            <div className="glass rounded-xl p-4 border-2 border-blue-300">
              <div className="flex items-center gap-2 mb-1">
                <CursorArrowRaysIcon className="h-5 w-5 text-blue-600" />
                <p className="text-sm text-gray-600">Total Clicks</p>
              </div>
              <p className="text-2xl font-bold text-gray-900">{overallStats.total_clicks.toLocaleString()}</p>
            </div>
            <div className="glass rounded-xl p-4 border-2 border-purple-300">
              <div className="flex items-center gap-2 mb-1">
                <ChartBarIcon className="h-5 w-5 text-purple-600" />
                <p className="text-sm text-gray-600">Overall CTR</p>
              </div>
              <p className="text-2xl font-bold text-gray-900">{overallStats.overall_ctr.toFixed(2)}%</p>
            </div>
            <div className="glass rounded-xl p-4 border-2 border-pink-300">
              <div className="flex items-center gap-2 mb-1">
                <UsersIcon className="h-5 w-5 text-pink-600" />
                <p className="text-sm text-gray-600">Total Fans</p>
              </div>
              <p className="text-2xl font-bold text-gray-900">{overallStats.total_fans.toLocaleString()}</p>
            </div>
          </div>

          {/* CTR by Card Type */}
          <div className="glass rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">CTR by Card Type</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
              {overallStats.ctr_by_card_type.map(item => {
                const Icon = item.icon;
                return (
                  <div key={item.type} className={`rounded-lg p-3 ${item.color.split(' ')[1]}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className={`h-4 w-4 ${item.color.split(' ')[0]}`} />
                      <span className="text-xs font-medium text-gray-700">{item.label}</span>
                    </div>
                    <div className="text-lg font-bold text-gray-900">{item.clicks.toLocaleString()}</div>
                    <div className="text-xs text-gray-600">{item.ctr.toFixed(2)}% CTR</div>
                  </div>
                );
              })}
              {overallStats.ctr_by_card_type.length === 0 && (
                <div className="col-span-full text-center text-gray-500 py-4">
                  No click data available
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search by talent name or slug..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-96 pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>

      {/* Table */}
      <div className="glass rounded-2xl overflow-hidden">
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50/50 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Talent
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700"
                  onClick={() => handleSort('page_views')}
                >
                  Views <SortIcon field="page_views" />
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700"
                  onClick={() => handleSort('total_clicks')}
                >
                  Clicks <SortIcon field="total_clicks" />
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700"
                  onClick={() => handleSort('overall_ctr')}
                >
                  CTR <SortIcon field="overall_ctr" />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Click Breakdown
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700"
                  onClick={() => handleSort('fan_count')}
                >
                  Fans <SortIcon field="fan_count" />
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700"
                  onClick={() => handleSort('view_to_fan_rate')}
                >
                  View→Fan <SortIcon field="view_to_fan_rate" />
                </th>
              </tr>
            </thead>
            <tbody className="bg-white/50 divide-y divide-gray-200">
              {filteredAndSortedStats.map((talent) => (
                <tr key={talent.talent_id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0">
                        {talent.avatar_url ? (
                          <img
                            src={talent.avatar_url}
                            alt={talent.talent_name}
                            className="h-10 w-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                            <span className="text-primary-600 font-medium">
                              {talent.talent_name.charAt(0)}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900">{talent.talent_name}</div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {(talent.slug || talent.username) && (
                            <a 
                              href={`https://shoutout.fans/${talent.slug || talent.username}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:underline"
                            >
                              shoutout.fans/{talent.slug || talent.username}
                            </a>
                          )}
                          <a
                            href={`https://bio.shoutout.us/dashboard?token=${talent.talent_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 bg-purple-50 px-2 py-0.5 rounded"
                          >
                            <Cog6ToothIcon className="h-3 w-3" />
                            Dashboard
                          </a>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-1 text-gray-900">
                      <EyeIcon className="h-4 w-4 text-cyan-500" />
                      <span className="font-semibold">{talent.page_views.toLocaleString()}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-1 text-gray-900">
                      <CursorArrowRaysIcon className="h-4 w-4 text-blue-500" />
                      <span className="font-semibold">{talent.total_clicks.toLocaleString()}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`font-semibold ${
                      talent.overall_ctr >= 10 ? 'text-green-600' :
                      talent.overall_ctr >= 5 ? 'text-yellow-600' :
                      'text-gray-600'
                    }`}>
                      {talent.overall_ctr.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {talent.youtube_clicks > 0 && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
                          YT: {talent.youtube_clicks}
                        </span>
                      )}
                      {talent.rumble_clicks > 0 && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                          Rum: {talent.rumble_clicks}
                        </span>
                      )}
                      {talent.link_clicks > 0 && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                          Link: {talent.link_clicks}
                        </span>
                      )}
                      {talent.podcast_clicks > 0 && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">
                          Pod: {talent.podcast_clicks}
                        </span>
                      )}
                      {talent.shoutout_clicks > 0 && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-pink-100 text-pink-700">
                          SO: {talent.shoutout_clicks}
                        </span>
                      )}
                      {talent.collab_clicks > 0 && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700">
                          Collab: {talent.collab_clicks}
                        </span>
                      )}
                      {talent.sponsorship_clicks > 0 && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-700">
                          Spon: {talent.sponsorship_clicks}
                        </span>
                      )}
                      {talent.services_clicks > 0 && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-teal-100 text-teal-700">
                          Svc: {talent.services_clicks}
                        </span>
                      )}
                      {talent.total_clicks === 0 && (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-1 text-gray-900">
                      <UsersIcon className="h-4 w-4 text-pink-500" />
                      <span className="font-semibold">{talent.fan_count.toLocaleString()}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`font-semibold ${
                      talent.view_to_fan_rate >= 5 ? 'text-green-600' :
                      talent.view_to_fan_rate >= 2 ? 'text-yellow-600' :
                      'text-gray-600'
                    }`}>
                      {talent.view_to_fan_rate.toFixed(2)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {filteredAndSortedStats.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No talent found
          </div>
        )}
        
        <div className="px-4 py-3 bg-gray-50/50 border-t border-gray-200 text-sm text-gray-600">
          Showing {filteredAndSortedStats.length} of {talentStats.length} talent
        </div>
      </div>
    </div>
  );
};

export default ShoutOutFansManagement;
