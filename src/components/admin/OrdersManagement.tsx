import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { refundService } from '../../services/refundService';
import toast from 'react-hot-toast';
import {
  MagnifyingGlassIcon,
  XCircleIcon,
  CurrencyDollarIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

interface Order {
  id: string;
  created_at: string;
  amount: number;
  status: string;
  payment_transaction_id: string;
  denial_reason?: string;
  denied_by?: string;
  denied_at?: string;
  refund_id?: string;
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

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
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

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('Error fetching orders:', error);
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

    if (!selectedOrder.payment_transaction_id) {
      toast.error('Cannot refund: No transaction ID found');
      return;
    }

    setProcessing(true);
    try {
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
    } catch (error: any) {
      console.error('Error denying order:', error);
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

  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      order.users.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.users.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.talent_profiles.users.full_name.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Orders Management</h2>
        <button
          onClick={fetchOrders}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by customer email, name, or talent..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="denied">Denied</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Talent
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    No orders found
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(order.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{order.users.full_name}</div>
                      <div className="text-sm text-gray-500">{order.users.email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {order.talent_profiles.users.full_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      ${(order.amount / 100).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(order.status)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                      {order.status !== 'denied' && order.status !== 'cancelled' && (
                        <button
                          onClick={() => openDenyModal(order)}
                          className="inline-flex items-center px-3 py-1.5 border border-red-300 text-red-700 rounded-md hover:bg-red-50 transition-colors"
                        >
                          <XCircleIcon className="h-4 w-4 mr-1" />
                          Deny & Refund
                        </button>
                      )}
                      {order.status === 'denied' && order.refund_id && (
                        <span className="inline-flex items-center px-3 py-1.5 bg-gray-100 text-gray-600 rounded-md text-xs">
                          <CheckCircleIcon className="h-4 w-4 mr-1" />
                          Refunded
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
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
    </div>
  );
};

export default OrdersManagement;

