import React from 'react';
import {
  ChevronLeftIcon,
  UserCircleIcon,
  ArrowRightOnRectangleIcon,
  Cog6ToothIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

interface ProfilePanelProps {
  onBack: () => void;
}

const ProfilePanel: React.FC<ProfilePanelProps> = ({ onBack }) => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success('Signed out successfully');
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
      toast.error('Failed to sign out');
    }
  };

  return (
    <div 
      className="h-full overflow-y-auto"
      style={{
        background: 'linear-gradient(to bottom right, #a70809, #3c108b)'
      }}
    >
      {/* Header */}
      <div className="sticky top-0 z-10 bg-black/40 backdrop-blur-md border-b border-white/10">
        <div className="flex items-center justify-between p-4">
          <button
            onClick={onBack}
            className="text-white p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <ChevronLeftIcon className="w-6 h-6" />
          </button>
          <h1 className="text-white text-xl font-bold">Profile</h1>
          <div className="w-10"></div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {!user ? (
          <div className="text-center py-12">
            <UserCircleIcon className="w-24 h-24 text-white/40 mx-auto mb-4" />
            <div className="text-white/60 mb-6">
              Sign in to view your profile
            </div>
            <div className="space-y-3">
              <a
                href="/login"
                className="block bg-blue-600 text-white px-6 py-3 rounded-full font-bold hover:bg-blue-700 transition-colors"
              >
                Sign In
              </a>
              <a
                href="/signup"
                className="block bg-white/10 text-white px-6 py-3 rounded-full font-bold hover:bg-white/20 transition-colors"
              >
                Create Account
              </a>
            </div>
          </div>
        ) : (
          <div>
            {/* Profile header */}
            <div className="text-center mb-8">
              <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-red-500 rounded-full mx-auto mb-4 flex items-center justify-center">
                {user.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={user.full_name}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <span className="text-3xl font-bold text-white">
                    {user.full_name?.charAt(0) || user.email.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <h2 className="text-white text-2xl font-bold mb-1">
                {user.full_name || 'User'}
              </h2>
              <p className="text-white/60">{user.email}</p>
            </div>

            {/* Menu items */}
            <div className="space-y-3">
              <a
                href="/dashboard"
                className="flex items-center gap-3 p-4 glass rounded-xl hover:bg-white/10 transition-colors"
              >
                <Cog6ToothIcon className="w-6 h-6 text-white" />
                <div className="flex-1">
                  <div className="text-white font-medium">Full Dashboard</div>
                  <div className="text-white/60 text-sm">
                    View all features
                  </div>
                </div>
              </a>

              <a
                href="/notifications"
                className="flex items-center gap-3 p-4 glass rounded-xl hover:bg-white/10 transition-colors"
              >
                <svg
                  className="w-6 h-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                  />
                </svg>
                <div className="flex-1">
                  <div className="text-white font-medium">Notifications</div>
                  <div className="text-white/60 text-sm">
                    Manage your alerts
                  </div>
                </div>
              </a>

              <a
                href="/help"
                className="flex items-center gap-3 p-4 glass rounded-xl hover:bg-white/10 transition-colors"
              >
                <svg
                  className="w-6 h-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div className="flex-1">
                  <div className="text-white font-medium">Help & Support</div>
                  <div className="text-white/60 text-sm">Get assistance</div>
                </div>
              </a>

              <button
                onClick={handleSignOut}
                className="flex items-center gap-3 p-4 glass rounded-xl hover:bg-red-500/20 transition-colors w-full text-left"
              >
                <ArrowRightOnRectangleIcon className="w-6 h-6 text-red-400" />
                <div className="flex-1">
                  <div className="text-red-400 font-medium">Sign Out</div>
                  <div className="text-white/60 text-sm">
                    Log out of your account
                  </div>
                </div>
              </button>
            </div>

            {/* App info */}
            <div className="mt-8 text-center text-white/40 text-sm">
              <div>ShoutOut v1.0</div>
              <div className="mt-2">
                <a href="/privacy-policy" className="hover:text-white/60">
                  Privacy
                </a>
                {' • '}
                <a href="/terms-of-service" className="hover:text-white/60">
                  Terms
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfilePanel;

