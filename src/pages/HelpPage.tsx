import React from 'react';
import HelpDesk from '../components/HelpDesk';

const HelpPage: React.FC = () => {
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Help & Support</h1>
        <p className="text-gray-600">Get instant help or chat with our support team</p>
      </div>

      <HelpDesk />
    </div>
  );
};

export default HelpPage;
