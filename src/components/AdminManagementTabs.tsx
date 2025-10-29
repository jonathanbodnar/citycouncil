import React, { useState, useEffect } from 'react';
import { 
  UsersIcon,
  Cog6ToothIcon,
  ChatBubbleLeftRightIcon,
  ChartBarIcon,
  CurrencyDollarIcon,
  StarIcon,
  ClockIcon,
  VideoCameraIcon,
  HashtagIcon
} from '@heroicons/react/24/outline';
import { supabase } from '../services/supabase';
import { HelpMessage, AdminStats } from '../types';
import TalentManagement from './TalentManagement';
import PlatformSettings from './PlatformSettings';
import AdminHelpDesk from './AdminHelpDesk';
import PromotionalVideosManagement from './PromotionalVideosManagement';
import LandingPromoVideos from './LandingPromoVideos';
import SocialMediaTracking from './SocialMediaTracking';
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
  color = 'text-blue-600' 
}) => (
  <div className="glass rounded-2xl p-6 hover:glass-strong transition-all duration-300 shadow-modern hover:shadow-modern-lg group">
    <div className="flex items-center">
      <div className={`p-3 rounded-xl bg-gradient-to-br from-white/80 to-white/40 border border-white/30 group-hover:scale-110 transition-transform duration-300`}>
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
  const [activeTab, setActiveTab] = useState<'analytics' | 'talent' | 'settings' | 'helpdesk' | 'promo-videos' | 'landing-videos' | 'social-tracking'>('analytics');
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

        // Calculate comprehensive stats
        const totalOrders = orders?.length || 0;
        const completedOrders = orders?.filter(o => o.status === 'completed') || [];
        const pendingOrders = orders?.filter(o => o.status === 'pending') || [];
        const inProgressOrders = orders?.filter(o => o.status === 'in_progress') || [];
        const corporateOrders = orders?.filter(o => o.is_corporate_order) || [];
        const pendingApprovalOrders = orders?.filter(o => o.approval_status === 'pending') || [];
        
        const grossGenerated = orders?.reduce((sum, order) => sum + order.amount, 0) || 0;
        const grossEarnings = orders?.reduce((sum, order) => sum + order.admin_fee, 0) || 0;
        const refundedOrders = orders?.filter(o => o.status === 'refunded') || [];
        const amountRefunded = refundedOrders.reduce((sum, order) => sum + order.amount, 0);
        
        const totalUsers = users?.filter(u => u.user_type === 'user').length || 0;
        const activeTalent = talent?.filter(t => t.is_active).length || 0;
        const verifiedTalent = talent?.filter(t => t.is_verified).length || 0;
        const promotionParticipants = talent?.filter(t => t.is_participating_in_promotion).length || 0;
        const usersWithOrders = new Set(orders?.map(o => o.user_id)).size;
        const totalTalent = talent?.length || 0;
        const avgOrdersPerTalent = totalTalent > 0 ? totalOrders / totalTalent : 0;
        const avgOrdersPerUser = totalUsers > 0 ? totalOrders / totalUsers : 0;
        
        // Calculate completion rate
        const completionRate = totalOrders > 0 ? (completedOrders.length / totalOrders) * 100 : 0;

        // Calculate average delivery time for completed orders with videos
        let avgDeliveryTimeHours = 0;
        
        if (completedOrders.length > 0) {
          const deliveryTimes = completedOrders
            .map(order => {
              const createdAt = new Date(order.created_at);
              const approvedAt = order.approved_at ? new Date(order.approved_at) : createdAt;
              const completedAt = new Date(order.updated_at); // Assuming updated_at reflects completion
              
              // Calculate hours from approval/creation to completion
              return (completedAt.getTime() - approvedAt.getTime()) / (1000 * 60 * 60);
            })
            .filter(time => time > 0); // Filter out invalid times
            
          avgDeliveryTimeHours = deliveryTimes.length > 0 
            ? deliveryTimes.reduce((sum, time) => sum + time, 0) / deliveryTimes.length 
            : 0;
        }

        setStats({
          total_orders: totalOrders,
          completed_orders: completedOrders.length,
          pending_orders: pendingOrders.length,
          corporate_orders: corporateOrders.length,
          pending_approval_orders: pendingApprovalOrders.length,
          completion_rate: completionRate,
          gross_generated: grossGenerated,
          gross_earnings: grossEarnings,
          amount_refunded: amountRefunded,
          total_users: totalUsers,
          total_users_with_orders: usersWithOrders,
          total_talent: totalTalent,
          active_talent: activeTalent,
          verified_talent: verifiedTalent,
          promotion_participants: promotionParticipants,
          avg_orders_per_talent: avgOrdersPerTalent,
          avg_orders_per_user: avgOrdersPerUser,
          avg_delivery_time_hours: avgDeliveryTimeHours
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

        // Fetch top talent with delivery time calculations
        const { data: topTalentData } = await supabase
          .from('talent_profiles')
          .select(`
            *,
            users!talent_profiles_user_id_fkey (full_name, avatar_url)
          `)
          .order('total_orders', { ascending: false })
          .limit(5);

        // Calculate individual delivery times for each talent
        const topTalentWithStats = await Promise.all(
          (topTalentData || []).map(async (talent) => {
            const { data: talentOrders } = await supabase
              .from('orders')
              .select('created_at, updated_at, approved_at, status')
              .eq('talent_id', talent.id)
              .eq('status', 'completed');

            let avgDeliveryTime = 0;
            if (talentOrders && talentOrders.length > 0) {
              const deliveryTimes = talentOrders
                .map(order => {
                  const createdAt = new Date(order.created_at);
                  const approvedAt = order.approved_at ? new Date(order.approved_at) : createdAt;
                  const completedAt = new Date(order.updated_at);
                  return (completedAt.getTime() - approvedAt.getTime()) / (1000 * 60 * 60);
                })
                .filter(time => time > 0);
                
              avgDeliveryTime = deliveryTimes.length > 0 
                ? deliveryTimes.reduce((sum, time) => sum + time, 0) / deliveryTimes.length 
                : 0;
            }

            return {
              ...talent,
              avg_delivery_time_hours: avgDeliveryTime
            };
          })
        );

        setTopTalent(topTalentWithStats);

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
          <nav className="-mb-px flex space-x-8 overflow-x-auto">
            {[
              { key: 'analytics', label: 'Analytics', icon: ChartBarIcon },
              { key: 'talent', label: 'Manage Talent', icon: UsersIcon },
              { key: 'promo-videos', label: 'Promo Videos', icon: VideoCameraIcon },
              { key: 'landing-videos', label: 'Landing Videos', icon: StarIcon },
              { key: 'social-tracking', label: 'Social Tracking', icon: HashtagIcon },
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
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
                title="Completed Orders"
                value={stats.completed_orders.toLocaleString()}
                icon={StarIcon}
                color="text-green-600"
              />
              <StatsCard
                title="Pending Orders"
                value={stats.pending_orders.toLocaleString()}
                icon={ClockIcon}
                color="text-yellow-600"
              />
              <StatsCard
                title="Corporate Orders"
                value={stats.corporate_orders.toLocaleString()}
                icon={ChartBarIcon}
                color="text-blue-600"
              />
              <StatsCard
                title="Completion Rate"
                value={`${stats.completion_rate.toFixed(1)}%`}
                icon={ChartBarIcon}
                color="text-emerald-600"
              />
              <StatsCard
                title="Active Talent"
                value={`${stats.active_talent}/${stats.total_talent}`}
                icon={StarIcon}
                color="text-orange-600"
              />
              <StatsCard
                title="Verified Talent"
                value={stats.verified_talent.toLocaleString()}
                icon={UsersIcon}
                color="text-indigo-600"
              />
              <StatsCard
                title="Promotion Program"
                value={stats.promotion_participants.toLocaleString()}
                icon={StarIcon}
                color="text-purple-600"
              />
              <StatsCard
                title="Amount Refunded"
                value={`$${stats.amount_refunded.toLocaleString()}`}
                icon={CurrencyDollarIcon}
                color="text-red-600"
              />
              <StatsCard
                title="Avg Delivery Time"
                value={`${stats.avg_delivery_time_hours.toFixed(1)}h`}
                icon={ClockIcon}
                color="text-teal-600"
              />
              {stats.pending_approval_orders > 0 && (
                <StatsCard
                  title="Pending Approval"
                  value={stats.pending_approval_orders.toLocaleString()}
                  icon={ClockIcon}
                  color="text-orange-600"
                />
              )}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Recent Orders */}
            <div className="glass rounded-2xl shadow-modern">
              <div className="p-6 border-b border-white/20">
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
            <div className="glass rounded-2xl shadow-modern">
              <div className="p-6 border-b border-white/20">
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
                        <div className="text-sm text-gray-600 space-y-1">
                          <div>{(talent.average_rating || 0).toFixed(1)} ⭐</div>
                          <div className="flex items-center justify-end gap-1">
                            <ClockIcon className="h-3 w-3" />
                            {talent.avg_delivery_time_hours 
                              ? `${talent.avg_delivery_time_hours.toFixed(1)}h avg`
                              : 'No data'
                            }
                          </div>
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
        <AdminHelpDesk />
      )}

      {/* Promotional Videos Tab */}
      {activeTab === 'promo-videos' && (
        <PromotionalVideosManagement />
      )}

      {/* Landing Page Videos Tab */}
      {activeTab === 'landing-videos' && (
        <LandingPromoVideos />
      )}

      {/* Social Media Tracking Tab */}
      {activeTab === 'social-tracking' && (
        <SocialMediaTracking />
      )}

    </div>
  );
};

export default AdminManagementTabs;
