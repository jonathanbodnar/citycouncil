import React, { useState, useEffect } from 'react';
import { ChevronLeftIcon, ChevronRightIcon, PlayIcon } from '@heroicons/react/24/outline';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { Order, TalentProfile } from '../types';
import { format } from 'date-fns';

interface OrderWithTalent extends Order {
  talent_profiles: TalentProfile & {
    users: {
      id: string;
      full_name: string;
      avatar_url?: string;
    };
  };
}

interface OrdersPanelProps {
  onBack: () => void;
  onNext: () => void;
}

const OrdersPanel: React.FC<OrdersPanelProps> = ({ onBack, onNext }) => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<OrderWithTalent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchOrders();
    } else {
      setLoading(false);
    }
  }, [user]);

  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          talent_profiles!orders_talent_id_fkey (
            *,
            users!talent_profiles_user_id_fkey (
              id,
              full_name,
              avatar_url
            )
          )
        `)
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500/20 text-green-400 border-green-500/50';
      case 'in_progress':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/50';
      case 'pending':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
      case 'denied':
      case 'cancelled':
        return 'bg-red-500/20 text-red-400 border-red-500/50';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/50';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Completed';
      case 'in_progress':
        return 'In Progress';
      case 'pending':
        return 'Pending';
      case 'denied':
        return 'Denied';
      case 'cancelled':
        return 'Cancelled';
      case 'refunded':
        return 'Refunded';
      default:
        return status;
    }
  };

  return (
    <div 
      className="h-full overflow-y-auto pt-16"
      style={{
        background: 'linear-gradient(to bottom right, #a70809, #3c108b)'
      }}
    >

      {/* Content */}
      <div className="p-4">
        {!user ? (
          <div className="text-center py-12">
            <div className="text-white/60 mb-4">
              Sign in to view your orders
            </div>
            <a
              href="/login"
              className="inline-block bg-blue-600 text-white px-6 py-3 rounded-full font-bold hover:bg-blue-700 transition-colors"
            >
              Sign In
            </a>
          </div>
        ) : loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-white/60 mb-4">No orders yet</div>
            <button
              onClick={onBack}
              className="inline-block bg-blue-600 text-white px-6 py-3 rounded-full font-bold hover:bg-blue-700 transition-colors"
            >
              Browse Talent
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map(order => (
              <div
                key={order.id}
                className="glass rounded-xl overflow-hidden border border-white/10"
              >
                <div className="p-4">
                  {/* Talent info */}
                  <div className="flex items-center gap-3 mb-3">
                    <img
                      src={
                        order.talent_profiles.temp_avatar_url ||
                        order.talent_profiles.users.avatar_url ||
                        '/default-avatar.png'
                      }
                      alt={
                        order.talent_profiles.temp_full_name ||
                        order.talent_profiles.users.full_name
                      }
                      className="w-12 h-12 rounded-full object-cover"
                    />
                    <div className="flex-1">
                      <div className="text-white font-bold">
                        {order.talent_profiles.temp_full_name ||
                          order.talent_profiles.users.full_name}
                      </div>
                      <div className="text-white/60 text-sm">
                        {format(new Date(order.created_at), 'MMM d, yyyy')}
                      </div>
                    </div>
                    <div
                      className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                        order.status
                      )}`}
                    >
                      {getStatusText(order.status)}
                    </div>
                  </div>

                  {/* Request details */}
                  <div className="text-white/80 text-sm mb-3 line-clamp-2">
                    {order.request_details}
                  </div>

                  {/* Video preview or action */}
                  {order.status === 'completed' && order.video_url ? (
                    <div className="relative rounded-lg overflow-hidden bg-black aspect-video">
                      <video
                        src={order.video_url}
                        className="w-full h-full object-cover"
                        poster={
                          order.talent_profiles.temp_avatar_url ||
                          order.talent_profiles.users.avatar_url
                        }
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-12 h-12 bg-white/90 rounded-full flex items-center justify-center">
                          <PlayIcon className="w-6 h-6 text-black ml-1" />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4 bg-white/5 rounded-lg">
                      <div className="text-white/60 text-sm">
                        {order.status === 'pending'
                          ? 'Waiting for talent to start'
                          : order.status === 'in_progress'
                          ? 'Video in progress...'
                          : 'No video available'}
                      </div>
                    </div>
                  )}

                  {/* Amount */}
                  <div className="mt-3 text-right">
                    <span className="text-white font-bold text-lg">
                      ${order.amount.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};

export default OrdersPanel;

