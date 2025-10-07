import React from 'react';
import NotificationCenter from '../components/NotificationCenter';

const NotificationsPage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Notifications</h1>
        <p className="text-gray-600">Stay updated with your ShoutOut activity</p>
      </div>
      
      <NotificationCenter />
    </div>
  );
};

export default NotificationsPage;
