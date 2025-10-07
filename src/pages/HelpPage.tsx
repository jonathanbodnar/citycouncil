import React from 'react';
import HelpDesk from '../components/HelpDesk';

const HelpPage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Help & Support</h1>
        <p className="text-gray-600">Get instant help or chat with our support team</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <HelpDesk />
        </div>

        <div className="space-y-6">
          {/* FAQ Section */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Frequently Asked</h3>
            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-gray-900 mb-1">How long does delivery take?</h4>
                <p className="text-sm text-gray-600">Most ShoutOuts are delivered within 24-48 hours. Each talent sets their own fulfillment time.</p>
              </div>
              <div>
                <h4 className="font-medium text-gray-900 mb-1">What if I'm not satisfied?</h4>
                <p className="text-sm text-gray-600">We offer a 100% money-back guarantee. If you're not happy, we'll refund you completely.</p>
              </div>
              <div>
                <h4 className="font-medium text-gray-900 mb-1">Can I cancel my order?</h4>
                <p className="text-sm text-gray-600">Yes, you can cancel orders that haven't been fulfilled by the deadline for a full refund.</p>
              </div>
              <div>
                <h4 className="font-medium text-gray-900 mb-1">How do I share my video?</h4>
                <p className="text-sm text-gray-600">Once delivered, you can share your ShoutOut on social media directly from your dashboard.</p>
              </div>
            </div>
          </div>

          {/* Contact Options */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Other Ways to Reach Us</h3>
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 text-sm">📧</span>
                </div>
                <div>
                  <p className="font-medium text-gray-900">Email</p>
                  <p className="text-sm text-gray-600">support@shoutout.com</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <span className="text-green-600 text-sm">💬</span>
                </div>
                <div>
                  <p className="font-medium text-gray-900">Live Chat</p>
                  <p className="text-sm text-gray-600">Available 24/7</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                  <span className="text-purple-600 text-sm">📱</span>
                </div>
                <div>
                  <p className="font-medium text-gray-900">Response Time</p>
                  <p className="text-sm text-gray-600">Usually within 1 hour</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HelpPage;
