import React from 'react';
import AdminManagementTabs from '../components/AdminManagementTabs';

const AdminDashboard: React.FC = () => {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-4">
        <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-600">Platform overview and management</p>
      </div>

      {/* Management Tabs - Now at top with Analytics first */}
      <AdminManagementTabs />
    </div>
  );
};

export default AdminDashboard;