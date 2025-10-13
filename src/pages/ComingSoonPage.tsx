import React from 'react';
import { Link } from 'react-router-dom';
import { 
  PlayIcon, 
  StarIcon, 
  HeartIcon,
  ArrowRightIcon 
} from '@heroicons/react/24/solid';
import Logo from '../components/Logo';

const ComingSoonPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="px-4 py-6">
        <div className="max-w-7xl mx-auto">
          {/* Empty header for spacing */}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4">
        <div className="max-w-4xl mx-auto text-center">
          {/* Hero Section */}
          <div className="mb-12">
            <div className="mb-8 flex justify-center">
              <Logo size="lg" />
            </div>
            <h1 className="text-5xl md:text-7xl font-bold text-gray-600 mb-6 leading-tight">
              Coming Soon
            </h1>
            <p className="text-xl md:text-2xl text-gray-600 mb-8 max-w-3xl mx-auto leading-relaxed">
              Get personalized video messages from your favorite conservative voices, 
              politicians, and media personalities. The ultimate platform for 
              authentic connections is launching soon.
            </p>
          </div>

          {/* Features Preview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            <div className="bg-blue-600 rounded-lg p-6 shadow-lg">
              <PlayIcon className="h-12 w-12 text-white mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">
                Personal Videos
              </h3>
              <p className="text-blue-100">
                Custom video messages for birthdays, celebrations, and special occasions
              </p>
            </div>
            
            <div className="bg-blue-600 rounded-lg p-6 shadow-lg">
              <StarIcon className="h-12 w-12 text-white mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">
                Verified Talent
              </h3>
              <p className="text-blue-100">
                Authentic personalities including politicians, hosts, and commentators
              </p>
            </div>
            
            <div className="bg-blue-600 rounded-lg p-6 shadow-lg">
              <HeartIcon className="h-12 w-12 text-white mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">
                Support Causes
              </h3>
              <p className="text-blue-100">
                Every purchase supports conservative causes and charities
              </p>
            </div>
          </div>

          {/* CTA Section */}
          <div className="bg-gray-50 rounded-xl p-8 border border-gray-200 mb-8 shadow-sm">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Be the First to Know
            </h2>
            <p className="text-gray-600 mb-6 text-lg">
              Join our exclusive early access list and get notified when ShoutOut launches.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <input
                type="email"
                placeholder="Enter your email address"
                className="px-6 py-3 rounded-lg bg-white text-gray-900 placeholder-gray-500 border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none w-full sm:w-auto sm:min-w-80"
              />
              <button className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-semibold transition-colors flex items-center gap-2 w-full sm:w-auto">
                Get Early Access
                <ArrowRightIcon className="h-5 w-5" />
              </button>
            </div>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="px-4 py-6 border-t border-gray-200">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row justify-between items-center text-gray-600">
            <p>&copy; 2024 ShoutOut. All rights reserved.</p>
            <div className="flex gap-6 mt-4 sm:mt-0">
              <Link to="/privacy-policy" className="hover:text-gray-900 transition-colors">
                Privacy Policy
              </Link>
              <Link to="/terms-of-service" className="hover:text-gray-900 transition-colors">
                Terms of Service
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default ComingSoonPage;
