import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  UsersIcon,
  Cog6ToothIcon,
  ChatBubbleLeftRightIcon,
  ChartBarIcon,
  CurrencyDollarIcon,
  StarIcon,
  VideoCameraIcon,
  HashtagIcon,
  Bars3Icon,
  XMarkIcon,
  ArrowUpTrayIcon,
  ShoppingCartIcon,
  DevicePhoneMobileIcon,
  BellIcon,
  TagIcon
} from '@heroicons/react/24/outline';
import Logo from './Logo';

interface AdminLayoutProps {
  children: React.ReactNode;
}

interface NavItem {
  key: string;
  label: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { key: 'analytics', label: 'Analytics', icon: ChartBarIcon },
  { key: 'orders', label: 'Orders', icon: ShoppingCartIcon },
  { key: 'talent', label: 'Talent', icon: UsersIcon },
  { key: 'coupons', label: 'Coupons', icon: TagIcon },
  { key: 'comms', label: 'Comms Center', icon: DevicePhoneMobileIcon },
  { key: 'notifications', label: 'Notifications', icon: BellIcon },
  { key: 'promo-videos', label: 'Promo Videos', icon: VideoCameraIcon },
  { key: 'landing-videos', label: 'Landing Videos', icon: StarIcon },
  { key: 'bulk-upload', label: 'Bulk Upload', icon: ArrowUpTrayIcon },
  { key: 'social-tracking', label: 'Social Tracking', icon: HashtagIcon },
  { key: 'settings', label: 'Platform Settings', icon: Cog6ToothIcon },
  { key: 'helpdesk', label: 'Help Desk', icon: ChatBubbleLeftRightIcon },
];

const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Get active tab from URL query params
  const searchParams = new URLSearchParams(location.search);
  const activeTab = searchParams.get('tab') || 'analytics';

  const handleNavigation = (key: string) => {
    navigate(`/admin?tab=${key}`);
    setSidebarOpen(false);
  };

  return (
    <div className="min-h-screen flex">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 glass-strong border-r border-white/20 transform transition-transform duration-300 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-white/20">
          <Logo size="sm" theme="dark" />
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <XMarkIcon className="h-6 w-6 text-white" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1 overflow-y-auto h-[calc(100vh-4rem)]">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.key;

            return (
              <button
                key={item.key}
                onClick={() => handleNavigation(item.key)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg'
                    : 'text-gray-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className={`h-5 w-5 ${isActive ? 'text-white' : 'text-gray-400'}`} />
                <span className="font-medium">{item.label}</span>
                {isActive && (
                  <div className="ml-auto w-2 h-2 rounded-full bg-white" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Admin Badge */}
        <div className="absolute bottom-4 left-4 right-4">
          <div className="glass rounded-xl p-3 border border-white/20">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-sm font-medium text-white">Admin Mode</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Mobile header */}
        <header className="lg:hidden h-16 glass-strong border-b border-white/20 flex items-center justify-between px-4">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <Bars3Icon className="h-6 w-6 text-white" />
          </button>
          <Logo size="sm" theme="dark" />
          <div className="w-10" /> {/* Spacer for centering */}
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;

