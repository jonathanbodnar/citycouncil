import React, { Fragment, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, Transition } from '@headlessui/react';
import { 
  UserCircleIcon, 
  Cog6ToothIcon, 
  ArrowRightOnRectangleIcon,
  BellIcon 
} from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { Notification } from '../types';
import Logo from './Logo';

const Header: React.FC = () => {
  const { user, signOut } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const navigate = useNavigate();
  const notificationRef = React.useRef<HTMLDivElement>(null);

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
    <header className="glass border-b border-white/10 backdrop-blur-xl relative z-[10001]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/home" className="flex items-center">
            <Logo size="md" theme="dark" />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            <Link 
              to="/home" 
              className="text-gray-700 hover:text-primary-600 font-medium"
            >
              Home
            </Link>
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
            {user ? (
              <>
                {/* Notifications */}
                <div className="relative" ref={notificationRef}>
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
                      className="absolute right-0 mt-2 w-80 rounded-2xl shadow-modern-xl border border-white/30 z-[10000] overflow-hidden" 
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
                <Menu as="div" className="relative z-[10000]">
                  <Menu.Button className="flex items-center space-x-2 p-2 rounded-xl hover:bg-white/10 transition-all duration-200">
                    <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center">
                      <UserCircleIcon className="h-6 w-6 text-white" />
                    </div>
                    <span className="hidden md:block text-sm font-medium text-white">
                      {user.full_name}
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
                    <Menu.Items className="absolute right-0 mt-2 w-48 origin-top-right glass-strong rounded-2xl shadow-modern-xl ring-1 ring-white/20 focus:outline-none z-[9999] overflow-hidden" style={{ background: 'rgba(255, 255, 255, 0.15)', backdropFilter: 'blur(25px)' }}>
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
              <div className="flex items-center space-x-4">
                <Link
                  to="/login"
                  className="text-gray-700 hover:text-primary-600 font-medium"
                >
                  Sign In
                </Link>
                <Link
                  to="/signup"
                  className="bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700 font-medium"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
