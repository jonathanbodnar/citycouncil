import React, { useState, useEffect } from 'react';
import { 
  UsersIcon,
  Cog6ToothIcon,
  ChatBubbleLeftRightIcon,
  ChartBarIcon,
  CurrencyDollarIcon,
  StarIcon
} from '@heroicons/react/24/outline';
import { supabase } from '../services/supabase';
import { HelpMessage, AdminStats } from '../types';
import TalentManagement from './TalentManagement';
import PlatformSettings from './PlatformSettings';
import toast from 'react-hot-toast';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  color?: string;
}

const StatsCard: React.FC<StatsCardProps> = ({ 
  title, 
  value, 
  icon: Icon, 
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
      </div>
    </div>
  </div>
);

const AdminManagementTabs: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'analytics' | 'talent' | 'settings' | 'helpdesk'>('analytics');
  const [helpMessages, setHelpMessages] = useState<HelpMessage[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [topTalent, setTopTalent] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    try {
      if (activeTab === 'analytics') {
        // Fetch analytics data
        const [
          { data: orders },
          { data: users },
          { data: talent }
        ] = await Promise.all([
          supabase.from('orders').select('*'),
          supabase.from('users').select('*'),
          supabase.from('talent_profiles').select(`
            *,
            users!talent_profiles_user_id_fkey (full_name, avatar_url)
          `)
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

      } else if (activeTab === 'helpdesk') {
        const { data, error } = await supabase
          .from('help_messages')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        setHelpMessages(data || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="mt-8">
      {/* Tab Navigation */}
      <div className="mb-8">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {[
              { key: 'analytics', label: 'Analytics', icon: ChartBarIcon },
              { key: 'talent', label: 'Manage Talent', icon: UsersIcon },
              { key: 'settings', label: 'Platform Settings', icon: Cog6ToothIcon },
              { key: 'helpdesk', label: 'Help Desk', icon: ChatBubbleLeftRightIcon },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                  activeTab === tab.key
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <div className="space-y-8">
          {/* Stats Grid */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
                icon={UsersIcon}
                color="text-indigo-600"
              />
              <StatsCard
                title="Avg Orders/Talent"
                value={stats.avg_orders_per_talent.toFixed(1)}
                icon={ChartBarIcon}
                color="text-pink-600"
              />
              <StatsCard
                title="Amount Refunded"
                value={`$${stats.amount_refunded.toLocaleString()}`}
                icon={CurrencyDollarIcon}
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
                  {recentOrders.slice(0, 5).map((order) => (
                    <div key={order.id} className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">
                          {order.users?.full_name || 'Unknown User'}
                        </p>
                        <p className="text-sm text-gray-600">
                          → {order.talent_profiles?.users?.full_name || 'Unknown Talent'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(order.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-900">${order.amount}</p>
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          order.status === 'completed' ? 'bg-green-100 text-green-800' :
                          order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          order.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {order.status}
                        </span>
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
                  {topTalent.map((talent) => (
                    <div key={talent.id} className="flex items-center space-x-4">
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                          {(talent.users?.avatar_url || talent.temp_avatar_url) ? (
                            <img
                              src={talent.users?.avatar_url || talent.temp_avatar_url}
                              alt={talent.users?.full_name || talent.temp_full_name}
                              className="w-full h-full rounded-full object-cover"
                            />
                          ) : (
                            <span className="text-primary-600 font-medium">
                              {(talent.users?.full_name || talent.temp_full_name || 'T').charAt(0)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900">
                          {talent.users?.full_name || talent.temp_full_name || 'Pending Setup'}
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
                          {(talent.average_rating || 0).toFixed(1)} ⭐
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Talent Management Tab */}
      {activeTab === 'talent' && (
        <TalentManagement />
      )}

      {/* Platform Settings Tab */}
      {activeTab === 'settings' && (
        <PlatformSettings />
      )}

      {/* Help Desk Tab */}
      {activeTab === 'helpdesk' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Help Desk</h2>
            <p className="text-sm text-gray-600">Manage customer support and help requests</p>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {helpMessages.map((message) => (
                <div key={message.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-medium text-gray-900">Support Request</h3>
                      <p className="text-sm text-gray-600">
                        {new Date(message.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex space-x-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        message.is_resolved 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {message.is_resolved ? 'Resolved' : 'Open'}
                      </span>
                      {message.is_human_takeover && (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          Human Takeover
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 p-3 rounded-md mb-3">
                    <p className="text-gray-700">{message.message}</p>
                  </div>

                  {message.response && (
                    <div className="bg-blue-50 p-3 rounded-md mb-3">
                      <p className="text-blue-900 font-medium">Response:</p>
                      <p className="text-blue-800">{message.response}</p>
                    </div>
                  )}

                  <div className="flex space-x-2">
                    {!message.is_resolved && (
                      <>
                        <button className="bg-primary-600 text-white px-3 py-1 rounded-md text-sm hover:bg-primary-700">
                          Respond
                        </button>
                        <button className="bg-green-600 text-white px-3 py-1 rounded-md text-sm hover:bg-green-700">
                          Mark Resolved
                        </button>
                        <button className="bg-red-600 text-white px-3 py-1 rounded-md text-sm hover:bg-red-700">
                          Human Takeover
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}

              {helpMessages.length === 0 && (
                <div className="text-center py-12">
                  <ChatBubbleLeftRightIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No help requests</h3>
                  <p className="text-gray-600">Customer support requests will appear here</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminManagementTabs;
