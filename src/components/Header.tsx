import React, { Fragment } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, Transition } from '@headlessui/react';
import { 
  UserCircleIcon, 
  Cog6ToothIcon, 
  ArrowRightOnRectangleIcon,
  BellIcon 
} from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
import Logo from './Logo';

const Header: React.FC = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

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
            <Logo size="md" />
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
                <button className="p-2 text-gray-400 hover:text-gray-600 relative">
                  <BellIcon className="h-6 w-6" />
                  <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-400"></span>
                </button>

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
                    <Menu.Items className="absolute right-0 mt-2 w-48 origin-top-right glass-strong rounded-2xl shadow-modern-xl ring-1 ring-white/20 focus:outline-none z-[9999]" style={{ background: 'rgba(255, 255, 255, 0.15)', backdropFilter: 'blur(25px)' }}>
                      <div className="py-1">
                        <Menu.Item>
                          {({ active }) => (
                            <Link
                              to="/dashboard"
                              className={`${
                                active ? 'bg-white/10' : ''
                              } flex items-center px-4 py-2 text-sm text-white hover:bg-white/10 transition-colors`}
                            >
                              <UserCircleIcon className="mr-3 h-5 w-5" />
                              Profile
                            </Link>
                          )}
                        </Menu.Item>
                        <Menu.Item>
                          {({ active }) => (
                            <button
                              className={`${
                                active ? 'bg-gray-100' : ''
                              } flex items-center w-full px-4 py-2 text-sm text-gray-700`}
                            >
                              <Cog6ToothIcon className="mr-3 h-5 w-5" />
                              Settings
                            </button>
                          )}
                        </Menu.Item>
                        <Menu.Item>
                          {({ active }) => (
                            <button
                              onClick={handleSignOut}
                              className={`${
                                active ? 'bg-gray-100' : ''
                              } flex items-center w-full px-4 py-2 text-sm text-gray-700`}
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
