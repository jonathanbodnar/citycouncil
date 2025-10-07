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

  if (!user) return null;

  const navigation = [
    {
      name: 'Home',
      href: '/',
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

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 md:hidden">
      <div className="grid grid-cols-5 py-2">
        {navigation.map((item) => {
          const isActive = location.pathname === item.href;
          const Icon = isActive ? item.iconSolid : item.icon;
          
          return (
            <Link
              key={item.name}
              to={item.href}
              className={`flex flex-col items-center py-2 px-1 relative ${
                isActive
                  ? 'text-primary-600'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <Icon className="h-6 w-6" />
              {item.badge && (
                <span className="absolute top-1 right-1/2 transform translate-x-2 block h-2 w-2 rounded-full bg-red-400"></span>
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
