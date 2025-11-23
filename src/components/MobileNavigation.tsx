import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  HomeIcon, 
  RectangleStackIcon, 
  UserCircleIcon, 
  ChatBubbleLeftRightIcon,
  BellIcon,
  BanknotesIcon,
  ChartBarIcon,
  ShareIcon
} from '@heroicons/react/24/outline';
import { 
  HomeIcon as HomeIconSolid, 
  RectangleStackIcon as RectangleStackIconSolid, 
  UserCircleIcon as UserCircleIconSolid, 
  ChatBubbleLeftRightIcon as ChatBubbleLeftRightIconSolid,
  BellIcon as BellIconSolid,
  BanknotesIcon as BanknotesIconSolid,
  ChartBarIcon as ChartBarIconSolid,
  ShareIcon as ShareIconSolid
} from '@heroicons/react/24/solid';
import { useAuth } from '../context/AuthContext';

const MobileNavigation: React.FC = () => {
  const { user, loading } = useAuth();
  const location = useLocation();

  console.log('🔍 MobileNavigation rendering, user:', user?.email, 'loading:', loading);

  // Don't render anything while auth is loading
  if (loading) {
    return null;
  }

  // Navigation for logged-in users
  const authenticatedNavigation: Array<{
    name: string;
    href: string;
    icon: any;
    iconSolid: any;
    badge?: boolean;
  }> = user?.user_type === 'talent' ? [
    // Talent Navigation (no Home, has Stats)
    {
      name: 'Orders',
      href: '/dashboard',
      icon: RectangleStackIcon,
      iconSolid: RectangleStackIconSolid,
    },
    {
      name: 'Stats',
      href: '/dashboard?tab=analytics',
      icon: ChartBarIcon,
      iconSolid: ChartBarIconSolid,
    },
    {
      name: 'Share Profile',
      href: '/dashboard?tab=media',
      icon: ShareIcon,
      iconSolid: ShareIconSolid,
    },
    {
      name: 'Profile',
      href: '/dashboard?tab=profile',
      icon: UserCircleIcon,
      iconSolid: UserCircleIconSolid,
    },
  ] : [
    // Regular User Navigation
    {
      name: 'Home',
      href: '/home',
      icon: HomeIcon,
      iconSolid: HomeIconSolid,
    },
    {
      name: 'My Orders',
      href: '/dashboard',
      icon: RectangleStackIcon,
      iconSolid: RectangleStackIconSolid,
    },
    {
      name: 'Notifications',
      href: '/notifications',
      icon: BellIcon,
      iconSolid: BellIconSolid,
      badge: true,
    },
    {
      name: 'Help',
      href: '/help',
      icon: ChatBubbleLeftRightIcon,
      iconSolid: ChatBubbleLeftRightIconSolid,
    },
  ];

  // Navigation for non-logged-in users
  const guestNavigation: Array<{
    name: string;
    href: string;
    icon: any;
    iconSolid: any;
    badge?: boolean;
  }> = [
    {
      name: 'Home',
      href: '/home',
      icon: HomeIcon,
      iconSolid: HomeIconSolid,
    },
    {
      name: 'Login',
      href: '/login',
      icon: UserCircleIcon,
      iconSolid: UserCircleIconSolid,
    },
  ];

  const navigation = user ? authenticatedNavigation : guestNavigation;

  console.log('✅ Rendering mobile nav with', navigation.length, 'items', user ? '(authenticated)' : '(guest)');

  return (
    <div 
      className="fixed left-0 right-0 border-t border-white/20 md:hidden" 
      style={{ 
        bottom: 0,
        background: 'rgba(17, 24, 39, 0.95)', 
        backdropFilter: 'blur(40px)',
        WebkitBackdropFilter: 'blur(40px)',
        zIndex: 9999,
        paddingBottom: 'env(safe-area-inset-bottom)',
        // Force the element to stay at the bottom even when browser UI collapses
        position: 'fixed'
      }}
    >
      <div className={`grid py-2 ${user ? (user.user_type === 'talent' ? 'grid-cols-4' : 'grid-cols-4') : 'grid-cols-2'}`}>
        {navigation.map((item) => {
          // Better active detection for routes with query params
          const isActive = location.pathname === item.href || 
                          (item.href.includes('?') && location.pathname + location.search === item.href) ||
                          (item.href === '/dashboard' && location.pathname === '/dashboard' && !location.search);
          const Icon = isActive ? item.iconSolid : item.icon;
          
          return (
            <Link
              key={item.name}
              to={item.href}
              className="flex flex-col items-center py-2 px-1 relative transition-all"
              style={{ 
                textShadow: '0 1px 3px rgba(0, 0, 0, 0.3)',
                color: isActive ? '#ffffff' : 'rgba(255, 255, 255, 0.7)'
              }}
            >
              <Icon className="h-6 w-6" style={{ filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3))' }} />
              {item.badge && (
                <span className="absolute top-1 right-1/2 transform translate-x-2 block h-2 w-2 rounded-full bg-red-500 shadow-lg"></span>
              )}
              <span className="text-xs mt-1 font-medium">{item.name}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default MobileNavigation;
