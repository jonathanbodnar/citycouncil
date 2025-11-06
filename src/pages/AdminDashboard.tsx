import React from 'react';
import { useLocation } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import AdminManagementTabs from '../components/AdminManagementTabs';

const AdminDashboard: React.FC = () => {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const activeTab = searchParams.get('tab') || 'analytics';

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
          <p className="text-gray-300">Platform overview and management</p>
        </div>

        {/* Management Content - Tab controlled by URL params */}
        <AdminManagementTabs activeTab={activeTab} />
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;