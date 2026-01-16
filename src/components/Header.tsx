import React, { Fragment, useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Menu, Transition } from '@headlessui/react';
import { 
  UserCircleIcon, 
  Cog6ToothIcon, 
  ArrowRightOnRectangleIcon,
  BellIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  GiftIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { Notification } from '../types';
import Logo from './Logo';
import { getActivePrizeCountdown } from './HolidayPromoPopup';

interface TalentSearchResult {
  id: string;
  username: string;
  temp_full_name: string;
  temp_avatar_url: string;
  pricing: number;
  users?: {
    full_name: string;
    avatar_url: string;
  };
}

const Header: React.FC = () => {
  const { user, signOut } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [displayName, setDisplayName] = useState<string>('');
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<TalentSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [prizeCountdown, setPrizeCountdown] = useState<{ prize: string; code: string; hours: number; minutes: number; seconds: number } | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const isHomePage = location.pathname === '/' || location.pathname === '/home';
  const notificationRef = React.useRef<HTMLDivElement>(null);
  const searchRef = React.useRef<HTMLDivElement>(null);
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  // Prize countdown timer
  useEffect(() => {
    const updatePrizeCountdown = () => {
      const activePrize = getActivePrizeCountdown();
      if (activePrize) {
        const diff = activePrize.expiresAt - Date.now();
        if (diff > 0) {
          const hours = Math.floor(diff / (1000 * 60 * 60));
          const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          const seconds = Math.floor((diff % (1000 * 60)) / 1000);
          setPrizeCountdown({
            prize: activePrize.prize,
            code: activePrize.code,
            hours,
            minutes,
            seconds
          });
        } else {
          setPrizeCountdown(null);
        }
      } else {
        setPrizeCountdown(null);
      }
    };

    updatePrizeCountdown();
    const interval = setInterval(updatePrizeCountdown, 1000);

    // Listen for giveaway updates
    const handleGiveawayUpdate = () => updatePrizeCountdown();
    window.addEventListener('giveawayCountdownUpdate', handleGiveawayUpdate);

    return () => {
      clearInterval(interval);
      window.removeEventListener('giveawayCountdownUpdate', handleGiveawayUpdate);
    };
  }, []);

  // Fetch display name (prioritize talent_profiles.full_name for talent users)
  useEffect(() => {
    const fetchDisplayName = async () => {
      if (!user) {
        setDisplayName('');
        return;
      }

      // For talent users, fetch from talent_profiles
      if (user.user_type === 'talent') {
        try {
          const { data, error } = await supabase
            .from('talent_profiles')
            .select('full_name')
            .eq('user_id', user.id)
            .single();

          if (error) throw error;
          
          // Use talent profile name if available, otherwise fall back to user.full_name or email
          const finalName = data?.full_name || user.full_name || user.email?.split('@')[0];
          setDisplayName(finalName);
          
          console.log('📝 Header - Name sources:');
          console.log('  - talent_profiles.full_name:', data?.full_name);
          console.log('  - users.full_name (fallback):', user.full_name);
          console.log('  - Final display name:', finalName);
          console.log('  - First name shown:', finalName?.split(' ')[0]);
        } catch (error) {
          console.error('Error fetching talent profile name:', error);
          setDisplayName(user.full_name || user.email?.split('@')[0]);
        }
      } else {
        // For non-talent users, use user.full_name or email prefix
        setDisplayName(user.full_name || user.email?.split('@')[0]);
      }
    };

    fetchDisplayName();
  }, [user]);

  // Fetch notifications on mount and when user changes
  useEffect(() => {
    if (user) {
      fetchNotifications();
      
      // Set up real-time subscription for new notifications
      const channel = supabase
        .channel('notifications-header')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`
          },
          () => {
            fetchNotifications();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  // Close notifications when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };

    if (showNotifications) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNotifications]);

  // Close search when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearch(false);
        setSearchQuery('');
        setSearchResults([]);
      }
    };

    if (showSearch) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSearch]);

  // Focus search input when opened
  useEffect(() => {
    if (showSearch && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [showSearch]);

  // Search talent as user types
  useEffect(() => {
    const searchTalent = async () => {
      // On homepage, update URL params to filter cards instead of showing dropdown
      if (isHomePage) {
        const url = new URL(window.location.href);
        if (searchQuery.trim()) {
          url.searchParams.set('q', searchQuery.trim());
        } else {
          url.searchParams.delete('q');
        }
        window.history.replaceState({}, '', url.toString());
        // Dispatch custom event for HomePage to listen to
        window.dispatchEvent(new CustomEvent('headerSearch', { detail: searchQuery }));
        setSearchResults([]);
        return;
      }

      if (!searchQuery.trim()) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const { data, error } = await supabase
          .from('talent_profiles')
          .select(`
            id,
            username,
            temp_full_name,
            temp_avatar_url,
            pricing,
            users!talent_profiles_user_id_fkey (
              full_name,
              avatar_url
            )
          `)
          .eq('is_active', true)
          .or(`temp_full_name.ilike.%${searchQuery}%,username.ilike.%${searchQuery}%`)
          .limit(5);

        if (error) throw error;
        // Cast data to match our interface (Supabase returns users as object, not array)
        setSearchResults((data as unknown as TalentSearchResult[]) || []);
      } catch (error) {
        console.error('Error searching talent:', error);
      } finally {
        setIsSearching(false);
      }
    };

    const debounce = setTimeout(searchTalent, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery, isHomePage]);

  const handleSearchResultClick = (talent: TalentSearchResult) => {
    setShowSearch(false);
    setSearchQuery('');
    setSearchResults([]);
    navigate(talent.username ? `/${talent.username}` : `/talent/${talent.id}`);
  };

  // Mark notifications as read when dropdown is opened
  useEffect(() => {
    const markNotificationsAsRead = async () => {
      if (!user || !showNotifications || notifications.length === 0) return;

      // Get IDs of unread notifications
      const unreadIds = notifications
        .filter(n => !n.is_read)
        .map(n => n.id);

      if (unreadIds.length === 0) return;

      try {
        const { error } = await supabase
          .from('notifications')
          .update({ is_read: true })
          .in('id', unreadIds);

        if (error) throw error;

        // Update local state
        setNotifications(prevNotifications =>
          prevNotifications.map(n =>
            unreadIds.includes(n.id) ? { ...n, is_read: true } : n
          )
        );
        setUnreadCount(0);
      } catch (error) {
        console.error('Error marking notifications as read:', error);
      }
    };

    if (showNotifications) {
      // Small delay to allow user to see the notifications before marking as read
      const timer = setTimeout(markNotificationsAsRead, 500);
      return () => clearTimeout(timer);
    }
  }, [showNotifications, notifications, user]);

  const fetchNotifications = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;

      setNotifications(data || []);
      setUnreadCount(data?.filter(n => !n.is_read).length || 0);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <header className="glass border-b border-white/10 backdrop-blur-xl relative z-[1000]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center">
            <Logo size="md" theme="dark" />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            {!isHomePage && (
              <Link 
                to="/" 
                className="text-gray-700 hover:text-primary-600 font-medium"
              >
                Personalities
              </Link>
            )}
            {user && (
              <Link 
                to="/dashboard" 
                className="text-gray-700 hover:text-primary-600 font-medium"
              >
                {user.user_type === 'talent' ? 'Dashboard' : 'My Orders'}
              </Link>
            )}
            {user?.user_type === 'admin' && (
              <Link 
                to="/admin" 
                className="text-gray-700 hover:text-primary-600 font-medium"
              >
                Admin
              </Link>
            )}
          </nav>

          {/* User Menu */}
          <div className="flex items-center space-x-4">
            {/* Prize Countdown Banner */}
            {prizeCountdown && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full text-white text-sm font-medium animate-pulse" style={{
                background: 'linear-gradient(90deg, #10b981 0%, #3b82f6 100%)'
              }}>
                <GiftIcon className="h-4 w-4" />
                <span>{prizeCountdown.prize}</span>
                <span className="font-mono font-bold">
                  {String(prizeCountdown.hours).padStart(2, '0')}:{String(prizeCountdown.minutes).padStart(2, '0')}:{String(prizeCountdown.seconds).padStart(2, '0')}
                </span>
              </div>
            )}

            {/* Search Button */}
            <div className="relative z-[2000]" ref={searchRef}>
              <button
                onClick={() => setShowSearch(!showSearch)}
                className="p-2 text-white hover:text-gray-300 transition-colors"
                title="Search talent"
              >
                {showSearch ? (
                  <XMarkIcon className="h-6 w-6" />
                ) : (
                  <MagnifyingGlassIcon className="h-6 w-6" />
                )}
              </button>

              {/* Search Dropdown */}
              {showSearch && (
                <div
                  className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl shadow-modern-xl border border-white/30 overflow-hidden z-[2001]"
                  style={{
                    background: 'rgba(17, 24, 39, 0.95)',
                    backdropFilter: 'blur(40px)',
                    WebkitBackdropFilter: 'blur(40px)'
                  }}
                >
                  <div className="p-4">
                    <div className="relative">
                      <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        ref={searchInputRef}
                        type="text"
                        placeholder={isHomePage ? "Filter talent..." : "Search talent..."}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-white/20 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        style={{
                          background: 'rgba(255, 255, 255, 0.1)',
                          color: 'white'
                        }}
                      />
                    </div>

                    {/* Search Results - Only show on non-homepage */}
                    {!isHomePage && (
                    <div className="mt-3 max-h-80 overflow-y-auto">
                      {isSearching ? (
                        <div className="text-center py-4">
                          <div className="animate-spin h-6 w-6 border-2 border-white/30 border-t-white rounded-full mx-auto"></div>
                        </div>
                      ) : searchResults.length > 0 ? (
                        <div className="space-y-2">
                          {searchResults.map((talent) => (
                            <button
                              key={talent.id}
                              onClick={() => handleSearchResultClick(talent)}
                              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/10 transition-colors text-left"
                            >
                              <div className="w-12 h-12 rounded-full bg-gray-700 overflow-hidden flex-shrink-0">
                                {(talent.temp_avatar_url || talent.users?.avatar_url) ? (
                                  <img
                                    src={talent.temp_avatar_url || talent.users?.avatar_url}
                                    alt={talent.temp_full_name || talent.users?.full_name}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-white/60 text-lg font-bold">
                                    {(talent.temp_full_name || talent.users?.full_name || '?').charAt(0)}
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-white font-medium truncate">
                                  {talent.temp_full_name || talent.users?.full_name}
                                </p>
                                <p className="text-green-400 text-sm font-semibold">
                                  ${talent.pricing}
                                </p>
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : searchQuery.trim() ? (
                        <div className="text-center py-6 text-gray-400">
                          <p>No talent found</p>
                          <p className="text-sm mt-1">Try a different search term</p>
                        </div>
                      ) : (
                        <div className="text-center py-6 text-gray-400">
                          <p className="text-sm">Start typing to search talent...</p>
                        </div>
                      )}
                    </div>
                    )}
                    {/* Homepage hint */}
                    {isHomePage && (
                      <p className="mt-2 text-xs text-gray-400 text-center">Type to filter talent cards below</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {user ? (
              <>
                {/* Notifications */}
                <div className="relative z-[2000]" ref={notificationRef}>
                  <button 
                    onClick={() => setShowNotifications(!showNotifications)}
                    className="p-2 text-white hover:text-gray-300 relative transition-colors"
                  >
                    <BellIcon className="h-6 w-6" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 flex items-center justify-center h-5 w-5 rounded-full bg-red-500 text-white text-xs font-bold">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </button>

                  {/* Notification Dropdown */}
                  {showNotifications && (
                    <div 
                      className="absolute right-0 mt-2 w-80 rounded-2xl shadow-modern-xl border border-white/30 overflow-hidden z-[2001]" 
                      style={{ 
                        background: 'rgba(17, 24, 39, 0.95)', 
                        backdropFilter: 'blur(40px)',
                        WebkitBackdropFilter: 'blur(40px)'
                      }}
                    >
                      <div className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="font-semibold text-white">Notifications</h3>
                          <Link 
                            to="/notifications"
                            className="text-xs text-blue-400 hover:text-blue-300"
                            onClick={() => setShowNotifications(false)}
                          >
                            View All
                          </Link>
                        </div>
                        <div className="space-y-2 max-h-96 overflow-y-auto">
                          {notifications.length === 0 ? (
                            <p className="text-sm text-gray-400 text-center py-8">
                              No new notifications
                            </p>
                          ) : (
                            notifications.map((notification) => (
                              <Link
                                key={notification.id}
                                to="/notifications"
                                onClick={() => setShowNotifications(false)}
                                className={`block p-3 rounded-lg transition-colors ${
                                  notification.is_read 
                                    ? 'bg-white/5 hover:bg-white/10' 
                                    : 'bg-blue-500/30 hover:bg-blue-500/40 border border-blue-400/50'
                                }`}
                              >
                                <div className="flex items-start space-x-2">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-white truncate">
                                      {notification.title}
                                    </p>
                                    <p className="text-xs text-gray-300 mt-1 line-clamp-2">
                                      {notification.message}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-1">
                                      {new Date(notification.created_at).toLocaleDateString()}
                                    </p>
                                  </div>
                                  {!notification.is_read && (
                                    <div className="flex-shrink-0">
                                      <div className="h-2 w-2 rounded-full bg-blue-400"></div>
                                    </div>
                                  )}
                                </div>
                              </Link>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* User Dropdown */}
                <Menu as="div" className="relative z-[1500]">
                  <Menu.Button className="flex items-center space-x-2 p-2 rounded-xl hover:bg-white/10 transition-all duration-200">
                    <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center">
                      <UserCircleIcon className="h-6 w-6 text-white" />
                    </div>
                    <span className="hidden md:block text-sm font-medium text-white">
                      {(displayName || user.full_name)?.split(' ')[0]}
                    </span>
                  </Menu.Button>

                  <Transition
                    as={Fragment}
                    enter="transition ease-out duration-200"
                    enterFrom="transform opacity-0 scale-95"
                    enterTo="transform opacity-100 scale-100"
                    leave="transition ease-in duration-75"
                    leaveFrom="transform opacity-100 scale-100"
                    leaveTo="transform opacity-0 scale-95"
                  >
                    <Menu.Items className="absolute right-0 mt-2 w-48 origin-top-right rounded-2xl shadow-modern-xl ring-1 ring-white/20 focus:outline-none z-[1501] overflow-hidden" style={{ background: 'rgba(17, 24, 39, 0.95)', backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)' }}>
                      <div className="py-1">
                        <Menu.Item>
                          {({ active }) => (
                            <Link
                              to="/dashboard?tab=profile"
                              className={`${
                                active ? 'bg-white/5' : ''
                              } flex items-center px-4 py-2 text-sm text-white hover:bg-white/5 transition-colors`}
                            >
                              <UserCircleIcon className="mr-3 h-5 w-5" />
                              Profile
                            </Link>
                          )}
                        </Menu.Item>
                        <Menu.Item>
                          {({ active }) => (
                            <button
                              onClick={handleSignOut}
                              className={`${
                                active ? 'bg-white/5' : ''
                              } flex items-center w-full px-4 py-2 text-sm text-white hover:bg-white/5 transition-colors`}
                            >
                              <ArrowRightOnRectangleIcon className="mr-3 h-5 w-5" />
                              Sign Out
                            </button>
                          )}
                        </Menu.Item>
                      </div>
                    </Menu.Items>
                  </Transition>
                </Menu>
              </>
            ) : (
              <Link
                to="/login"
                className="bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700 font-medium"
              >
                Login
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
