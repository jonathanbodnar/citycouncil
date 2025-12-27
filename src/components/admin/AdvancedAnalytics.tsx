import React, { useState, useEffect, useCallback } from 'react';
import {
  ChartBarIcon,
  CalendarIcon,
  CurrencyDollarIcon,
  UserGroupIcon,
  ChatBubbleLeftIcon,
  UserPlusIcon,
  ShoppingCartIcon,
  Cog6ToothIcon,
  ArrowPathIcon,
  LinkIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XMarkIcon,
  PlusIcon
} from '@heroicons/react/24/outline';
import { supabase } from '../../services/supabase';
import toast from 'react-hot-toast';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

// Types
interface DailyData {
  date: string;
  followers: number;
  sms: number;
  users: number;
  orders: number;
  totalSpend: number;
  fbSpend: number;
  rumbleSpend: number;
}

interface CampaignMapping {
  id: string;
  campaign_id: string;
  campaign_name: string;
  platform: 'facebook' | 'rumble';
  goals: string[];
}

interface AdCredentials {
  platform: 'facebook' | 'rumble' | 'instagram';
  is_connected: boolean;
  last_sync_at: string | null;
  account_id?: string;
}

interface SourceBreakdown {
  source: string;
  count: number;
  percentage: number;
}

type ChartMode = 'count' | 'cost' | 'drill';
type DateRange = 'today' | '7d' | '14d' | '30d' | '90d' | 'custom';

const GOAL_COLORS = {
  followers: '#8B5CF6', // Purple
  sms: '#10B981',      // Green
  users: '#3B82F6',    // Blue
  orders: '#F59E0B'    // Amber
};

const GOAL_LABELS = {
  followers: 'Followers',
  sms: 'SMS Signups',
  users: 'Users',
  orders: 'Orders'
};

// Lifetime Stats Cards Component - simplified cost per follower and SMS
interface LifetimeStatsCardsProps {
  startDate: string; // YYYY-MM-DD format
  endDate: string;   // YYYY-MM-DD format
  dateRangeLabel: string; // e.g., "7 days", "30 days", "custom"
}

