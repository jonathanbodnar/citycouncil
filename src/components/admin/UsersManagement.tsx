import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { MagnifyingGlassIcon, UserCircleIcon, EnvelopeIcon, PhoneIcon, CalendarIcon, TagIcon, ArrowDownTrayIcon, TrashIcon, ChevronLeftIcon, ChevronRightIcon, UsersIcon, UserPlusIcon, StarIcon, ShieldCheckIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const USERS_PER_PAGE = 25;

interface UserStats {
  totalUsers: number;
  totalTalent: number;
  totalAdmins: number;
  newUsersToday: number;
  newUsersThisWeek: number;
  newUsersThisMonth: number;
  usersWithPhone: number;
  giveawayUsers: number;
  sourceBreakdown: { source: string; count: number }[];
}

interface User {
  id: string;
  email: string;
  phone?: string;
  full_name: string;
  avatar_url?: string;
  user_type: string;
  created_at: string;
  last_login?: string;
  sms_subscribed?: boolean;
  user_tags?: string[];
  promo_source?: string;
  did_holiday_popup?: boolean;
  subscribed_talents?: string[]; // Names of talents this user follows
}

interface TalentFollower {
  user_id: string;
  talent_profiles: {
    id: string;
    users: {
      full_name: string;
    } | {
      full_name: string;
    }[];
  } | null;
}

const UsersManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'talent' | 'user' | 'admin'>('all');
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [sourcesExpanded, setSourcesExpanded] = useState(false);
  const [stats, setStats] = useState<UserStats>({
    totalUsers: 0,
    totalTalent: 0,
    totalAdmins: 0,
    newUsersToday: 0,
    newUsersThisWeek: 0,
    newUsersThisMonth: 0,
    usersWithPhone: 0,
    giveawayUsers: 0,
    sourceBreakdown: [],
  });

  useEffect(() => {
    fetchUsers();
    fetchStats();
  }, [currentPage]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterType]);

  const fetchStats = async () => {
    try {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      // Fetch all stats in parallel
      const [
        { count: totalUsers },
        { count: totalTalent },
        { count: totalAdmins },
        { count: newUsersToday },
        { count: newUsersThisWeek },
        { count: newUsersThisMonth },
        { count: usersWithPhone },
        { count: giveawayUsers },
      ] = await Promise.all([
        supabase.from('users').select('*', { count: 'exact', head: true }),
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('user_type', 'talent'),
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('user_type', 'admin'),
        supabase.from('users').select('*', { count: 'exact', head: true }).gte('created_at', todayStart),
        supabase.from('users').select('*', { count: 'exact', head: true }).gte('created_at', weekStart),
        supabase.from('users').select('*', { count: 'exact', head: true }).gte('created_at', monthStart),
        supabase.from('users').select('*', { count: 'exact', head: true }).not('phone', 'is', null),
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('did_holiday_popup', true),
      ]);

      // Fetch source breakdown
      const { data: sourceData } = await supabase
        .from('users')
        .select('promo_source');

      // Count users by source
      const sourceCounts: Record<string, number> = {};
      (sourceData || []).forEach(user => {
        const source = user.promo_source || 'direct';
        sourceCounts[source] = (sourceCounts[source] || 0) + 1;
      });

      // Convert to array and sort by count
      const sourceBreakdown = Object.entries(sourceCounts)
        .map(([source, count]) => ({ source, count }))
        .sort((a, b) => b.count - a.count);

      setStats({
        totalUsers: totalUsers || 0,
        totalTalent: totalTalent || 0,
        totalAdmins: totalAdmins || 0,
        newUsersToday: newUsersToday || 0,
        newUsersThisWeek: newUsersThisWeek || 0,
        newUsersThisMonth: newUsersThisMonth || 0,
        usersWithPhone: usersWithPhone || 0,
        giveawayUsers: giveawayUsers || 0,
        sourceBreakdown,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      
      // Calculate pagination range
      const from = (currentPage - 1) * USERS_PER_PAGE;
      const to = from + USERS_PER_PAGE - 1;
      
      // First get total count
      const { count, error: countError } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true });

      if (countError) throw countError;
      setTotalCount(count || 0);
      
      // Fetch users with pagination
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false })
        .range(from, to);

      if (usersError) throw usersError;

      // Fetch talent followers to get subscription info for these users only
      const userIds = (usersData || []).map(u => u.id);
      const { data: followersData } = await supabase
        .from('talent_followers')
        .select(`
          user_id,
          talent_profiles!talent_followers_talent_id_fkey (
            id,
            users!talent_profiles_user_id_fkey (
              full_name
            )
          )
        `)
        .in('user_id', userIds);

      // Create a map of user_id -> talent names they follow
      const userSubscriptions: Record<string, string[]> = {};
      if (followersData) {
        for (const follower of followersData as any[]) {
          const userId = follower.user_id;
          // Handle both single object and array cases from Supabase
          const users = follower.talent_profiles?.users;
          const talentName = Array.isArray(users) ? users[0]?.full_name : users?.full_name;
          if (talentName) {
            if (!userSubscriptions[userId]) {
              userSubscriptions[userId] = [];
            }
            userSubscriptions[userId].push(talentName);
          }
        }
      }

      // Merge subscription data into users
      const usersWithSubscriptions = (usersData || []).map(user => ({
        ...user,
        subscribed_talents: userSubscriptions[user.id] || []
      }));

      setUsers(usersWithSubscriptions);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(user => {
    // Filter by type
    if (filterType !== 'all' && user.user_type !== filterType) {
      return false;
    }

    // Filter by search term
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        user.email?.toLowerCase().includes(search) ||
        user.full_name?.toLowerCase().includes(search) ||
        user.phone?.includes(search)
      );
    }

    return true;
  });

  // Pagination calculations
  const totalPages = Math.ceil(totalCount / USERS_PER_PAGE);
  const startIndex = (currentPage - 1) * USERS_PER_PAGE + 1;
  const endIndex = Math.min(currentPage * USERS_PER_PAGE, totalCount);

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);
      
      if (currentPage > 3) {
        pages.push('...');
      }
      
      // Show pages around current page
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      
      for (let i = start; i <= end; i++) {
        if (!pages.includes(i)) {
          pages.push(i);
        }
      }
      
      if (currentPage < totalPages - 2) {
        pages.push('...');
      }
      
      // Always show last page
      if (!pages.includes(totalPages)) {
        pages.push(totalPages);
      }
    }
    
    return pages;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
      timeZone: 'America/Chicago',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getUserTypeColor = (type: string) => {
    switch (type) {
      case 'admin':
        return 'bg-red-100 text-red-800';
      case 'talent':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-blue-100 text-blue-800';
    }
  };

  const exportToCSV = () => {
    try {
      // Prepare CSV headers
      const headers = ['Name', 'Email', 'Phone', 'Type', 'Tags', 'SMS Subscribed', 'Created', 'Last Login'];
      
      // Prepare CSV rows
      const rows = filteredUsers.map(user => [
        user.full_name || '',
        user.email || '',
        user.phone || '',
        user.user_type || '',
        user.user_tags?.join(', ') || '',
        user.sms_subscribed ? 'Yes' : 'No',
        formatDate(user.created_at),
        formatDate(user.last_login)
      ]);
      
      // Combine headers and rows
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');
      
      // Create blob and download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      link.setAttribute('href', url);
      link.setAttribute('download', `users_export_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success(`Exported ${filteredUsers.length} users to CSV`);
    } catch (error) {
      console.error('Error exporting users:', error);
      toast.error('Failed to export users');
    }
  };

  const handleDeleteUser = async (user: User) => {
    // Confirm deletion
    const confirmed = window.confirm(
      `Are you sure you want to delete user "${user.full_name || user.email}"?\n\nThis will:\n- Delete their account from authentication\n- Remove their profile data\n\nThis action cannot be undone!`
    );
    
    if (!confirmed) return;

    setDeletingUserId(user.id);
    
    try {
      // Call the delete-user edge function
      const response = await fetch(
        `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/delete-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ user_id: user.id }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete user');
      }

      // Remove from local state
      setUsers(users.filter(u => u.id !== user.id));
      setTotalCount(prev => prev - 1);
      toast.success(`User "${user.full_name || user.email}" deleted successfully`);
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast.error(error.message || 'Failed to delete user');
    } finally {
      setDeletingUserId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Users Management</h2>
          <p className="text-xs sm:text-sm text-gray-600 mt-1">
            {filteredUsers.length} {filterType !== 'all' ? filterType : ''} user{filteredUsers.length !== 1 ? 's' : ''}
          </p>
        </div>
        
        {/* Export Button */}
        <button
          onClick={exportToCSV}
          disabled={filteredUsers.length === 0}
          className="flex items-center gap-2 px-3 sm:px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto justify-center"
        >
          <ArrowDownTrayIcon className="h-4 w-4 sm:h-5 sm:w-5" />
          Export to CSV
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {/* Total Users */}
        <div className="glass rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <UsersIcon className="h-4 w-4 text-blue-600" />
            <span className="text-xs text-gray-500">Total</span>
          </div>
          <p className="text-xl font-bold text-gray-900">{stats.totalUsers.toLocaleString()}</p>
        </div>

        {/* Talent */}
        <div className="glass rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <StarIcon className="h-4 w-4 text-purple-600" />
            <span className="text-xs text-gray-500">Talent</span>
          </div>
          <p className="text-xl font-bold text-purple-600">{stats.totalTalent.toLocaleString()}</p>
        </div>

        {/* Admins */}
        <div className="glass rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheckIcon className="h-4 w-4 text-red-600" />
            <span className="text-xs text-gray-500">Admins</span>
          </div>
          <p className="text-xl font-bold text-red-600">{stats.totalAdmins.toLocaleString()}</p>
        </div>

        {/* New Today */}
        <div className="glass rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <UserPlusIcon className="h-4 w-4 text-green-600" />
            <span className="text-xs text-gray-500">Today</span>
          </div>
          <p className="text-xl font-bold text-green-600">+{stats.newUsersToday.toLocaleString()}</p>
        </div>

        {/* New This Week */}
        <div className="glass rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <UserPlusIcon className="h-4 w-4 text-emerald-600" />
            <span className="text-xs text-gray-500">This Week</span>
          </div>
          <p className="text-xl font-bold text-emerald-600">+{stats.newUsersThisWeek.toLocaleString()}</p>
        </div>

        {/* New This Month */}
        <div className="glass rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <UserPlusIcon className="h-4 w-4 text-teal-600" />
            <span className="text-xs text-gray-500">This Month</span>
          </div>
          <p className="text-xl font-bold text-teal-600">+{stats.newUsersThisMonth.toLocaleString()}</p>
        </div>

        {/* With Phone */}
        <div className="glass rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <PhoneIcon className="h-4 w-4 text-indigo-600" />
            <span className="text-xs text-gray-500">With Phone</span>
          </div>
          <p className="text-xl font-bold text-indigo-600">{stats.usersWithPhone.toLocaleString()}</p>
        </div>

        {/* Giveaway Users */}
        <div className="glass rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm">🎁</span>
            <span className="text-xs text-gray-500">Giveaway</span>
          </div>
          <p className="text-xl font-bold text-amber-600">{stats.giveawayUsers.toLocaleString()}</p>
        </div>
      </div>

      {/* Source Statistics */}
      {stats.sourceBreakdown.length > 0 && (
        <div className="glass rounded-2xl p-4 sm:p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <TagIcon className="h-4 w-4 text-purple-600" />
              User Sources
            </h3>
            {stats.sourceBreakdown.length > 5 && (
              <button
                onClick={() => setSourcesExpanded(!sourcesExpanded)}
                className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-700 font-medium transition-colors"
              >
                {sourcesExpanded ? (
                  <>
                    Show Less <ChevronUpIcon className="h-4 w-4" />
                  </>
                ) : (
                  <>
                    Show All ({stats.sourceBreakdown.length}) <ChevronDownIcon className="h-4 w-4" />
                  </>
                )}
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 font-semibold text-gray-700">Source</th>
                  <th className="text-right py-2 px-3 font-semibold text-gray-700">Users</th>
                  <th className="text-right py-2 px-3 font-semibold text-gray-700">%</th>
                </tr>
              </thead>
              <tbody>
                {(sourcesExpanded ? stats.sourceBreakdown : stats.sourceBreakdown.slice(0, 5)).map(({ source, count }, index) => (
                  <tr key={source} className={index % 2 === 0 ? 'bg-gray-50' : ''}>
                    <td className="py-2 px-3 text-gray-900 font-medium">{source}</td>
                    <td className="py-2 px-3 text-right text-purple-700 font-semibold">{count.toLocaleString()}</td>
                    <td className="py-2 px-3 text-right text-gray-600">{((count / stats.totalUsers) * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="glass rounded-2xl p-4 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, email, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Type Filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">All Users</option>
            <option value="user">Regular Users</option>
            <option value="talent">Talent</option>
            <option value="admin">Admins</option>
          </select>
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {/* Mobile pagination info */}
        {totalPages > 1 && (
          <div className="text-center text-sm text-gray-600 py-2">
            Page {currentPage} of {totalPages} ({totalCount} users)
          </div>
        )}
        
        {filteredUsers.length === 0 ? (
          <div className="glass rounded-xl p-6 text-center text-gray-500">
            No users found
          </div>
        ) : (
          filteredUsers.map((user) => (
            <div key={user.id} className="glass rounded-xl p-4 space-y-2">
              {/* Header: Avatar, Name, Type */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {user.avatar_url ? (
                    <img
                      src={user.avatar_url}
                      alt={user.full_name}
                      className="h-10 w-10 rounded-full object-cover flex-shrink-0"
                    />
                  ) : (
                    <UserCircleIcon className="h-10 w-10 text-gray-400 flex-shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900 truncate">{user.full_name || 'No name'}</p>
                    <p className="text-xs text-gray-500 truncate">{user.email}</p>
                  </div>
                </div>
                <span className={`px-2 py-1 text-xs font-semibold rounded-full flex-shrink-0 ${getUserTypeColor(user.user_type)}`}>
                  {user.user_type || 'user'}
                </span>
              </div>
              
              {/* Details */}
              <div className="flex flex-wrap gap-2 text-xs">
                {user.phone && (
                  <span className="flex items-center gap-1 text-gray-600">
                    <PhoneIcon className="h-3 w-3" />
                    {user.phone}
                  </span>
                )}
                <span className="flex items-center gap-1 text-gray-500">
                  <CalendarIcon className="h-3 w-3" />
                  {formatDate(user.created_at)}
                </span>
              </div>
              
              {/* Source Tags */}
              {(user.promo_source || user.did_holiday_popup) && (
                <div className="flex flex-wrap gap-1">
                  {user.promo_source && (
                    <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded-full">
                      📣 {user.promo_source}
                    </span>
                  )}
                  {user.did_holiday_popup && (
                    <span className="px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded-full">
                      📱 Popup
                    </span>
                  )}
                </div>
              )}
              
              {/* Delete Button */}
              <div className="pt-2 border-t border-gray-200 mt-2">
                <button
                  onClick={() => handleDeleteUser(user)}
                  disabled={deletingUserId === user.id || user.user_type === 'admin'}
                  className="flex items-center gap-1 text-xs text-red-600 hover:text-red-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <TrashIcon className="h-4 w-4" />
                  {deletingUserId === user.id ? 'Deleting...' : 'Delete User'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block glass rounded-2xl overflow-x-auto">
        <table className="w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                User
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Contact
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Type
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Source
              </th>
              <th className="hidden lg:table-cell px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Tags
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Joined
              </th>
              <th className="hidden xl:table-cell px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Last Login
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                  No users found
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  {/* User Column */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {user.avatar_url ? (
                        <img
                          src={user.avatar_url}
                          alt={user.full_name}
                          className="h-10 w-10 rounded-full object-cover flex-shrink-0"
                        />
                      ) : (
                        <UserCircleIcon className="h-10 w-10 text-gray-400 flex-shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate max-w-[150px]">
                          {user.full_name || 'No name'}
                        </p>
                        <p className="text-xs text-gray-500">
                          ID: {user.id.slice(0, 8)}...
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Contact Column */}
                  <td className="px-4 py-3">
                    <div className="space-y-1 max-w-[200px]">
                      <div className="flex items-center text-sm text-gray-900">
                        <EnvelopeIcon className="h-4 w-4 mr-1 text-gray-400 flex-shrink-0" />
                        <span className="truncate">{user.email || 'No email'}</span>
                      </div>
                      {user.phone && (
                        <div className="flex items-center text-sm text-gray-600">
                          <PhoneIcon className="h-4 w-4 mr-1 text-gray-400 flex-shrink-0" />
                          <span>{user.phone}</span>
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Type Column */}
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getUserTypeColor(user.user_type)}`}>
                      {user.user_type || 'user'}
                    </span>
                  </td>

                  {/* Source Column */}
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {user.promo_source && (
                        <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded-full">
                          📣 {user.promo_source}
                        </span>
                      )}
                      {user.did_holiday_popup && (
                        <span className="px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded-full">
                          📱 Popup
                        </span>
                      )}
                      {!user.promo_source && !user.did_holiday_popup && (
                        <span className="text-xs text-gray-400">Direct</span>
                      )}
                    </div>
                  </td>

                  {/* Tags Column - includes user_tags and subscribed talents */}
                  <td className="hidden lg:table-cell px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {/* User tags */}
                      {user.user_tags && user.user_tags.slice(0, 2).map((tag, idx) => (
                        <span
                          key={`tag-${idx}`}
                          className="px-2 py-0.5 text-xs bg-gray-100 text-gray-700 rounded-full"
                        >
                          {tag}
                        </span>
                      ))}
                      {user.user_tags && user.user_tags.length > 2 && (
                        <span className="text-xs text-gray-400">+{user.user_tags.length - 2}</span>
                      )}
                      {/* Subscribed talents */}
                      {user.subscribed_talents && user.subscribed_talents.slice(0, 2).map((talentName, idx) => (
                        <span
                          key={`sub-${idx}`}
                          className="px-2 py-0.5 text-xs bg-pink-100 text-pink-700 rounded-full"
                          title={`Subscribed to ${talentName}`}
                        >
                          ❤️ {talentName.split(' ')[0]}
                        </span>
                      ))}
                      {user.subscribed_talents && user.subscribed_talents.length > 2 && (
                        <span className="text-xs text-pink-400">+{user.subscribed_talents.length - 2} more</span>
                      )}
                      {/* Show dash if no tags or subscriptions */}
                      {(!user.user_tags || user.user_tags.length === 0) && 
                       (!user.subscribed_talents || user.subscribed_talents.length === 0) && (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </div>
                  </td>

                  {/* Joined Column */}
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {formatDate(user.created_at)}
                  </td>

                  {/* Last Login Column */}
                  <td className="hidden xl:table-cell px-4 py-3 text-sm text-gray-500">
                    {formatDate(user.last_login)}
                  </td>

                  {/* Actions Column */}
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleDeleteUser(user)}
                      disabled={deletingUserId === user.id || user.user_type === 'admin'}
                      className="flex items-center gap-1 px-2 py-1 text-xs text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title={user.user_type === 'admin' ? 'Cannot delete admin users' : 'Delete user'}
                    >
                      <TrashIcon className="h-4 w-4" />
                      {deletingUserId === user.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="glass rounded-2xl p-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Results info */}
            <p className="text-sm text-gray-600">
              Showing <span className="font-medium">{startIndex}</span> to <span className="font-medium">{endIndex}</span> of{' '}
              <span className="font-medium">{totalCount}</span> users
            </p>

            {/* Page controls */}
            <div className="flex items-center gap-1">
              {/* Previous button */}
              <button
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeftIcon className="h-5 w-5 text-gray-600" />
              </button>

              {/* Page numbers */}
              <div className="hidden sm:flex items-center gap-1">
                {getPageNumbers().map((page, idx) => (
                  typeof page === 'number' ? (
                    <button
                      key={idx}
                      onClick={() => goToPage(page)}
                      className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                        currentPage === page
                          ? 'bg-primary-600 text-white'
                          : 'border border-gray-300 hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      {page}
                    </button>
                  ) : (
                    <span key={idx} className="px-2 text-gray-400">...</span>
                  )
                ))}
              </div>

              {/* Mobile page indicator */}
              <span className="sm:hidden px-3 py-1 text-sm text-gray-600">
                Page {currentPage} of {totalPages}
              </span>

              {/* Next button */}
              <button
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRightIcon className="h-5 w-5 text-gray-600" />
              </button>
            </div>

            {/* Jump to page (desktop only) */}
            <div className="hidden lg:flex items-center gap-2">
              <span className="text-sm text-gray-600">Go to:</span>
              <input
                type="number"
                min={1}
                max={totalPages}
                value={currentPage}
                onChange={(e) => {
                  const page = parseInt(e.target.value);
                  if (page >= 1 && page <= totalPages) {
                    goToPage(page);
                  }
                }}
                className="w-16 px-2 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersManagement;

