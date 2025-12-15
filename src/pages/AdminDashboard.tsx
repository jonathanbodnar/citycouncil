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
      <div className="p-3 sm:p-4 md:p-6 lg:p-8">
        {/* Management Content - Tab controlled by URL params */}
        <AdminManagementTabs activeTab={activeTab} />
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;