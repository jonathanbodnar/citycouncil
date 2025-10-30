import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  HomeIcon, 
  RectangleStackIcon, 
  UserCircleIcon, 
  ChatBubbleLeftRightIcon,
  BellIcon 
} from '@heroicons/react/24/outline';
import { 
  HomeIcon as HomeIconSolid, 
  RectangleStackIcon as RectangleStackIconSolid, 
  UserCircleIcon as UserCircleIconSolid, 
  ChatBubbleLeftRightIcon as ChatBubbleLeftRightIconSolid,
  BellIcon as BellIconSolid 
} from '@heroicons/react/24/solid';
import { useAuth } from '../context/AuthContext';

const MobileNavigation: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();

  console.log('🔍 MobileNavigation rendering, user:', user?.email, 'user type:', user?.user_type);

  if (!user) {
    console.log('❌ No user, not showing mobile nav');
    return null;
  }

  const navigation = [
    {
      name: 'Home',
      href: '/home',
      icon: HomeIcon,
      iconSolid: HomeIconSolid,
    },
    {
      name: user?.user_type === 'talent' ? 'Orders' : 'My Orders',
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
    {
      name: 'Profile',
      href: '/dashboard?tab=profile',
      icon: UserCircleIcon,
      iconSolid: UserCircleIconSolid,
    },
  ];

  console.log('✅ Rendering mobile nav with', navigation.length, 'items');

  return (
    <div className="fixed bottom-0 left-0 right-0 glass-strong border-t border-white/20 md:hidden backdrop-blur-xl" style={{ background: 'rgba(255, 255, 255, 0.25)', zIndex: 9999 }}>
      <div className="grid grid-cols-5 py-2">
        {navigation.map((item) => {
          const isActive = location.pathname === item.href;
          const Icon = isActive ? item.iconSolid : item.icon;
          
          return (
            <Link
              key={item.name}
              to={item.href}
              className={`flex flex-col items-center py-2 px-1 relative transition-all ${
                isActive
                  ? 'text-white'
                  : 'text-white/70 hover:text-white'
              }`}
              style={{ textShadow: '0 1px 3px rgba(0, 0, 0, 0.3)' }}
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
