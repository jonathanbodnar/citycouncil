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
  HashtagIcon,
  TagIcon,
  GiftIcon
} from '@heroicons/react/24/outline';
import { supabase } from '../services/supabase';
import { HelpMessage, AdminStats } from '../types';
import TalentManagement from './TalentManagement';
import PlatformSettings from './PlatformSettings';
import AdminHelpDesk from './AdminHelpDesk';
import PromotionalVideosManagement from './PromotionalVideosManagement';
import LandingVideoUpload from './LandingVideoUpload';
import BulkVideoUpload from './BulkVideoUpload';
import OrdersManagement from './admin/OrdersManagement';
import UsersManagement from './admin/UsersManagement';
import CommsCenterManagement from './CommsCenterManagement';
import NotificationSettings from './admin/NotificationSettings';
import CouponManagement from './CouponManagement';
import AdminPayoutsManagement from './AdminPayoutsManagement';
import W9Management from './admin/W9Management';
import CreditsManagement from './admin/CreditsManagement';
import HolidayPromoSignups from './admin/HolidayPromoSignups';
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
  <div className="glass rounded-2xl p-4 sm:p-6 hover:glass-strong transition-all duration-300 shadow-modern hover:shadow-modern-lg group">
    <div className="flex items-center">
      <div className={`p-2 sm:p-3 rounded-xl bg-gradient-to-br from-white/80 to-white/40 border border-white/30 group-hover:scale-110 transition-transform duration-300`}>
        <Icon className={`h-5 w-5 sm:h-6 sm:w-6 ${color}`} />
      </div>
      <div className="ml-3 sm:ml-4 min-w-0 flex-1">
        <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">{title}</p>
        <p className="text-xl sm:text-2xl font-bold text-gray-900 truncate">{value}</p>
      </div>
    </div>
  </div>
);

interface AdminManagementTabsProps {
  activeTab: string;
}