const LifetimeStatsCards: React.FC<LifetimeStatsCardsProps> = ({ startDate, endDate, dateRangeLabel }) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    costPerFollower: 0,
    costPerSMS: 0,
    costPerSMSSocial: 0,
    totalFollowers: 0,
    totalSMS: 0,
    totalSMSRumble: 0,
    totalSMSSocial: 0,
    totalFBSpend: 0,
    totalRumbleSpend: 0
  });

  useEffect(() => {
    const fetchLifetimeData = async () => {
      setLoading(true);
      try {
        // Convert dates to proper timestamps for CST queries
        // Midnight CST = 6:00 AM UTC
        const startTimestamp = `${startDate}T06:00:00.000Z`;
        // End of day CST = 5:59:59 AM UTC next day
        const [year, month, day] = endDate.split('-').map(Number);
        const nextDay = new Date(year, month - 1, day + 1);
        const endTimestamp = `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, '0')}-${String(nextDay.getDate()).padStart(2, '0')}T05:59:59.999Z`;

        // Calculate the day before startDate for baseline follower count
        const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
        const dayBefore = new Date(startYear, startMonth - 1, startDay - 1);
        const dayBeforeStr = `${dayBefore.getFullYear()}-${String(dayBefore.getMonth() + 1).padStart(2, '0')}-${String(dayBefore.getDate()).padStart(2, '0')}`;

        // Fetch follower data, SMS data, and ad spend in parallel
        const [followerResult, baselineFollowerResult, smsResult, fbSpendResult, rumbleSpendResult] = await Promise.all([
          // Follower counts within date range (for the end date)
          supabase
            .from('follower_counts')
            .select('date, count')
            .eq('platform', 'instagram')
            .eq('date', endDate)
            .single(),
          
          // Baseline follower count (day before start date)
          supabase
            .from('follower_counts')
            .select('date, count')
            .eq('platform', 'instagram')
            .eq('date', dayBeforeStr)
            .single(),
          
          // SMS signups within date range - include utm_source for filtering
          supabase
            .from('beta_signups')
            .select('id, subscribed_at, utm_source')
            .gte('subscribed_at', startTimestamp)
            .lte('subscribed_at', endTimestamp),
          
          // Facebook spend within date range (for followers AND social SMS)
          supabase
            .from('ad_spend_daily')
            .select('spend')
            .eq('platform', 'facebook')
            .gte('date', startDate)
            .lte('date', endDate),
          
          // Rumble spend within date range (for SMS/users - excluding DM sources)
          supabase
            .from('ad_spend_daily')
            .select('spend')
            .eq('platform', 'rumble')
            .gte('date', startDate)
            .lte('date', endDate)
        ]);

        // Calculate followers gained (end date count - baseline count)
        const endCount = followerResult.data?.count || 0;
        const baselineCount = baselineFollowerResult.data?.count || 0;
        let totalFollowersGained = 0;
        if (endCount > 0 && baselineCount > 0) {
          totalFollowersGained = endCount - baselineCount;
        } else if (endCount > 0) {
          // No baseline available, can't calculate gain accurately
          totalFollowersGained = 0;
        }

        // Separate SMS by source - DM sources vs non-DM (Rumble) sources
        const allSMS = smsResult.data || [];
        const dmSources = ['dm', 'dma', 'dmb', 'dmc', 'dmf']; // All DM variations (lowercase for comparison)
        
        const smsSocial = allSMS.filter(s => {
          const source = (s.utm_source || '').toLowerCase();
          return dmSources.includes(source);
        });
        
        const smsRumble = allSMS.filter(s => {
          const source = (s.utm_source || '').toLowerCase();
          return !dmSources.includes(source);
        });

        const totalSMS = allSMS.length;
        const totalSMSSocial = smsSocial.length;
        const totalSMSRumble = smsRumble.length;

        // Calculate Facebook spend (for followers AND social SMS)
        const totalFBSpend = (fbSpendResult.data || []).reduce(
          (sum, row) => sum + (Number(row.spend) || 0), 0
        );

        // Calculate Rumble spend (for non-DM SMS only)
        const totalRumbleSpend = (rumbleSpendResult.data || []).reduce(
          (sum, row) => sum + (Number(row.spend) || 0), 0
        );

        const costPerFollower = totalFollowersGained > 0 ? totalFBSpend / totalFollowersGained : 0;
        // Cost per SMS (Rumble) - only counts non-DM signups
        const costPerSMS = totalSMSRumble > 0 ? totalRumbleSpend / totalSMSRumble : 0;
        // Cost per SMS Social - FB spend on follower campaigns / DM-sourced signups
        const costPerSMSSocial = totalSMSSocial > 0 ? totalFBSpend / totalSMSSocial : 0;

        setData({ 
          costPerFollower, 
          costPerSMS,
          costPerSMSSocial,
          totalFollowers: totalFollowersGained,
          totalSMS,
          totalSMSRumble,
          totalSMSSocial,
          totalFBSpend,
          totalRumbleSpend
        });
      } catch (error) {
        console.error('Error fetching lifetime data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLifetimeData();
  }, [startDate, endDate]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass rounded-xl p-6 animate-pulse">
          <div className="h-6 bg-gray-700 rounded w-1/2 mb-4"></div>
          <div className="h-10 bg-gray-700 rounded w-1/3"></div>
        </div>
        <div className="glass rounded-xl p-6 animate-pulse">
          <div className="h-6 bg-gray-700 rounded w-1/2 mb-4"></div>
          <div className="h-10 bg-gray-700 rounded w-1/3"></div>
        </div>
        <div className="glass rounded-xl p-6 animate-pulse">
          <div className="h-6 bg-gray-700 rounded w-1/2 mb-4"></div>
          <div className="h-10 bg-gray-700 rounded w-1/3"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Cost Per Follower */}
      <div className="glass rounded-xl p-6">
        <div className="flex items-center gap-2 mb-2">
          <UserGroupIcon className="h-5 w-5 text-purple-500" />
          <h3 className="text-lg font-semibold text-white">Avg Cost / Follower</h3>
        </div>
        <p className="text-4xl font-bold text-white mb-1">
          ${data.costPerFollower.toFixed(2)}
        </p>
        <p className="text-gray-500 text-sm">
          {dateRangeLabel} • {data.totalFollowers.toLocaleString()} followers • ${data.totalFBSpend.toFixed(0)} FB spend
        </p>
      </div>

      {/* Cost Per SMS (Rumble) */}
      <div className="glass rounded-xl p-6">
        <div className="flex items-center gap-2 mb-2">
          <ChatBubbleLeftIcon className="h-5 w-5 text-green-500" />
          <h3 className="text-lg font-semibold text-white">Avg Cost / SMS</h3>
        </div>
        <p className="text-4xl font-bold text-white mb-1">
          ${data.costPerSMS.toFixed(2)}
        </p>
        <p className="text-gray-500 text-sm">
          {dateRangeLabel} • {data.totalSMSRumble.toLocaleString()} SMS (Rumble) • ${data.totalRumbleSpend.toFixed(0)} Rumble spend
        </p>
      </div>

      {/* Cost Per SMS Social (DM sources) */}
      <div className="glass rounded-xl p-6">
        <div className="flex items-center gap-2 mb-2">
          <LinkIcon className="h-5 w-5 text-blue-500" />
          <h3 className="text-lg font-semibold text-white">Avg Cost / SMS Social</h3>
        </div>
        <p className="text-4xl font-bold text-white mb-1">
          ${data.costPerSMSSocial.toFixed(2)}
        </p>
        <p className="text-gray-500 text-sm">
          {dateRangeLabel} • {data.totalSMSSocial.toLocaleString()} SMS (DMs) • ${data.totalFBSpend.toFixed(0)} FB spend
        </p>
      </div>
    </div>
  );
};

const AdvancedAnalytics: React.FC = () => {
  // State
  const [chartMode, setChartMode] = useState<ChartMode>('count');
  const [dateRange, setDateRange] = useState<DateRange>('7d');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [chartData, setChartData] = useState<DailyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  
  // Campaign mappings
  const [campaignMappings, setCampaignMappings] = useState<CampaignMapping[]>([]);
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [editingMapping, setEditingMapping] = useState<CampaignMapping | null>(null);
  
  // Ad platform credentials
  const [credentials, setCredentials] = useState<AdCredentials[]>([]);
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [credentialForm, setCredentialForm] = useState({
    platform: 'facebook' as 'facebook' | 'rumble' | 'instagram',
    access_token: '',
    account_id: ''
  });
  
  // Source breakdowns
  const [smsSourceBreakdown, setSmsSourceBreakdown] = useState<SourceBreakdown[]>([]);
  const [userSourceBreakdown, setUserSourceBreakdown] = useState<SourceBreakdown[]>([]);
  const [orderSourceBreakdown, setOrderSourceBreakdown] = useState<SourceBreakdown[]>([]);
  
  // Raw ad spend data for drill mode
  const [rawAdSpendData, setRawAdSpendData] = useState<any[]>([]);
  

  // Helper to format date as YYYY-MM-DD
  const formatLocalDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Convert UTC timestamp to CST date string (YYYY-MM-DD)
  const formatTimestampToCST = (timestamp: string) => {
    // Handle Postgres timestamp format (e.g., "2025-12-11T06:40:08.747944+00")
    // by normalizing to proper ISO format
    let normalizedTimestamp = timestamp;
    if (timestamp.match(/\+00$/)) {
      normalizedTimestamp = timestamp.replace(/\+00$/, 'Z');
    } else if (timestamp.match(/\+\d{2}$/) && !timestamp.includes(':')) {
      // Handle +HH format without colon
      normalizedTimestamp = timestamp.replace(/\+(\d{2})$/, '+$1:00');
    }
    
    const date = new Date(normalizedTimestamp);
    if (isNaN(date.getTime())) {
      console.error('Invalid timestamp:', timestamp, 'normalized:', normalizedTimestamp);
      return '1970-01-01'; // Fallback
    }
    
    const cstString = date.toLocaleString('en-US', { timeZone: 'America/Chicago' });
    const cstDate = new Date(cstString);
    const year = cstDate.getFullYear();
    const month = String(cstDate.getMonth() + 1).padStart(2, '0');
    const day = String(cstDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Get current date in CST
  const getCSTNow = () => {
    const now = new Date();
    const cstString = now.toLocaleString('en-US', { timeZone: 'America/Chicago' });
    return new Date(cstString);
  };

  // Calculate date range (all dates in CST)
  const getDateRange = useCallback(() => {
    const now = getCSTNow();
    console.log('🕐 Current CST time:', now.toLocaleString());
    
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (dateRange) {
      case 'today':
        console.log('📅 Today mode (CST) - start:', formatLocalDate(start), 'end:', formatLocalDate(end));
        break;
      case '7d':
        start.setDate(start.getDate() - 7);
        break;
      case '14d':
        start.setDate(start.getDate() - 14);
        break;
      case '30d':
        start.setDate(start.getDate() - 30);
        break;
      case '90d':
        start.setDate(start.getDate() - 90);
        break;
      case 'custom':
        if (customStartDate && customEndDate) {
          return {
            start: new Date(customStartDate),
            end: new Date(customEndDate)
          };
        }
        start.setDate(start.getDate() - 30);
        break;
    }
    
    return { start, end };
  }, [dateRange, customStartDate, customEndDate]);

  // Helper to get ISO timestamp for start of day in CST from date string (YYYY-MM-DD)
  // Midnight CST = 6:00 AM UTC
  const getCSTDayStartFromString = (dateStr: string) => {
    return `${dateStr}T06:00:00.000Z`;
  };

  // Helper to get ISO timestamp for end of day in CST from date string (YYYY-MM-DD)
  // 11:59:59 PM CST = 5:59:59 AM UTC next day
  const getCSTDayEndFromString = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    const nextDay = new Date(year, month - 1, day + 1);
    const nextYear = nextDay.getFullYear();
    const nextMonth = String(nextDay.getMonth() + 1).padStart(2, '0');
    const nextDayNum = String(nextDay.getDate()).padStart(2, '0');
    return `${nextYear}-${nextMonth}-${nextDayNum}T05:59:59.999Z`;
  };

  // Fetch all data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { start, end } = getDateRange();
      // Use local date formatting to avoid UTC conversion issues
      const startStr = formatLocalDate(start);
      const endStr = formatLocalDate(end);
      
      // Get proper UTC timestamps for CST day boundaries
      const startTimestamp = getCSTDayStartFromString(startStr);
      const endTimestamp = getCSTDayEndFromString(endStr);
      
      console.log('📊 Fetching analytics data:', { startStr, endStr, startTimestamp, endTimestamp, dateRange });

      // Fetch all required data in parallel
      const [
        analyticsDataResult,
        adSpendResult,
        followerCountsResult,
        mappingsResult,
        credentialsResult
      ] = await Promise.all([
        // Use database function for CST timezone conversion
        supabase.rpc('get_analytics_data_cst', {
          start_date: startStr,
          end_date: endStr
        }),
        
        // Ad spend
        supabase
          .from('ad_spend_daily')
          .select('*')
          .gte('date', startStr)
          .lte('date', endStr),
        
        // Follower counts - fetch one extra day before startStr for growth calculation
        supabase
          .from('follower_counts')
          .select('*')
          .gte('date', (() => {
            // Subtract one day from startStr for growth calculation
            const [y, m, d] = startStr.split('-').map(Number);
            const prevDay = new Date(y, m - 1, d - 1);
            return `${prevDay.getFullYear()}-${String(prevDay.getMonth() + 1).padStart(2, '0')}-${String(prevDay.getDate()).padStart(2, '0')}`;
          })())
          .lte('date', endStr)
          .order('date', { ascending: true }),
        
        // Campaign mappings
        supabase
          .from('campaign_goal_mappings')
          .select('*'),
        
        // Credentials
        supabase
          .from('ad_platform_credentials')
          .select('platform, is_connected, last_sync_at, account_id')
      ]);
      
      // Parse analytics data from the combined result
      const analyticsData = analyticsDataResult.data || [];
      const ordersData = analyticsData.filter((r: any) => r.record_type === 'order');
      const usersData = analyticsData.filter((r: any) => r.record_type === 'user');
      const smsData = analyticsData.filter((r: any) => r.record_type === 'sms');
      
      console.log('📊 Analytics data from DB:', { 
        total: analyticsData.length,
        orders: ordersData.length, 
        users: usersData.length, 
        sms: smsData.length 
      });
      
      // Log follower counts query result
      console.log('📊 Follower counts query result:', {
        data: followerCountsResult.data,
        error: followerCountsResult.error,
        count: followerCountsResult.data?.length
      });

      // Process data into daily buckets
      const dailyMap = new Map<string, DailyData>();
      
      // Initialize all dates in range using the CST date strings
      // Parse startStr and endStr to iterate through dates
      const [startYear, startMonth, startDay] = startStr.split('-').map(Number);
      const [endYear, endMonth, endDay] = endStr.split('-').map(Number);
      
      // Create dates at noon to avoid timezone issues during iteration
      const currentDate = new Date(startYear, startMonth - 1, startDay, 12, 0, 0);
      const endDate = new Date(endYear, endMonth - 1, endDay, 12, 0, 0);
      
      console.log('📅 Initializing date range:', { startStr, endStr });
      
      while (currentDate <= endDate) {
        const year = currentDate.getFullYear();
        const month = String(currentDate.getMonth() + 1).padStart(2, '0');
        const day = String(currentDate.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        
        dailyMap.set(dateStr, {
          date: dateStr,
          followers: 0,
          sms: 0,
          users: 0,
          orders: 0,
          totalSpend: 0,
          fbSpend: 0,
          rumbleSpend: 0
        });
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      console.log('📅 Dates initialized:', Array.from(dailyMap.keys()));

      // Log any errors from queries
      if (analyticsDataResult.error) console.error('Analytics data query error:', analyticsDataResult.error);
      if (adSpendResult.error) console.error('Ad spend query error:', adSpendResult.error);
      if (followerCountsResult.error) console.error('Follower counts query error:', followerCountsResult.error);

      // Count orders per day (dates already in CST from database)
      ordersData.forEach((order: { cst_date: string; promo_source?: string; did_holiday_popup?: boolean }) => {
        const day = dailyMap.get(order.cst_date);
        if (day) {
          day.orders++;
        } else {
          console.log('📊 Order date not in range:', order.cst_date);
        }
      });

      // Count users per day (dates already in CST from database)
      usersData.forEach((user: { cst_date: string; promo_source?: string; did_holiday_popup?: boolean }) => {
        const day = dailyMap.get(user.cst_date);
        if (day) {
          day.users++;
        } else {
          console.log('📊 User date not in range:', user.cst_date);
        }
      });

      // Count SMS signups per day (dates already in CST from database)
      smsData.forEach((signup: { cst_date: string; promo_source?: string }) => {
        const day = dailyMap.get(signup.cst_date);
        if (day) {
          day.sms++;
        } else {
          console.log('📊 SMS date not in range:', signup.cst_date);
        }
      });

      // Store raw ad spend data for drill mode
      setRawAdSpendData(adSpendResult.data || []);
      
      // Add ad spend per day
      console.log('💰 Processing ad spend data:', adSpendResult.data?.length, 'records');
      adSpendResult.data?.forEach(spend => {
        const day = dailyMap.get(spend.date);
        if (day) {
          const spendAmount = Number(spend.spend) || 0;
          day.totalSpend += spendAmount;
          if (spend.platform === 'facebook') {
            day.fbSpend += spendAmount;
          } else if (spend.platform === 'rumble') {
            day.rumbleSpend += spendAmount;
          }
          console.log(`💰 ${spend.date} ${spend.platform}: +$${spendAmount.toFixed(2)} (total now: $${day.totalSpend.toFixed(2)})`);
        } else {
          console.log(`💰 Ad spend date not in range: ${spend.date}`);
        }
      });
      
      // Log final totals per day
      console.log('💰 Final daily totals:');
      dailyMap.forEach((day, date) => {
        if (day.totalSpend > 0) {
          console.log(`💰 ${date}: Total=$${day.totalSpend.toFixed(2)}, FB=$${day.fbSpend.toFixed(2)}, Rumble=$${day.rumbleSpend.toFixed(2)}`);
        }
      });

      // Calculate follower changes
      // The count recorded on date X represents the follower count at the END of that day
      // Growth for date X = count on date X - count on date (X-1)
      // If there are gaps, distribute growth evenly across missing days
      const followerData = followerCountsResult.data || [];
      console.log('📊 Raw follower data from DB:', followerData);
      
      const followerByDate = new Map<string, number>();
      followerData.forEach(fc => {
        followerByDate.set(fc.date, fc.count);
      });
      
      console.log('📊 Follower counts by date:', Object.fromEntries(followerByDate));
      
      // Sort the dates we have follower data for
      const followerDates = Array.from(followerByDate.keys()).sort();
      console.log('📊 Follower dates available:', followerDates);
      
      // Calculate growth between consecutive data points and distribute across gaps
      for (let i = 1; i < followerDates.length; i++) {
        const currentDateStr = followerDates[i];
        const prevDateStr = followerDates[i - 1];
        
        const currentCount = followerByDate.get(currentDateStr)!;
        const prevCount = followerByDate.get(prevDateStr)!;
        const totalGrowth = currentCount - prevCount;
        
        // Calculate how many days between the two data points
        const prevDate = new Date(prevDateStr + 'T12:00:00');
        const currentDate = new Date(currentDateStr + 'T12:00:00');
        const daysBetween = Math.round((currentDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
        
        // Distribute growth evenly across all days in the gap
        const growthPerDay = Math.round(totalGrowth / daysBetween);
        
        console.log(`📊 Followers ${prevDateStr} to ${currentDateStr}: ${totalGrowth} over ${daysBetween} days = ${growthPerDay}/day`);
        
        // Apply growth to each day in the range (excluding the start date, including end date)
        for (let d = 1; d <= daysBetween; d++) {
          const targetDate = new Date(prevDate);
          targetDate.setDate(targetDate.getDate() + d);
          const targetDateStr = formatLocalDate(targetDate);
          
          const day = dailyMap.get(targetDateStr);
          if (day) {
            day.followers = growthPerDay;
            console.log(`📊 Followers ${targetDateStr}: ${growthPerDay}`);
          }
        }
      }
      
      // Log final state
      console.log('📊 Final dailyMap followers:', Array.from(dailyMap.entries()).map(([k, v]) => `${k}: ${v.followers}`));

      // Convert to array and sort by date
      const chartDataArray = Array.from(dailyMap.values()).sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      setChartData(chartDataArray);
      setCampaignMappings(mappingsResult.data || []);
      setCredentials(credentialsResult.data || []);

      // Calculate source breakdowns (use the filtered data)
      calculateSourceBreakdowns(
        smsData,
        usersData,
        ordersData
      );

    } catch (error) {
      console.error('Error fetching analytics data:', error);
      toast.error('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  }, [getDateRange]);

  // Helper to format source names for display
  const formatSourceName = (source: string): string => {
    if (!source) return 'Direct';
    
    // Map known UTM values to friendly names
    const sourceMap: Record<string, string> = {
      '1': 'Self Promo',
      'self_promo': 'Self Promo',
      'fb': 'Facebook',
      'facebook': 'Facebook',
      'ig': 'Instagram',
      'instagram': 'Instagram',
      'meta': 'Meta',
      'rumble': 'Rumble',
      'rgiveaway': 'Rumble',
      'sms': 'SMS',
      'email': 'Email',
      'giveaway': 'Giveaway',
      'direct': 'Direct',
    };
    
    const lowerSource = source.toLowerCase();
    return sourceMap[lowerSource] || source;
  };

  // Calculate source breakdowns
  const calculateSourceBreakdowns = (
    smsData: any[],
    userData: any[],
    orderData: any[]
  ) => {
    // SMS sources (promo_source from the unified query, which is utm_source for SMS)
    const smsSources = new Map<string, number>();
    smsData.forEach(s => {
      const source = formatSourceName(s.promo_source || 'Direct');
      smsSources.set(source, (smsSources.get(source) || 0) + 1);
    });
    const smsTotal = smsData.length;
    setSmsSourceBreakdown(
      Array.from(smsSources.entries())
        .map(([source, count]) => ({
          source,
          count,
          percentage: smsTotal > 0 ? (count / smsTotal) * 100 : 0
        }))
        .sort((a, b) => b.count - a.count)
    );

    // User sources
    const userSources = new Map<string, number>();
    userData.forEach(u => {
      const source = formatSourceName(u.promo_source || 'Direct');
      userSources.set(source, (userSources.get(source) || 0) + 1);
    });
    const userTotal = userData.length;
    setUserSourceBreakdown(
      Array.from(userSources.entries())
        .map(([source, count]) => ({
          source,
          count,
          percentage: userTotal > 0 ? (count / userTotal) * 100 : 0
        }))
        .sort((a, b) => b.count - a.count)
    );

    // Order sources
    const orderSources = new Map<string, number>();
    orderData.forEach(o => {
      const source = formatSourceName(o.promo_source || 'Direct');
      orderSources.set(source, (orderSources.get(source) || 0) + 1);
    });
    const orderTotal = orderData.length;
    setOrderSourceBreakdown(
      Array.from(orderSources.entries())
        .map(([source, count]) => ({
          source,
          count,
          percentage: orderTotal > 0 ? (count / orderTotal) * 100 : 0
        }))
        .sort((a, b) => b.count - a.count)
    );
  };

  // Transform data based on chart mode
  const getTransformedData = useCallback(() => {
    if (chartMode === 'count') {
      return chartData;
    }
    
    if (chartMode === 'cost') {
      // Cost per goal = total spend / goal count
      return chartData.map(day => ({
        ...day,
        date: day.date,
        followers: day.followers > 0 ? day.totalSpend / day.followers : 0,
        sms: day.sms > 0 ? day.totalSpend / day.sms : 0,
        users: day.users > 0 ? day.totalSpend / day.users : 0,
        orders: day.orders > 0 ? day.totalSpend / day.orders : 0
      }));
    }
    
    if (chartMode === 'drill') {
      // Build a map of campaign_id -> goals from mappings
      const campaignGoalMap = new Map<string, string[]>();
      campaignMappings.forEach(mapping => {
        campaignGoalMap.set(mapping.campaign_id, mapping.goals);
      });
      
      console.log('📊 Drill mode - campaign mappings:', campaignMappings);
      console.log('📊 Drill mode - raw ad spend:', rawAdSpendData);
      
      // Calculate spend per goal per day based on campaign mappings
      return chartData.map(day => {
        const goalSpend: Record<string, number> = {
          followers: 0,
          sms: 0,
          users: 0,
          orders: 0
        };
        
        // Find all ad spend records for this day
        const daySpendRecords = rawAdSpendData.filter(s => s.date === day.date);
        
        daySpendRecords.forEach(spend => {
          const goals = campaignGoalMap.get(spend.campaign_id);
          if (goals && goals.length > 0) {
            // Distribute spend across mapped goals
            const spendPerGoal = (Number(spend.spend) || 0) / goals.length;
            goals.forEach(goal => {
              if (goalSpend[goal] !== undefined) {
                goalSpend[goal] += spendPerGoal;
              }
            });
          }
        });
        
        console.log(`📊 Drill ${day.date}: goalSpend=`, goalSpend);
        
        // Return cost per acquisition for each goal
        return {
          ...day,
          date: day.date,
          followers: day.followers > 0 && goalSpend.followers > 0 
            ? goalSpend.followers / day.followers : 0,
          sms: day.sms > 0 && goalSpend.sms > 0 
            ? goalSpend.sms / day.sms : 0,
          users: day.users > 0 && goalSpend.users > 0 
            ? goalSpend.users / day.users : 0,
          orders: day.orders > 0 && goalSpend.orders > 0 
            ? goalSpend.orders / day.orders : 0
        };
      });
    }
    
    return chartData;
  }, [chartData, chartMode, campaignMappings, rawAdSpendData]);
  // Save ad platform credentials
  const saveCredentials = async () => {
    try {
      const { error } = await supabase
        .from('ad_platform_credentials')
        .upsert({
          platform: credentialForm.platform,
          access_token: credentialForm.access_token,
          account_id: credentialForm.account_id,
          is_connected: true,
          updated_at: new Date().toISOString()
        }, { onConflict: 'platform' });
      
      if (error) throw error;
      
      toast.success(`${credentialForm.platform} credentials saved`);
      setShowCredentialsModal(false);
      setCredentialForm({ platform: 'facebook', access_token: '', account_id: '' });
      fetchData();
    } catch (error) {
      console.error('Error saving credentials:', error);
      toast.error('Failed to save credentials');
    }
  };

  // Save campaign mapping
  const saveCampaignMapping = async (mapping: Partial<CampaignMapping>) => {
    try {
      if (editingMapping?.id) {
        const { error } = await supabase
          .from('campaign_goal_mappings')
          .update({
            campaign_name: mapping.campaign_name,
            goals: mapping.goals,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingMapping.id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('campaign_goal_mappings')
          .insert({
            campaign_id: mapping.campaign_id,
            campaign_name: mapping.campaign_name,
            platform: mapping.platform,
            goals: mapping.goals
          });
        
        if (error) throw error;
      }
      
      toast.success('Campaign mapping saved');
      setShowMappingModal(false);
      setEditingMapping(null);
      fetchData();
    } catch (error) {
      console.error('Error saving mapping:', error);
      toast.error('Failed to save campaign mapping');
    }
  };

  // Sync ad spend data
  const syncAdSpend = async () => {
    setSyncing(true);
    try {
      // Call edge function to sync ad spend
      const { data, error } = await supabase.functions.invoke('sync-ad-spend');
      
      if (error) throw error;
      
      toast.success('Ad spend data synced');
      fetchData();
    } catch (error) {
      console.error('Error syncing ad spend:', error);
      toast.error('Failed to sync ad spend. Make sure API credentials are configured.');
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Format currency
  const formatCurrency = (value: number) => {
    return `$${value.toFixed(2)}`;
  };

  // Format date for display
  const formatDate = (dateStr: string) => {
    // Parse YYYY-MM-DD directly to avoid timezone issues
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Get Y-axis label based on mode
  const getYAxisLabel = () => {
    if (chartMode === 'count') return 'Count';
    return 'Cost ($)';
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload) return null;
    
    return (
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-xl">
        <p className="text-white font-medium mb-2">{formatDate(label)}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {GOAL_LABELS[entry.dataKey as keyof typeof GOAL_LABELS]}: {
              chartMode === 'count' 
                ? entry.value 
                : formatCurrency(entry.value)
            }
          </p>
        ))}
        {chartMode !== 'count' && payload[0]?.payload?.totalSpend > 0 && (
          <p className="text-gray-400 text-xs mt-2 border-t border-gray-700 pt-2">
            Total Spend: {formatCurrency(payload[0].payload.totalSpend)}
          </p>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Advanced Analytics</h2>
          <p className="text-gray-400">Track goals, costs, and campaign performance</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCredentialsModal(true)}
            className="flex items-center gap-2 px-3 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
          >
            <Cog6ToothIcon className="h-4 w-4" />
            API Settings
          </button>
          <button
            onClick={syncAdSpend}
            disabled={syncing}
            className="flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
          >
            <ArrowPathIcon className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            Sync Data
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="glass rounded-xl p-4">
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
          {/* Chart Mode Toggle */}
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-sm">Mode:</span>
            <div className="flex bg-gray-800 rounded-lg p-1">
              {(['count', 'cost', 'drill'] as ChartMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setChartMode(mode)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    chartMode === mode
                      ? 'bg-purple-600 text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Date Range */}
          <div className="flex items-center gap-2 flex-wrap">
            <CalendarIcon className="h-5 w-5 text-gray-400" />
            <div className="flex bg-gray-800 rounded-lg p-1">
              {(['today', '7d', '14d', '30d', '90d'] as DateRange[]).map((range) => (
                <button
                  key={range}
                  onClick={() => setDateRange(range)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    dateRange === range
                      ? 'bg-purple-600 text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {range === 'today' ? 'Today' : range}
                </button>
              ))}
            </div>
            <button
              onClick={() => setDateRange('custom')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                dateRange === 'custom'
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-400 hover:text-white bg-gray-800'
              }`}
            >
              Custom
            </button>
            {dateRange === 'custom' && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="bg-gray-800 text-white rounded-lg px-3 py-1.5 text-sm"
                />
                <span className="text-gray-400">to</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="bg-gray-800 text-white rounded-lg px-3 py-1.5 text-sm"
                />
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Chart */}
      <div className="glass rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">
            {chartMode === 'count' ? 'Goal Counts Over Time' : 
             chartMode === 'cost' ? 'Cost Per Goal Over Time' :
             'Campaign Drill-Down Analysis'}
          </h3>
          <div className="flex items-center gap-4">
            {Object.entries(GOAL_COLORS).map(([goal, color]) => (
              <div key={goal} className="flex items-center gap-1">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: color }}
                />
                <span className="text-gray-400 text-sm">
                  {GOAL_LABELS[goal as keyof typeof GOAL_LABELS]}
                </span>
              </div>
            ))}
          </div>
        </div>
        
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={getTransformedData()}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis 
                dataKey="date" 
                tickFormatter={formatDate}
                stroke="#9CA3AF"
                tick={{ fill: '#9CA3AF', fontSize: 12 }}
              />
              {/* Primary Y-axis for SMS, Users, Orders */}
              <YAxis 
                yAxisId="left"
                stroke="#9CA3AF"
                tick={{ fill: '#9CA3AF', fontSize: 12 }}
                tickFormatter={chartMode === 'count' ? undefined : formatCurrency}
                label={{ 
                  value: chartMode === 'count' ? 'SMS / Users / Orders' : 'Cost ($)', 
                  angle: -90, 
                  position: 'insideLeft',
                  fill: '#9CA3AF',
                  style: { fontSize: 11 }
                }}
              />
              {/* Secondary Y-axis for Followers (scaled: 100 followers = 1 on left axis) */}
              <YAxis 
                yAxisId="right"
                orientation="right"
                stroke={GOAL_COLORS.followers}
                tick={{ fill: GOAL_COLORS.followers, fontSize: 12 }}
                tickFormatter={(value) => chartMode === 'count' ? `${value}` : formatCurrency(value)}
                label={{ 
                  value: 'Followers', 
                  angle: 90, 
                  position: 'insideRight',
                  fill: GOAL_COLORS.followers,
                  style: { fontSize: 11 }
                }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="followers" 
                name="Followers"
                yAxisId="right"
                stroke={GOAL_COLORS.followers} 
                strokeWidth={2}
                dot={{ fill: GOAL_COLORS.followers, strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6 }}
              />
              <Line 
                type="monotone" 
                dataKey="sms" 
                name="SMS Signups"
                yAxisId="left"
                stroke={GOAL_COLORS.sms} 
                strokeWidth={2}
                dot={{ fill: GOAL_COLORS.sms, strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6 }}
              />
              <Line 
                type="monotone" 
                dataKey="users" 
                name="Users"
                yAxisId="left"
                stroke={GOAL_COLORS.users} 
                strokeWidth={2}
                dot={{ fill: GOAL_COLORS.users, strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6 }}
              />
              <Line 
                type="monotone" 
                dataKey="orders" 
                name="Orders"
                yAxisId="left"
                stroke={GOAL_COLORS.orders} 
                strokeWidth={2}
                dot={{ fill: GOAL_COLORS.orders, strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Lifetime Cost Per Follower Card (Drill Mode) */}
      {chartMode === 'drill' && (() => {
        const { start, end } = getDateRange();
        const startStr = formatLocalDate(start);
        const endStr = formatLocalDate(end);
        const dateRangeLabels: Record<DateRange, string> = {
          'today': 'Today',
          '7d': 'Last 7 days',
          '14d': 'Last 14 days',
          '30d': 'Last 30 days',
          '90d': 'Last 90 days',
          'custom': `${startStr} to ${endStr}`
        };
        return (
          <LifetimeStatsCards 
            startDate={startStr}
            endDate={endStr}
            dateRangeLabel={dateRangeLabels[dateRange]}
          />
        );
      })()}

      {/* Campaign Mappings (Drill Mode) */}
      {chartMode === 'drill' && (
        <div className="glass rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Campaign → Goal Mappings</h3>
            <button
              onClick={() => {
                setEditingMapping(null);
                setShowMappingModal(true);
              }}
              className="flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
            >
              <PlusIcon className="h-4 w-4" />
              Add Mapping
            </button>
          </div>
          
          {campaignMappings.length === 0 ? (
            <p className="text-gray-400 text-center py-8">
              No campaign mappings configured. Add mappings to see drill-down analysis.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Campaign</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Platform</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Goals</th>
                    <th className="text-right py-3 px-4 text-gray-400 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {campaignMappings.map((mapping) => (
                    <tr key={mapping.id} className="border-b border-gray-700/50 hover:bg-gray-800/30">
                      <td className="py-3 px-4 text-white">{mapping.campaign_name || mapping.campaign_id}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          mapping.platform === 'facebook' 
                            ? 'bg-blue-500/20 text-blue-400' 
                            : 'bg-green-500/20 text-green-400'
                        }`}>
                          {mapping.platform}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {mapping.goals.map((goal) => (
                            <span 
                              key={goal}
                              className="px-2 py-0.5 rounded text-xs font-medium"
                              style={{ 
                                backgroundColor: `${GOAL_COLORS[goal as keyof typeof GOAL_COLORS]}20`,
                                color: GOAL_COLORS[goal as keyof typeof GOAL_COLORS]
                              }}
                            >
                              {GOAL_LABELS[goal as keyof typeof GOAL_LABELS]}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => {
                            setEditingMapping(mapping);
                            setShowMappingModal(true);
                          }}
                          className="text-purple-400 hover:text-purple-300 text-sm"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          
          {/* Overlap Warning */}
          {campaignMappings.some(m => m.goals.length > 1) && (
            <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-start gap-2">
              <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-yellow-400 font-medium text-sm">Overlap Detected</p>
                <p className="text-yellow-400/70 text-xs">
                  Some campaigns are mapped to multiple goals. Their spend will be distributed across those goals.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Source Breakdowns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* SMS Sources */}
        <div className="glass rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <ChatBubbleLeftIcon className="h-5 w-5 text-green-500" />
            <h3 className="text-lg font-semibold text-white">SMS Sources</h3>
          </div>
          {smsSourceBreakdown.length === 0 ? (
            <p className="text-gray-400 text-sm">No SMS signups in this period</p>
          ) : (
            <div className="space-y-3">
              {smsSourceBreakdown.map((source) => (
                <div key={source.source}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-300">{source.source}</span>
                    <span className="text-white font-medium">{source.count} ({source.percentage.toFixed(1)}%)</span>
                  </div>
                  <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-green-500 rounded-full"
                      style={{ width: `${source.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* User Sources */}
        <div className="glass rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <UserPlusIcon className="h-5 w-5 text-blue-500" />
            <h3 className="text-lg font-semibold text-white">User Sources</h3>
          </div>
          {userSourceBreakdown.length === 0 ? (
            <p className="text-gray-400 text-sm">No users in this period</p>
          ) : (
            <div className="space-y-3">
              {userSourceBreakdown.map((source) => (
                <div key={source.source}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-300">{source.source}</span>
                    <span className="text-white font-medium">{source.count} ({source.percentage.toFixed(1)}%)</span>
                  </div>
                  <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500 rounded-full"
                      style={{ width: `${source.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Order Sources */}
        <div className="glass rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <ShoppingCartIcon className="h-5 w-5 text-amber-500" />
            <h3 className="text-lg font-semibold text-white">Order Sources</h3>
          </div>
          {orderSourceBreakdown.length === 0 ? (
            <p className="text-gray-400 text-sm">No orders in this period</p>
          ) : (
            <div className="space-y-3">
              {orderSourceBreakdown.map((source) => (
                <div key={source.source}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-300">{source.source}</span>
                    <span className="text-white font-medium">{source.count} ({source.percentage.toFixed(1)}%)</span>
                  </div>
                  <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-amber-500 rounded-full"
                      style={{ width: `${source.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* API Credentials Modal */}
      {showCredentialsModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="rounded-xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto border border-gray-700" style={{ backgroundColor: '#111827' }}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">API Settings</h3>
              <button
                onClick={() => setShowCredentialsModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            {/* Connection Status */}
            <div className="mb-6 space-y-3">
              <h4 className="text-sm font-medium text-gray-400 mb-2">Connection Status</h4>
              {['facebook', 'instagram', 'rumble'].map((platform) => {
                const cred = credentials.find(c => c.platform === platform);
                const platformLabels: Record<string, string> = {
                  facebook: 'Facebook Ads',
                  instagram: 'Instagram (Followers)',
                  rumble: 'Rumble Ads'
                };
                return (
                  <div key={platform} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                    <div className="flex items-center gap-2">
                      {cred?.is_connected ? (
                        <CheckCircleIcon className="h-5 w-5 text-green-500" />
                      ) : (
                        <XMarkIcon className="h-5 w-5 text-red-500" />
                      )}
                      <span className="text-white">{platformLabels[platform]}</span>
                    </div>
                    <span className="text-gray-400 text-sm">
                      {cred?.is_connected 
                        ? `Last sync: ${cred.last_sync_at ? new Date(cred.last_sync_at).toLocaleString() : 'Never'}`
                        : 'Not connected'
                      }
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Add/Update Credentials */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-gray-400">Add/Update Credentials</h4>
              
              <div>
                <label className="block text-sm text-gray-400 mb-1">Platform</label>
                <select
                  value={credentialForm.platform}
                  onChange={(e) => setCredentialForm(prev => ({ 
                    ...prev, 
                    platform: e.target.value as 'facebook' | 'rumble' | 'instagram'
                  }))}
                  className="w-full bg-gray-800 text-white rounded-lg px-4 py-2"
                >
                  <option value="facebook">Facebook / Meta (Ads)</option>
                  <option value="instagram">Instagram (Followers)</option>
                  <option value="rumble">Rumble (Ads)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  {credentialForm.platform === 'rumble' ? 'API Key' : 'Access Token'}
                </label>
                <input
                  type="password"
                  value={credentialForm.access_token}
                  onChange={(e) => setCredentialForm(prev => ({ ...prev, access_token: e.target.value }))}
                  className="w-full bg-gray-800 text-white rounded-lg px-4 py-2"
                  placeholder={
                    credentialForm.platform === 'facebook' ? 'Enter Facebook access token' : 
                    credentialForm.platform === 'instagram' ? 'Enter Meta access token (same as Facebook)' :
                    'Enter Rumble API key'
                  }
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  {credentialForm.platform === 'facebook' ? 'Ad Account ID' : 
                   credentialForm.platform === 'instagram' ? 'Instagram Business Account ID (optional)' :
                   'Account ID'}
                </label>
                <input
                  type="text"
                  value={credentialForm.account_id}
                  onChange={(e) => setCredentialForm(prev => ({ ...prev, account_id: e.target.value }))}
                  className="w-full bg-gray-800 text-white rounded-lg px-4 py-2"
                  placeholder={
                    credentialForm.platform === 'facebook' ? 'act_123456789' : 
                    credentialForm.platform === 'instagram' ? 'Leave blank to auto-detect' :
                    'Your Rumble account ID'
                  }
                />
              </div>

              {credentialForm.platform === 'facebook' && (
                <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <p className="text-blue-400 text-sm">
                    <strong>Note:</strong> You need a Facebook Marketing API access token with <code>ads_read</code> permission.
                    Get one from the <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noopener noreferrer" className="underline">Graph API Explorer</a>.
                  </p>
                </div>
              )}

              {credentialForm.platform === 'instagram' && (
                <div className="p-3 bg-pink-500/10 border border-pink-500/30 rounded-lg">
                  <p className="text-pink-400 text-sm">
                    <strong>Note:</strong> Use the same Meta access token as Facebook. Required permissions: <code>instagram_basic</code>, <code>instagram_manage_insights</code>, <code>pages_read_engagement</code>.
                    Your Instagram must be a Business/Creator account connected to a Facebook Page.
                  </p>
                </div>
              )}

              <button
                onClick={saveCredentials}
                className="w-full py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                Save Credentials
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Campaign Mapping Modal */}
      {showMappingModal && (
        <CampaignMappingModal
          mapping={editingMapping}
          onSave={saveCampaignMapping}
          onClose={() => {
            setShowMappingModal(false);
            setEditingMapping(null);
          }}
        />
      )}
    </div>
  );
};

// Campaign Mapping Modal Component
interface CampaignMappingModalProps {
  mapping: CampaignMapping | null;
  onSave: (mapping: Partial<CampaignMapping>) => void;
  onClose: () => void;
}

interface AvailableCampaign {
  campaign_id: string;
  campaign_name: string;
  platform: string;
}

const CampaignMappingModal: React.FC<CampaignMappingModalProps> = ({ mapping, onSave, onClose }) => {
  const [form, setForm] = useState({
    campaign_id: mapping?.campaign_id || '',
    campaign_name: mapping?.campaign_name || '',
    platform: mapping?.platform || 'facebook' as 'facebook' | 'rumble',
    goals: mapping?.goals || [] as string[]
  });
  const [availableCampaigns, setAvailableCampaigns] = useState<AvailableCampaign[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);

  // Fetch available campaigns from ad_spend_daily
  useEffect(() => {
    const fetchCampaigns = async () => {
      try {
        // Get unique campaigns from ad_spend_daily
        const { data, error } = await supabase
          .from('ad_spend_daily')
          .select('campaign_id, campaign_name, platform')
          .order('campaign_name');
        
        if (error) throw error;
        
        // Deduplicate by campaign_id
        const uniqueCampaigns = new Map<string, AvailableCampaign>();
        (data || []).forEach(row => {
          if (!uniqueCampaigns.has(row.campaign_id)) {
            uniqueCampaigns.set(row.campaign_id, {
              campaign_id: row.campaign_id,
              campaign_name: row.campaign_name,
              platform: row.platform
            });
          }
        });
        
        setAvailableCampaigns(Array.from(uniqueCampaigns.values()));
      } catch (error) {
        console.error('Error fetching campaigns:', error);
      } finally {
        setLoadingCampaigns(false);
      }
    };
    
    fetchCampaigns();
  }, []);

  const toggleGoal = (goal: string) => {
    setForm(prev => ({
      ...prev,
      goals: prev.goals.includes(goal)
        ? prev.goals.filter(g => g !== goal)
        : [...prev.goals, goal]
    }));
  };

  const handleCampaignSelect = (campaignId: string) => {
    const campaign = availableCampaigns.find(c => c.campaign_id === campaignId);
    if (campaign) {
      setForm(prev => ({
        ...prev,
        campaign_id: campaign.campaign_id,
        campaign_name: campaign.campaign_name,
        platform: campaign.platform as 'facebook' | 'rumble'
      }));
    }
  };

  // Filter campaigns by selected platform
  const filteredCampaigns = availableCampaigns.filter(c => c.platform === form.platform);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="rounded-xl p-6 max-w-md w-full border border-gray-700" style={{ backgroundColor: '#111827' }}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-white">
            {mapping ? 'Edit' : 'Add'} Campaign Mapping
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Platform</label>
            <select
              value={form.platform}
              onChange={(e) => setForm(prev => ({ 
                ...prev, 
                platform: e.target.value as 'facebook' | 'rumble',
                campaign_id: '',
                campaign_name: ''
              }))}
              className="w-full bg-gray-800 text-white rounded-lg px-4 py-2"
              disabled={!!mapping}
            >
              <option value="facebook">Facebook / Meta</option>
              <option value="rumble">Rumble</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Campaign</label>
            {loadingCampaigns ? (
              <div className="w-full bg-gray-800 text-gray-400 rounded-lg px-4 py-2">
                Loading campaigns...
              </div>
            ) : filteredCampaigns.length > 0 ? (
              <select
                value={form.campaign_id}
                onChange={(e) => handleCampaignSelect(e.target.value)}
                className="w-full bg-gray-800 text-white rounded-lg px-4 py-2"
                disabled={!!mapping}
              >
                <option value="">Select a campaign...</option>
                {filteredCampaigns.map(campaign => (
                  <option key={campaign.campaign_id} value={campaign.campaign_id}>
                    {campaign.campaign_name || campaign.campaign_id}
                  </option>
                ))}
              </select>
            ) : (
              <div className="space-y-2">
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-4 py-2 text-yellow-400 text-sm">
                  No campaigns found. Sync your ad data first or enter manually below.
                </div>
                <input
                  type="text"
                  value={form.campaign_id}
                  onChange={(e) => setForm(prev => ({ ...prev, campaign_id: e.target.value }))}
                  className="w-full bg-gray-800 text-white rounded-lg px-4 py-2"
                  placeholder="Enter campaign ID manually"
                  disabled={!!mapping}
                />
              </div>
            )}
          </div>

          {form.campaign_id && (
            <div>
              <label className="block text-sm text-gray-400 mb-1">Campaign Name</label>
              <input
                type="text"
                value={form.campaign_name}
                onChange={(e) => setForm(prev => ({ ...prev, campaign_name: e.target.value }))}
                className="w-full bg-gray-800 text-white rounded-lg px-4 py-2"
                placeholder="e.g., Holiday Promo 2024"
              />
              <p className="text-gray-500 text-xs mt-1">ID: {form.campaign_id}</p>
            </div>
          )}

          <div>
            <label className="block text-sm text-gray-400 mb-2">Associated Goals</label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(GOAL_LABELS).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => toggleGoal(key)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                    form.goals.includes(key)
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:text-white'
                  }`}
                >
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: GOAL_COLORS[key as keyof typeof GOAL_COLORS] }}
                  />
                  {label}
                </button>
              ))}
            </div>
            {form.goals.length > 1 && (
              <p className="text-yellow-400 text-xs mt-2">
                ⚠️ Multiple goals selected - spend will be distributed across these goals
              </p>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={onClose}
              className="flex-1 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => onSave(form)}
              disabled={!form.campaign_id || form.goals.length === 0}
              className="flex-1 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdvancedAnalytics;

