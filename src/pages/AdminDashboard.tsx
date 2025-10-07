import React, { useState, useEffect } from 'react';
import { 
  UsersIcon, 
  CurrencyDollarIcon, 
  ChartBarIcon, 
  StarIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { AdminStats } from '../types';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  trend?: string;
  color?: string;
}

const StatsCard: React.FC<StatsCardProps> = ({ 
  title, 
  value, 
  icon: Icon, 
  trend, 
  color = 'text-primary-600' 
}) => (
  <div className="bg-white rounded-lg shadow-sm p-6">
    <div className="flex items-center">
      <div className={`p-3 rounded-lg bg-gray-100`}>
        <Icon className={`h-6 w-6 ${color}`} />
      </div>
      <div className="ml-4">
        <p className="text-sm font-medium text-gray-600">{title}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        {trend && (
          <p className="text-sm text-green-600">{trend}</p>
        )}
      </div>
    </div>
  </div>
);

const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [topTalent, setTopTalent] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.user_type === 'admin') {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      // Fetch stats
      const [
        { data: orders },
        { data: users },
        { data: talent }
      ] = await Promise.all([
        supabase.from('orders').select('*'),
        supabase.from('users').select('*'),
        supabase.from('talent_profiles').select('*')
      ]);

      // Calculate stats
      const totalOrders = orders?.length || 0;
      const grossGenerated = orders?.reduce((sum, order) => sum + order.amount, 0) || 0;
      const grossEarnings = orders?.reduce((sum, order) => sum + order.admin_fee, 0) || 0;
      const refundedOrders = orders?.filter(o => o.status === 'refunded') || [];
      const amountRefunded = refundedOrders.reduce((sum, order) => sum + order.amount, 0);
      const totalUsers = users?.filter(u => u.user_type === 'user').length || 0;
      const usersWithOrders = new Set(orders?.map(o => o.user_id)).size;
      const totalTalent = talent?.length || 0;
      const avgOrdersPerTalent = totalTalent > 0 ? totalOrders / totalTalent : 0;
      const avgOrdersPerUser = totalUsers > 0 ? totalOrders / totalUsers : 0;

      setStats({
        total_orders: totalOrders,
        gross_generated: grossGenerated,
        gross_earnings: grossEarnings,
        amount_refunded: amountRefunded,
        total_users: totalUsers,
        total_users_with_orders: usersWithOrders,
        total_talent: totalTalent,
        avg_orders_per_talent: avgOrdersPerTalent,
        avg_orders_per_user: avgOrdersPerUser
      });

      // Fetch recent orders
      const { data: recentOrdersData } = await supabase
        .from('orders')
        .select(`
          *,
          users!orders_user_id_fkey (full_name),
          talent_profiles!orders_talent_id_fkey (
            users!talent_profiles_user_id_fkey (full_name)
          )
        `)
        .order('created_at', { ascending: false })
        .limit(10);

      setRecentOrders(recentOrdersData || []);

      // Fetch top talent
      const { data: topTalentData } = await supabase
        .from('talent_profiles')
        .select(`
          *,
          users!talent_profiles_user_id_fkey (full_name, avatar_url)
        `)
        .order('total_orders', { ascending: false })
        .limit(5);

      setTopTalent(topTalentData || []);

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!user || user.user_type !== 'admin') {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Access Denied</h1>
          <p className="text-gray-600">You don't have permission to view this page.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-600">
          Platform overview and management
        </p>
      </div>

      {/* Stats Grid */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatsCard
            title="Total Orders"
            value={stats.total_orders.toLocaleString()}
            icon={ChartBarIcon}
            color="text-blue-600"
          />
          <StatsCard
            title="Gross Revenue"
            value={`$${stats.gross_generated.toLocaleString()}`}
            icon={CurrencyDollarIcon}
            color="text-green-600"
          />
          <StatsCard
            title="Platform Earnings"
            value={`$${stats.gross_earnings.toLocaleString()}`}
            icon={CurrencyDollarIcon}
            color="text-purple-600"
          />
          <StatsCard
            title="Total Users"
            value={stats.total_users.toLocaleString()}
            icon={UsersIcon}
            color="text-orange-600"
          />
          <StatsCard
            title="Active Talent"
            value={stats.total_talent.toLocaleString()}
            icon={StarIcon}
            color="text-yellow-600"
          />
          <StatsCard
            title="Users with Orders"
            value={stats.total_users_with_orders.toLocaleString()}
            icon={CheckCircleIcon}
            color="text-green-600"
          />
          <StatsCard
            title="Avg Orders/Talent"
            value={stats.avg_orders_per_talent.toFixed(1)}
            icon={ChartBarIcon}
            color="text-indigo-600"
          />
          <StatsCard
            title="Amount Refunded"
            value={`$${stats.amount_refunded.toLocaleString()}`}
            icon={ExclamationTriangleIcon}
            color="text-red-600"
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Orders */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Recent Orders</h2>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {recentOrders.map((order) => (
                <div key={order.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <div className="font-medium text-gray-900">
                      {order.users.full_name}
                    </div>
                    <div className="text-sm text-gray-600">
                      → {order.talent_profiles.users.full_name}
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(order.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-gray-900">
                      ${order.amount.toFixed(2)}
                    </div>
                    <div className={`text-xs px-2 py-1 rounded-full ${
                      order.status === 'completed' ? 'bg-green-100 text-green-800' :
                      order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      order.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                      order.status === 'cancelled' ? 'bg-gray-100 text-gray-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {order.status}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Top Talent */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Top Talent</h2>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {topTalent.map((talent, index) => (
                <div key={talent.id} className="flex items-center space-x-4">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                      {talent.users.avatar_url ? (
                        <img
                          src={talent.users.avatar_url}
                          alt={talent.users.full_name}
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        <span className="text-primary-600 font-medium">
                          {talent.users.full_name.charAt(0)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900">
                      {talent.users.full_name}
                    </div>
                    <div className="text-sm text-gray-600">
                      ${talent.pricing} • {talent.category}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-gray-900">
                      {talent.total_orders} orders
                    </div>
                    <div className="text-sm text-gray-600">
                      {talent.average_rating.toFixed(1)} ⭐
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-8 bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 text-left">
            <div className="font-medium text-gray-900">Manage Talent</div>
            <div className="text-sm text-gray-600">Review and approve talent profiles</div>
          </button>
          <button className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 text-left">
            <div className="font-medium text-gray-900">Platform Settings</div>
            <div className="text-sm text-gray-600">Configure fees and global settings</div>
          </button>
          <button className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 text-left">
            <div className="font-medium text-gray-900">Help Desk</div>
            <div className="text-sm text-gray-600">Manage customer support tickets</div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