const AdminManagementTabs: React.FC<AdminManagementTabsProps> = ({ activeTab: activeTabProp }) => {
  const activeTab = activeTabProp as 'analytics' | 'orders' | 'users' | 'talent' | 'payouts' | 'w9s' | 'settings' | 'helpdesk' | 'promo-videos' | 'landing-videos' | 'bulk-upload' | 'comms' | 'notifications' | 'coupons' | 'credits' | 'holiday-promo';
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
          { data: talent },
          { data: payouts },
          { count: holidayPromoCount }
        ] = await Promise.all([
          supabase.from('orders').select('*'),
          supabase.from('users').select('*'),
          supabase.from('talent_profiles').select(`
            *,
            users!talent_profiles_user_id_fkey (full_name, avatar_url)
          `),
          supabase.from('payouts').select('*'),
          supabase.from('beta_signups').select('*', { count: 'exact', head: true }).eq('source', 'holiday_popup')
        ]);

        // Calculate comprehensive stats
        const totalOrders = orders?.length || 0;
        const completedOrders = orders?.filter(o => o.status === 'completed') || [];
        const pendingOrders = orders?.filter(o => o.status === 'pending') || [];
        const inProgressOrders = orders?.filter(o => o.status === 'in_progress') || [];
        const corporateOrders = orders?.filter(o => o.is_corporate_order) || [];
        const pendingApprovalOrders = orders?.filter(o => o.approval_status === 'pending') || [];
        
        // Calculate orders for current month
        const now = new Date();
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const ordersThisMonth = orders?.filter(o => {
          const orderDate = new Date(o.created_at);
          return orderDate >= firstDayOfMonth;
        }) || [];
        const ordersThisMonthCount = ordersThisMonth.length;
        
        // Calculate gross revenue (all money collected by platform)
        // orders.amount is in CENTS, so divide by 100
        const grossGenerated = (orders?.reduce((sum, order) => sum + order.amount, 0) || 0) / 100;
        
        // Calculate platform earnings from payouts (admin_fee_amount from non-refunded orders)
        // This correctly accounts for 0% promo fee and refunds
        // payout.admin_fee_amount is already in dollars
        const grossEarnings = payouts
          ?.filter(p => !p.is_refunded)
          .reduce((sum, payout) => sum + (payout.admin_fee_amount || 0), 0) || 0;
        
        const refundedOrders = orders?.filter(o => o.status === 'refunded') || [];
        const amountRefunded = refundedOrders.reduce((sum, order) => sum + order.amount, 0) / 100;
        
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
          orders_this_month: ordersThisMonthCount,
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
          avg_delivery_time_hours: avgDeliveryTimeHours,
          holiday_promo_signups: holidayPromoCount || 0
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
        const { data: allTalentData } = await supabase
          .from('talent_profiles')
          .select(`
            *,
            users!talent_profiles_user_id_fkey (full_name, avatar_url)
          `);

        // Calculate actual order count and stats for each talent
        const topTalentWithStats = await Promise.all(
          (allTalentData || []).map(async (talent) => {
            // Get ALL orders for this talent (not just completed)
            const { data: talentOrders } = await supabase
              .from('orders')
              .select('created_at, updated_at, approved_at, status')
              .eq('talent_id', talent.id);

            // Count total orders (all statuses)
            const actualTotalOrders = talentOrders?.length || 0;

            // Calculate avg delivery time for completed orders only
            const completedOrders = talentOrders?.filter(o => o.status === 'completed') || [];
            let avgDeliveryTime = 0;
            
            if (completedOrders.length > 0) {
              const deliveryTimes = completedOrders
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
              total_orders: actualTotalOrders, // Use real count from orders table
              avg_delivery_time_hours: avgDeliveryTime
            };
          })
        );

        // Sort by actual order count (descending) and take top 5
        const sortedTopTalent = topTalentWithStats
          .sort((a, b) => b.total_orders - a.total_orders)
          .slice(0, 5);

        setTopTalent(sortedTopTalent);

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
    <div>

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <div className="space-y-8">
          {/* Stats Grid */}
          {stats && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
              <StatsCard
                title="Total Orders"
                value={stats.total_orders.toLocaleString()}
                icon={ChartBarIcon}
                color="text-blue-600"
              />
              <StatsCard
                title="Orders This Month"
                value={stats.orders_this_month.toLocaleString()}
                icon={ChartBarIcon}
                color="text-indigo-600"
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
              <StatsCard
                title="🎄 Holiday Promo Signups"
                value={stats.holiday_promo_signups.toLocaleString()}
                icon={GiftIcon}
                color="text-red-600"
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8">
            {/* Recent Orders */}
            <div className="glass rounded-2xl shadow-modern">
              <div className="p-4 sm:p-6 border-b border-white/20">
                <h2 className="text-base sm:text-lg font-semibold text-gray-900">Recent Orders</h2>
              </div>
              <div className="p-4 sm:p-6">
                <div className="space-y-3 sm:space-y-4">
                  {recentOrders.slice(0, 5).map((order) => (
                    <div key={order.id} className="flex items-start sm:items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900 text-sm sm:text-base truncate">
                          {order.users?.full_name || 'Unknown User'}
                        </p>
                        <p className="text-xs sm:text-sm text-gray-600 truncate">
                          → {order.talent_profiles?.users?.full_name || 'Unknown Talent'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(order.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-semibold text-gray-900 text-sm sm:text-base whitespace-nowrap">${(order.amount / 100).toFixed(2)}</p>
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full whitespace-nowrap ${
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
              <div className="p-4 sm:p-6 border-b border-white/20">
                <h2 className="text-base sm:text-lg font-semibold text-gray-900">Top Talent</h2>
              </div>
              <div className="p-4 sm:p-6">
                <div className="space-y-3 sm:space-y-4">
                  {topTalent.map((talent) => (
                    <div key={talent.id} className="flex items-center space-x-3 sm:space-x-4">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-primary-100 flex items-center justify-center">
                          {(talent.users?.avatar_url || talent.temp_avatar_url) ? (
                            <img
                              src={talent.users?.avatar_url || talent.temp_avatar_url}
                              alt={talent.users?.full_name || talent.temp_full_name}
                              className="w-full h-full rounded-full object-cover"
                            />
                          ) : (
                            <span className="text-primary-600 font-medium text-sm">
                              {(talent.users?.full_name || talent.temp_full_name || 'T').charAt(0)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 text-sm sm:text-base truncate">
                          {talent.users?.full_name || talent.temp_full_name || 'Pending Setup'}
                        </div>
                        <div className="text-xs sm:text-sm text-gray-600 truncate">
                          ${talent.pricing} • {talent.category}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="font-semibold text-gray-900 text-sm sm:text-base whitespace-nowrap">
                          {talent.total_orders} orders
                        </div>
                        <div className="text-xs sm:text-sm text-gray-600 space-y-1">
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

      {/* Bulk Video Upload Tab */}
      {activeTab === 'bulk-upload' && (
        <BulkVideoUpload />
      )}

      {/* Promotional Videos Tab */}
      {activeTab === 'promo-videos' && (
        <PromotionalVideosManagement />
      )}

      {/* Landing Page Videos Tab */}
      {activeTab === 'landing-videos' && (
        <LandingVideoUpload />
      )}


      {/* Platform Settings Tab */}
      {activeTab === 'settings' && (
        <PlatformSettings />
      )}

      {/* Orders Management Tab */}
      {activeTab === 'orders' && (
        <OrdersManagement />
      )}

      {/* Help Desk Tab */}
      {activeTab === 'helpdesk' && (
        <AdminHelpDesk />
      )}

      {/* Comms Center Tab */}
      {activeTab === 'comms' && (
        <CommsCenterManagement />
      )}

      {/* Notifications Tab */}
      {activeTab === 'notifications' && (
        <NotificationSettings />
      )}

      {/* Coupons Tab */}
      {activeTab === 'coupons' && (
        <CouponManagement />
      )}

      {/* Credits Tab */}
      {activeTab === 'credits' && (
        <CreditsManagement />
      )}

      {/* Holiday Promo Tab */}
      {activeTab === 'holiday-promo' && (
        <HolidayPromoSignups />
      )}

      {/* Payouts Tab */}
      {activeTab === 'payouts' && (
        <AdminPayoutsManagement />
      )}

      {/* W-9s Tab */}
      {activeTab === 'w9s' && (
        <W9Management />
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <UsersManagement />
      )}

    </div>
  );
};

export default AdminManagementTabs;
