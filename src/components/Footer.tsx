import React from 'react';
import { Link } from 'react-router-dom';
import Logo from './Logo';

const Footer: React.FC = () => {
  return (
    <footer className="bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Logo and Description */}
          <div className="md:col-span-2">
            <div className="mb-4">
              <Logo size="md" className="filter brightness-0 invert" />
            </div>
            <p className="text-gray-400 mb-4 max-w-md">
              Get personalized video messages from your favorite conservative personalities. 
              100% money-back guarantee and secure payments.
            </p>
            <div className="flex space-x-4">
              <a href="#" className="text-gray-400 hover:text-white">
                <span className="sr-only">Facebook</span>
                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z"/>
                </svg>
              </a>
              <a href="#" className="text-gray-400 hover:text-white">
                <span className="sr-only">Twitter</span>
                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84"/>
                </svg>
              </a>
              <a href="#" className="text-gray-400 hover:text-white">
                <span className="sr-only">Instagram</span>
                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 6.624 5.367 11.99 11.988 11.99s11.99-5.366 11.99-11.99C24.007 5.367 18.641.001 12.017.001zM8.449 16.988c-1.297 0-2.448-.49-3.32-1.297C4.198 14.553 3.5 13.297 3.5 11.987s.698-2.566 1.629-3.704c.872-.808 2.023-1.297 3.32-1.297s2.448.49 3.32 1.297c.931 1.138 1.629 2.394 1.629 3.704s-.698 2.566-1.629 3.704c-.872.808-2.023 1.297-3.32 1.297zm7.138 0c-1.297 0-2.448-.49-3.32-1.297-.931-1.138-1.629-2.394-1.629-3.704s.698-2.566 1.629-3.704c.872-.808 2.023-1.297 3.32-1.297s2.448.49 3.32 1.297c.931 1.138 1.629 2.394 1.629 3.704s-.698 2.566-1.629 3.704c-.872.808-2.023 1.297-3.32 1.297z"/>
                </svg>
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-sm font-semibold text-gray-300 tracking-wider uppercase mb-4">
              Quick Links
            </h3>
            <ul className="space-y-2">
              <li>
                <Link to="/" className="text-gray-400 hover:text-white">
                  Browse Talent
                </Link>
              </li>
              <li>
                <Link to="/dashboard" className="text-gray-400 hover:text-white">
                  Dashboard
                </Link>
              </li>
              <li>
                <Link to="/help" className="text-gray-400 hover:text-white">
                  Help & Support
                </Link>
              </li>
              <li>
                <a href="mailto:support@shoutout.com" className="text-gray-400 hover:text-white">
                  Contact Us
                </a>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-sm font-semibold text-gray-300 tracking-wider uppercase mb-4">
              Legal
            </h3>
            <ul className="space-y-2">
              <li>
                <Link to="/privacy-policy" className="text-gray-400 hover:text-white">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/terms-of-service" className="text-gray-400 hover:text-white">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link to="/refund-policy" className="text-gray-400 hover:text-white">
                  Refund Policy
                </Link>
              </li>
              <li>
                <Link to="/community-guidelines" className="text-gray-400 hover:text-white">
                  Community Guidelines
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-gray-800 mt-8 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-400 text-sm">
              © 2025 ShoutOut. All rights reserved.
            </p>
            <div className="flex space-x-6 mt-4 md:mt-0">
              <span className="text-gray-400 text-sm">🔒 100% Money-Back Guarantee</span>
              <span className="text-gray-400 text-sm">🛡️ Secure Payments</span>
              <span className="text-gray-400 text-sm">⚡ Fast Delivery</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
