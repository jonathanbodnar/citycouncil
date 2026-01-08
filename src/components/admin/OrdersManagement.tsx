import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { refundService } from '../../services/refundService';
import toast from 'react-hot-toast';
import { logger } from '../../utils/logger';
import {
  MagnifyingGlassIcon,
  XCircleIcon,
  CurrencyDollarIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@heroicons/react/24/outline';

interface Order {
  id: string;
  created_at: string;
  amount: number;
  status: string;
  payment_transaction_id: string;
  request_details: string;
  recipient_name?: string;
  occasion?: string;
  special_instructions?: string;
  details_submitted?: boolean;
  fulfillment_token?: string;
  denial_reason?: string;
  denied_by?: string;
  denied_at?: string;
  refund_id?: string;
  promo_source?: string;
  coupon_code?: string;
  users: {
    id: string;
    email: string;
    full_name: string;
  };
  talent_profiles: {
    users: {
      full_name: string;
    };
  };
}

const OrdersManagement: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [denyReason, setDenyReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [showDenyModal, setShowDenyModal] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundReason, setRefundReason] = useState('');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      logger.log('🔍 [ADMIN] Fetching all orders...');
      
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          users!orders_user_id_fkey (
            id,
            email,
            full_name
          ),
          talent_profiles!orders_talent_id_fkey (
            users!talent_profiles_user_id_fkey (
              full_name
            )
          )
        `)
        .order('created_at', { ascending: false });

      logger.log('📦 [ADMIN] Orders query result:', {
        count: data?.length || 0,
        error: error,
        ordersByUser: data?.reduce((acc: any, order: any) => {
          const email = order.users?.email || 'unknown';
          acc[email] = (acc[email] || 0) + 1;
          return acc;
        }, {})
      });

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      logger.error('Error fetching orders:', error);
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const handleDenyOrder = async () => {
    if (!selectedOrder || !denyReason.trim()) {
      toast.error('Please provide a reason for denying the order');
      return;
    }

    setProcessing(true);
    try {
      // Check if this is a free/coupon order (no payment to refund)
      const isFreeOrder = !selectedOrder.payment_transaction_id || 
        (selectedOrder.discount_amount && selectedOrder.discount_amount >= selectedOrder.original_amount);

      if (isFreeOrder) {
        // Just update the order status without processing a refund
        const { error } = await supabase
          .from('orders')
          .update({
            status: 'denied',
            denial_reason: denyReason,
            denied_by: 'admin',
            denied_at: new Date().toISOString(),
          })
          .eq('id', selectedOrder.id);

        if (error) throw error;

        toast.success('Order denied successfully (no refund needed - free/coupon order)');
        setShowDenyModal(false);
        setSelectedOrder(null);
        setDenyReason('');
        fetchOrders();
      } else {
        // Process refund for paid orders
        const result = await refundService.processRefund({
          orderId: selectedOrder.id,
          transactionId: selectedOrder.payment_transaction_id,
          reason: denyReason,
          deniedBy: 'admin',
        });

        if (result.success) {
          toast.success('Order denied and refund processed successfully');
          setShowDenyModal(false);
          setSelectedOrder(null);
          setDenyReason('');
          fetchOrders();
        } else {
          toast.error(result.error || 'Failed to process refund');
        }
      }
    } catch (error: any) {
      logger.error('Error denying order:', error);
      toast.error(error.message || 'Failed to deny order');
    } finally {
      setProcessing(false);
    }
  };

  const openDenyModal = (order: Order) => {
    setSelectedOrder(order);
    setShowDenyModal(true);
    setDenyReason('');
  };

  const closeDenyModal = () => {
    setShowDenyModal(false);
    setSelectedOrder(null);
    setDenyReason('');
  };

  const handleRefundOrder = async () => {
    if (!selectedOrder || !refundReason.trim()) {
      toast.error('Please provide a reason for the refund');
      return;
    }

    setProcessing(true);
    try {
      // Check if this is a free/coupon order (no payment to refund)
      const isFreeOrder = !selectedOrder.payment_transaction_id || 
        (selectedOrder.discount_amount && selectedOrder.discount_amount >= selectedOrder.original_amount);

      if (isFreeOrder) {
        // Just update the order status without processing a refund
        const { error } = await supabase
          .from('orders')
          .update({
            status: 'refunded',
            denial_reason: refundReason,
            denied_by: 'admin',
            denied_at: new Date().toISOString(),
          })
          .eq('id', selectedOrder.id);

        if (error) throw error;

        toast.success('Order cancelled successfully (no refund needed - free/coupon order)');
        setShowRefundModal(false);
        setSelectedOrder(null);
        setRefundReason('');
        fetchOrders();
      } else {
        // Process refund for paid orders
        const result = await refundService.processRefund({
          orderId: selectedOrder.id,
          transactionId: selectedOrder.payment_transaction_id,
          reason: refundReason,
          deniedBy: 'admin',
        });

        if (result.success) {
          toast.success('Refund processed successfully');
          setShowRefundModal(false);
          setSelectedOrder(null);
          setRefundReason('');
          fetchOrders();
        } else {
          toast.error(result.error || 'Failed to process refund');
        }
      }
    } catch (error: any) {
      logger.error('Error processing refund:', error);
      toast.error(error.message || 'Failed to process refund');
    } finally {
      setProcessing(false);
    }
  };

  const openRefundModal = (order: Order) => {
    setSelectedOrder(order);
    setShowRefundModal(true);
    setRefundReason('');
  };

  const closeRefundModal = () => {
    setShowRefundModal(false);
    setSelectedOrder(null);
    setRefundReason('');
  };

  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      order.users.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.users.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.talent_profiles.users.full_name.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Calculate occasion stats
  const occasionStats = React.useMemo(() => {
    const stats: Record<string, { count: number; revenue: number }> = {};
    orders.forEach((order) => {
      const occasion = order.occasion || 'Not specified';
      if (!stats[occasion]) {
        stats[occasion] = { count: 0, revenue: 0 };
      }
      stats[occasion].count++;
      stats[occasion].revenue += order.amount || 0;
    });
    // Sort by count descending
    return Object.entries(stats)
      .sort((a, b) => b[1].count - a[1].count);
  }, [orders]);

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { bg: string; text: string; icon: any }> = {
      pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: ClockIcon },
      in_progress: { bg: 'bg-blue-100', text: 'text-blue-800', icon: ClockIcon },
      completed: { bg: 'bg-green-100', text: 'text-green-800', icon: CheckCircleIcon },
      denied: { bg: 'bg-red-100', text: 'text-red-800', icon: XCircleIcon },
      cancelled: { bg: 'bg-gray-100', text: 'text-gray-800', icon: XCircleIcon },
    };

    const config = statusConfig[status] || statusConfig.pending;
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
        <Icon className="h-4 w-4 mr-1" />
        {status.replace('_', ' ').toUpperCase()}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Orders Management</h2>
        <button
          onClick={fetchOrders}
          className="w-full sm:w-auto px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Occasion Stats */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Orders by Occasion</h3>
        <div className="flex flex-wrap gap-2">
          {occasionStats.map(([occasion, stats]) => (
            <div 
              key={occasion} 
              className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200"
            >
              <span className="text-sm font-medium text-gray-700 capitalize">
                {occasion.replace(/_/g, ' ')}
              </span>
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-semibold">
                {stats.count}
              </span>
              <span className="text-xs text-gray-500">
                ${(stats.revenue / 100).toFixed(0)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
        <div className="flex-1 relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by customer, email, or talent..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 sm:pl-10 pr-3 sm:pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 sm:px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="denied">Denied</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Mobile Card View */}
      <div className="lg:hidden space-y-3">
        {filteredOrders.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500 text-sm">
            No orders found
          </div>
        ) : (
          filteredOrders.map((order) => {
            const isExpanded = expandedOrderId === order.id;
            return (
              <div key={order.id} className="bg-white rounded-lg shadow">
                {/* Header - Always Visible */}
                <div 
                  className="p-4 cursor-pointer"
                  onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-gray-900 truncate">
                        {order.users?.full_name || 'Unknown Customer'}
                      </div>
                      <div className="text-xs text-gray-500 truncate">{order.users?.email || 'No email'}</div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {order.coupon_code?.toUpperCase() === 'WINNER100' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          🎁 Giveaway
                        </span>
                      )}
                      {getStatusBadge(order.status)}
                      {isExpanded ? (
                        <ChevronUpIcon className="h-5 w-5 text-gray-400" />
                      ) : (
                        <ChevronDownIcon className="h-5 w-5 text-gray-400" />
                      )}
                    </div>
                  </div>

                  {/* Collapsed Info */}
                  <div className="grid grid-cols-2 gap-3 text-sm mt-3">
                    <div>
                      <div className="text-xs text-gray-500 mb-0.5">Talent</div>
                      <div className="font-medium text-gray-900 truncate">
                        {order.talent_profiles?.users?.full_name || 'Unknown'}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-0.5">Amount</div>
                      <div className="font-semibold text-gray-900">
                        ${(order.amount / 100).toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-0.5">Date</div>
                      <div className="text-gray-900 text-xs">
                        {new Date(order.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit'
                        })}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-0.5">Source</div>
                      {order.promo_source ? (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          order.promo_source === 'self_promo' 
                            ? 'bg-purple-100 text-purple-800' 
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {order.promo_source === 'self_promo' ? '🎯 Self' : `📣 ${order.promo_source}`}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">-</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-4 pb-4 space-y-3 border-t border-gray-100">
                    {/* Order Details Status */}
                    {!order.details_submitted && (
                      <div className="pt-3">
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                          <p className="text-xs text-yellow-700 font-medium">⏳ Pending details from customer</p>
                        </div>
                      </div>
                    )}

                    {/* Recipient & Occasion */}
                    {(order.recipient_name || order.occasion) && (
                      <div className="pt-3 grid grid-cols-2 gap-3">
                        {order.recipient_name && (
                          <div>
                            <div className="text-xs font-semibold text-gray-700 mb-1">Recipient:</div>
                            <p className="text-xs text-gray-600">{order.recipient_name}</p>
                          </div>
                        )}
                        {order.occasion && (
                          <div>
                            <div className="text-xs font-semibold text-gray-700 mb-1">Occasion:</div>
                            <p className="text-xs text-gray-600 capitalize">{order.occasion.replace(/-/g, ' ')}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Message */}
                    {order.request_details && (
                      <div className="pt-3">
                        <div className="text-xs font-semibold text-gray-700 mb-2">Request Message:</div>
                        <div className="bg-gray-50 p-3 rounded-lg">
                          <p className="text-xs text-gray-700 whitespace-pre-wrap">
                            {order.request_details}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Special Instructions */}
                    {order.special_instructions && (
                      <div className="pt-2">
                        <div className="text-xs font-semibold text-gray-700 mb-2">Special Instructions:</div>
                        <div className="bg-blue-50 p-3 rounded-lg">
                          <p className="text-xs text-blue-700 whitespace-pre-wrap">
                            {order.special_instructions}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="pt-2 space-y-2">
                      {order.fulfillment_token && (
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            try {
                              const { data: shortLink } = await supabase
                                .from('short_links')
                                .select('short_code')
                                .eq('order_id', order.id)
                                .order('created_at', { ascending: false })
                                .limit(1)
                                .single();

                              let link: string;
                              if (shortLink?.short_code) {
                                link = `${window.location.origin}/s/${shortLink.short_code}`;
                                logger.log('📋 Using short link:', link);
                              } else {
                                link = `${window.location.origin}/fulfill/${order.fulfillment_token}`;
                                logger.log('📋 Using full link (no short link found)');
                              }
                              
                              await navigator.clipboard.writeText(link);
                              toast.success('Link copied to clipboard!');
                            } catch (error) {
                              logger.error('Error copying link:', error);
                              toast.error('Failed to copy link');
                            }
                          }}
                          className="w-full px-3 py-2 text-sm text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors"
                        >
                          Copy Fulfillment Link
                        </button>
                      )}
                
                      {(order.status === 'pending' || order.status === 'in_progress') && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openDenyModal(order);
                          }}
                          className="w-full inline-flex items-center justify-center px-3 py-2 text-sm border border-red-300 text-red-700 rounded-lg hover:bg-red-50 transition-colors"
                        >
                          <XCircleIcon className="h-4 w-4 mr-1" />
                          Deny & Refund
                        </button>
                      )}
                      
                      {order.status === 'completed' && !order.refund_id && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openRefundModal(order);
                          }}
                          className="w-full inline-flex items-center justify-center px-3 py-2 text-sm border border-orange-300 text-orange-700 rounded-lg hover:bg-orange-50 transition-colors"
                        >
                          <CurrencyDollarIcon className="h-4 w-4 mr-1" />
                          Refund Order
                        </button>
                      )}
                      
                      {(order.status === 'denied' || order.refund_id) && (
                        <div className="flex items-center justify-center px-3 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm">
                          <CheckCircleIcon className="h-4 w-4 mr-1" />
                          Refunded
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Desktop Table View - Condensed */}
      <div className="hidden lg:block bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full divide-y divide-gray-200 table-fixed">
          <thead className="bg-gray-50">
            <tr>
              <th className="w-8 px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                
              </th>
              <th className="w-20 px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Date
              </th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Customer
              </th>
              <th className="w-28 px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Talent
              </th>
              <th className="w-16 px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Amt
              </th>
              <th className="w-24 px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Status
              </th>
              <th className="w-20 px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Source
              </th>
              <th className="w-16 px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredOrders.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-2 py-8 text-center text-gray-500">
                  No orders found
                </td>
              </tr>
            ) : (
              filteredOrders.map((order) => {
                const isExpanded = expandedOrderId === order.id;
                return (
                  <React.Fragment key={order.id}>
                    <tr className="hover:bg-gray-50 cursor-pointer" onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}>
                      <td className="px-2 py-2 text-sm text-gray-500">
                        {isExpanded ? (
                          <ChevronUpIcon className="h-4 w-4 text-gray-400" />
                        ) : (
                          <ChevronDownIcon className="h-4 w-4 text-gray-400" />
                        )}
                      </td>
                      <td className="px-2 py-2 text-xs text-gray-900">
                        {new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </td>
                      <td className="px-2 py-2">
                        <div className="text-xs font-medium text-gray-900 truncate">{order.users.full_name}</div>
                        <div className="text-xs text-gray-500 truncate">{order.users.email}</div>
                      </td>
                      <td className="px-2 py-2 text-xs text-gray-900 truncate">
                        {order.talent_profiles.users.full_name}
                      </td>
                      <td className="px-2 py-2 text-xs font-medium text-gray-900">
                        ${(order.amount / 100).toFixed(0)}
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex flex-col gap-1">
                          {getStatusBadge(order.status)}
                          {order.coupon_code?.toUpperCase() === 'WINNER100' && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                              🎁
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-2 text-xs">
                        {order.promo_source ? (
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium truncate max-w-full ${
                            order.promo_source === 'self_promo' 
                              ? 'bg-purple-100 text-purple-800' 
                              : 'bg-blue-100 text-blue-800'
                          }`} title={order.promo_source}>
                            {order.promo_source === 'self_promo' ? '🎯' : order.promo_source.slice(0, 6)}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-right text-xs">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedOrderId(isExpanded ? null : order.id);
                          }}
                          className="text-blue-600 hover:text-blue-700 font-medium"
                        >
                            {isExpanded ? 'Hide Details' : 'View Details'}
                          </button>
                        </td>
                      </tr>

                      {/* Expanded Details Row */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={8} className="px-6 py-4 bg-gray-50">
                            <div className="space-y-4">
                              {/* Order Details Status */}
                              {!order.details_submitted && (
                                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                                  <p className="text-sm text-yellow-700 font-medium">⏳ Pending details from customer</p>
                                </div>
                              )}

                              {/* Recipient & Occasion */}
                              {(order.recipient_name || order.occasion) && (
                                <div className="grid grid-cols-2 gap-4">
                                  {order.recipient_name && (
                                    <div>
                                      <h4 className="text-sm font-semibold text-gray-700 mb-1">Recipient:</h4>
                                      <p className="text-sm text-gray-600">{order.recipient_name}</p>
                                    </div>
                                  )}
                                  {order.occasion && (
                                    <div>
                                      <h4 className="text-sm font-semibold text-gray-700 mb-1">Occasion:</h4>
                                      <p className="text-sm text-gray-600 capitalize">{order.occasion.replace(/-/g, ' ')}</p>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Message */}
                              {order.request_details && (
                                <div>
                                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Request Message:</h4>
                                  <div className="bg-white p-4 rounded-lg border border-gray-200">
                                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{order.request_details}</p>
                                  </div>
                                </div>
                              )}

                              {/* Special Instructions */}
                              {order.special_instructions && (
                                <div>
                                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Special Instructions:</h4>
                                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                                    <p className="text-sm text-blue-700 whitespace-pre-wrap">{order.special_instructions}</p>
                                  </div>
                                </div>
                              )}

                              {/* Actions Section */}
                              <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-200">
                                {/* Copy Fulfillment Link */}
                                {order.fulfillment_token && (
                                  <button
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      try {
                                        const { data: shortLink } = await supabase
                                          .from('short_links')
                                          .select('short_code')
                                          .eq('order_id', order.id)
                                          .order('created_at', { ascending: false })
                                          .limit(1)
                                          .single();

                                        let link: string;
                                        if (shortLink?.short_code) {
                                          link = `${window.location.origin}/s/${shortLink.short_code}`;
                                        } else {
                                          link = `${window.location.origin}/fulfill/${order.fulfillment_token}`;
                                        }
                                        
                                        await navigator.clipboard.writeText(link);
                                        toast.success('Link copied to clipboard!');
                                      } catch (error) {
                                        logger.error('Error copying link:', error);
                                        toast.error('Failed to copy link');
                                      }
                                    }}
                                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                  >
                                    Copy Fulfillment Link
                                  </button>
                                )}

                                {/* Deny & Refund */}
                                {(order.status === 'pending' || order.status === 'in_progress') && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openDenyModal(order);
                                    }}
                                    className="inline-flex items-center px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 transition-colors"
                                  >
                                    <XCircleIcon className="h-4 w-4 mr-2" />
                                    Deny & Refund
                                  </button>
                                )}
                                
                                {/* Refund Completed */}
                                {order.status === 'completed' && !order.refund_id && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openRefundModal(order);
                                    }}
                                    className="inline-flex items-center px-4 py-2 border border-orange-300 text-orange-700 rounded-lg hover:bg-orange-50 transition-colors"
                                  >
                                    <CurrencyDollarIcon className="h-4 w-4 mr-2" />
                                    Refund Order
                                  </button>
                                )}
                                
                                {/* Refunded Badge */}
                                {(order.status === 'denied' || order.refund_id) && (
                                  <div className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-600 rounded-lg">
                                    <CheckCircleIcon className="h-4 w-4 mr-2" />
                                    Refunded
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
      </div>

      {/* Deny Order Modal */}
      {showDenyModal && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center mb-4">
              <ExclamationTriangleIcon className="h-6 w-6 text-red-600 mr-2" />
              <h3 className="text-lg font-semibold text-gray-900">Deny Order & Process Refund</h3>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                <strong>Customer:</strong> {selectedOrder.users.full_name} ({selectedOrder.users.email})
              </p>
              <p className="text-sm text-gray-600 mb-2">
                <strong>Talent:</strong> {selectedOrder.talent_profiles.users.full_name}
              </p>
              <p className="text-sm text-gray-600 mb-4">
                <strong>Amount to Refund:</strong> ${(selectedOrder.amount / 100).toFixed(2)}
              </p>

              <label className="block text-sm font-medium text-gray-700 mb-2">
                Denial Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                value={denyReason}
                onChange={(e) => setDenyReason(e.target.value)}
                placeholder="Explain why this order is being denied..."
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={processing}
              />
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
              <p className="text-xs text-yellow-800">
                <strong>Warning:</strong> This will immediately process a refund through Fortis and notify the customer via email and in-app notification.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={closeDenyModal}
                disabled={processing}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDenyOrder}
                disabled={processing || !denyReason.trim()}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processing ? 'Processing...' : 'Deny & Refund'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Refund Completed Order Modal */}
      {showRefundModal && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center mb-4">
              <CurrencyDollarIcon className="h-6 w-6 text-orange-600 mr-2" />
              <h3 className="text-lg font-semibold text-gray-900">Refund Completed Order</h3>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                <strong>Customer:</strong> {selectedOrder.users.full_name} ({selectedOrder.users.email})
              </p>
              <p className="text-sm text-gray-600 mb-2">
                <strong>Talent:</strong> {selectedOrder.talent_profiles.users.full_name}
              </p>
              <p className="text-sm text-gray-600 mb-4">
                <strong>Amount to Refund:</strong> ${(selectedOrder.amount / 100).toFixed(2)}
              </p>

              <label className="block text-sm font-medium text-gray-700 mb-2">
                Refund Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder="E.g., Customer dissatisfied with video quality, incorrect content, etc."
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={processing}
              />
            </div>

            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-4">
              <p className="text-xs text-orange-800">
                <strong>Note:</strong> This will process a refund for a completed order. The customer will be notified via email and in-app notification. The talent has already been paid, so this may require manual adjustment.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={closeRefundModal}
                disabled={processing}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRefundOrder}
                disabled={processing || !refundReason.trim()}
                className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processing ? 'Processing...' : 'Process Refund'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrdersManagement;

