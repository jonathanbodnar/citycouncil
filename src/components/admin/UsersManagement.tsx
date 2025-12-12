import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { MagnifyingGlassIcon, UserCircleIcon, EnvelopeIcon, PhoneIcon, CalendarIcon, TagIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

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
}

const UsersManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'talent' | 'user' | 'admin'>('all');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
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

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
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

      {/* Users Table */}
      <div className="glass rounded-2xl overflow-hidden">
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <div className="inline-block min-w-full align-middle">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="hidden md:table-cell px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="hidden md:table-cell px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Source
                  </th>
                  <th className="hidden lg:table-cell px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tags
                  </th>
                  <th className="hidden sm:table-cell px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Joined
                  </th>
                  <th className="hidden xl:table-cell px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Login
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 sm:px-6 py-8 sm:py-12 text-center text-gray-500 text-sm">
                      No users found
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      {/* User Column */}
                      <td className="px-3 sm:px-6 py-3 sm:py-4">
                        <div className="flex items-center min-w-0">
                          {user.avatar_url ? (
                            <img
                              src={user.avatar_url}
                              alt={user.full_name}
                              className="h-8 w-8 sm:h-10 sm:w-10 rounded-full object-cover flex-shrink-0"
                            />
                          ) : (
                            <UserCircleIcon className="h-8 w-8 sm:h-10 sm:w-10 text-gray-400 flex-shrink-0" />
                          )}
                          <div className="ml-2 sm:ml-4 min-w-0">
                            <div className="text-xs sm:text-sm font-medium text-gray-900 truncate">
                              {user.full_name || 'No name'}
                            </div>
                            <div className="text-xs text-gray-500 md:hidden truncate">
                              {user.email}
                            </div>
                            <div className="hidden md:block text-xs text-gray-500">
                              ID: {user.id.slice(0, 8)}...
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Contact Column - Hidden on mobile */}
                      <td className="hidden md:table-cell px-3 sm:px-6 py-3 sm:py-4">
                        <div className="space-y-1">
                          <div className="flex items-center text-sm text-gray-900 truncate">
                            <EnvelopeIcon className="h-4 w-4 mr-2 text-gray-400 flex-shrink-0" />
                            <span className="truncate">{user.email || 'No email'}</span>
                          </div>
                          {user.phone && (
                            <div className="flex items-center text-sm text-gray-600">
                              <PhoneIcon className="h-4 w-4 mr-2 text-gray-400 flex-shrink-0" />
                              <span>{user.phone}</span>
                              {user.sms_subscribed && (
                                <span className="ml-2 text-xs text-green-600">✓ SMS</span>
                              )}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Type Column */}
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getUserTypeColor(user.user_type)}`}>
                          {user.user_type || 'user'}
                        </span>
                      </td>

                      {/* Source Column - Shows UTM source and holiday popup */}
                      <td className="hidden md:table-cell px-3 sm:px-6 py-3 sm:py-4">
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

                      {/* Tags Column - Hidden on smaller screens */}
                      <td className="hidden lg:table-cell px-3 sm:px-6 py-3 sm:py-4">
                        {user.user_tags && user.user_tags.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {user.user_tags.map((tag, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-full flex items-center"
                              >
                                <TagIcon className="h-3 w-3 mr-1" />
                                {tag}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs sm:text-sm text-gray-400">No tags</span>
                        )}
                      </td>

                      {/* Joined Column - Hidden on mobile */}
                      <td className="hidden sm:table-cell px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500">
                        <div className="flex items-center">
                          <CalendarIcon className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 text-gray-400" />
                          {formatDate(user.created_at)}
                        </div>
                      </td>

                      {/* Last Login Column - Hidden on smaller screens */}
                      <td className="hidden xl:table-cell px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500">
                        {formatDate(user.last_login)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UsersManagement;

