import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  HomeIcon, 
  RectangleStackIcon, 
  UserCircleIcon, 
  ChatBubbleLeftRightIcon,
  BellIcon,
  BanknotesIcon,
  ChartBarIcon,
  ShareIcon,
  LinkIcon
} from '@heroicons/react/24/outline';
import { 
  HomeIcon as HomeIconSolid, 
  RectangleStackIcon as RectangleStackIconSolid, 
  UserCircleIcon as UserCircleIconSolid, 
  ChatBubbleLeftRightIcon as ChatBubbleLeftRightIconSolid,
  BellIcon as BellIconSolid,
  BanknotesIcon as BanknotesIconSolid,
  ChartBarIcon as ChartBarIconSolid,
  ShareIcon as ShareIconSolid,
  LinkIcon as LinkIconSolid
} from '@heroicons/react/24/solid';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';

// Feature flag: Only show Bio tab for specific users on dev environment
const BIO_FEATURE_ALLOWED_EMAILS = ['jb@apollo.inc'];
const IS_DEV_ENVIRONMENT = window.location.hostname === 'dev.shoutout.us' || window.location.hostname === 'localhost';

const MobileNavigation: React.FC = () => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [hasBioAccess, setHasBioAccess] = useState(false);

  // Check if user has bio access
  useEffect(() => {
    const checkBioAccess = async () => {
      if (!user || user.user_type !== 'talent') {
        setHasBioAccess(false);
        return;
      }
      
      // Check dev access first
      if (IS_DEV_ENVIRONMENT && user.email && BIO_FEATURE_ALLOWED_EMAILS.includes(user.email.toLowerCase())) {
        setHasBioAccess(true);
        return;
      }
      
      // Check talent profile bio_enabled
      const { data } = await supabase
        .from('talent_profiles')
        .select('bio_enabled')
        .eq('user_id', user.id)
        .single();
      
      setHasBioAccess(data?.bio_enabled === true);
    };
    
    checkBioAccess();
  }, [user]);

  console.log('🔍 MobileNavigation rendering, user:', user?.email, 'loading:', loading);

  // Don't render anything while auth is loading
  if (loading) {
    return null;
  }

  // Build talent navigation dynamically based on bio access
  const talentNavigation: Array<{
    name: string;
    href: string;
    icon: any;
    iconSolid: any;
    badge?: boolean;
    customIcon?: string;
  }> = [
    {
      name: 'Orders',
      href: '/dashboard?tab=orders',
      icon: RectangleStackIcon,
      iconSolid: RectangleStackIconSolid,
    },
    {
      name: 'Promote',
      href: '/dashboard?tab=media',
      icon: ShareIcon,
      iconSolid: ShareIconSolid,
    },
    // Conditionally add Link In Bio
    ...(hasBioAccess ? [{
      name: 'Link in Bio',
      href: '/dashboard?tab=bio',
      icon: LinkIcon,
      iconSolid: LinkIconSolid,
      customIcon: '/whiteicon.png',
    }] : []),
    {
      name: 'Profile',
      href: '/dashboard?tab=profile',
      icon: UserCircleIcon,
      iconSolid: UserCircleIconSolid,
    },
  ];

  // Navigation for logged-in users
  const authenticatedNavigation: Array<{
    name: string;
    href: string;
    icon: any;
    iconSolid: any;
    badge?: boolean;
    customIcon?: string;
  }> = user?.user_type === 'talent' ? talentNavigation : [
    // Regular User Navigation
    {
      name: 'Personalities',
      href: '/',
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
    customIcon?: string;
  }> = [
    {
      name: 'Personalities',
      href: '/',
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

  // Calculate grid columns based on navigation items
  const gridCols = navigation.length <= 2 ? 'grid-cols-2' : 
                   navigation.length === 3 ? 'grid-cols-3' : 'grid-cols-4';

  console.log('✅ Rendering mobile nav with', navigation.length, 'items', user ? '(authenticated)' : '(guest)');

  return (
    <div 
      className="fixed bottom-0 left-0 right-0 border-t border-white/20 md:hidden" 
      style={{ 
        background: 'rgba(17, 24, 39, 0.95)', 
        backdropFilter: 'blur(40px)',
        WebkitBackdropFilter: 'blur(40px)',
        zIndex: 9999,
        paddingBottom: 'env(safe-area-inset-bottom, 0px)'
      }}
    >
      <div className={`grid py-2 ${gridCols}`}>
        {navigation.map((item) => {
          // Better active detection for routes with query params
          const isActive = location.pathname === item.href || 
                          (item.href.includes('?') && location.pathname + location.search === item.href);
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
              {item.customIcon ? (
                <img 
                  src={item.customIcon} 
                  alt="" 
                  className="h-6 w-6" 
                  style={{ filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3))' }} 
                />
              ) : (
                <Icon className="h-6 w-6" style={{ filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3))' }} />
              )}
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
