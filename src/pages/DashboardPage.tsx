import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import UserDashboard from '../components/UserDashboard';
import TalentDashboard from '../components/TalentDashboard';

const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('🔍 DashboardPage mounted, user:', user?.email, 'type:', user?.user_type);
  }, [user]);

  if (!user) {
    console.log('🔍 DashboardPage: No user, returning null');
    return null;
  }

  // Debug: Log which dashboard we're rendering
  console.log('🔍 DashboardPage: Rendering', user.user_type === 'talent' ? 'TalentDashboard' : 'UserDashboard');

  try {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {user.user_type === 'talent' ? (
          <TalentDashboard />
        ) : (
          <UserDashboard />
        )}
      </div>
    );
  } catch (err: any) {
    console.error('🔴 DashboardPage render error:', err);
    return (
      <div className="max-w-7xl mx-auto px-4 py-8 text-center">
        <h1 className="text-2xl text-red-500">Dashboard Error</h1>
        <p className="text-gray-400 mt-2">{err?.message || 'Unknown error'}</p>
        <pre className="mt-4 text-left bg-gray-900 p-4 rounded text-xs overflow-auto">
          {err?.stack}
        </pre>
      </div>
    );
  }
};

export default DashboardPage;
