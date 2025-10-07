import React from 'react';
import { useAuth } from '../context/AuthContext';
import UserDashboard from '../components/UserDashboard';
import TalentDashboard from '../components/TalentDashboard';

const DashboardPage: React.FC = () => {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {user.user_type === 'talent' ? (
        <TalentDashboard />
      ) : (
        <UserDashboard />
      )}
    </div>
  );
};

export default DashboardPage;
