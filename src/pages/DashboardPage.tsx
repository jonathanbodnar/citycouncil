import React from 'react';
import { useAuth } from '../context/AuthContext';

const DashboardPage: React.FC = () => {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          {user.user_type === 'talent' ? 'Talent Dashboard' : 'My Dashboard'}
        </h1>
        <p className="text-gray-600">
          Welcome back, {user.full_name}!
        </p>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-gray-600">
          Dashboard content coming soon...
        </p>
        <p className="text-sm text-gray-500 mt-2">
          User Type: {user.user_type}
        </p>
      </div>
    </div>
  );
};

export default DashboardPage;
