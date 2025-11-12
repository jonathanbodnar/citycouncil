import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { Payout, PayoutBatch } from '../types';
import { CurrencyDollarIcon, CalendarIcon, CheckCircleIcon, XCircleIcon, ClockIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { format, parseISO } from 'date-fns';

interface TalentPayoutsDashboardProps {
  talentId: string;
}

export default function TalentPayoutsDashboard({ talentId }: TalentPayoutsDashboardProps) {
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [batches, setBatches] = useState<PayoutBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);
  const [totalEarnings, setTotalEarnings] = useState<number>(0);

  useEffect(() => {
    fetchPayouts();
  }, [talentId]);

  const fetchPayouts = async () => {
    try {
      setLoading(true);

      // Fetch individual payouts
      const { data: payoutsData, error: payoutsError } = await supabase
        .from('payouts')
        .select(`
          *,
          orders:order_id (
            id,
            request_details,
            recipient_name,
            created_at,
            updated_at
          )
        `)
        .eq('talent_id', talentId)
        .order('created_at', { ascending: false });

      if (payoutsError) throw payoutsError;

      // Fetch weekly batches
      const { data: batchesData, error: batchesError } = await supabase
        .from('payout_batches')
        .select('*')
        .eq('talent_id', talentId)
        .order('week_start_date', { ascending: false });

      if (batchesError) throw batchesError;

      setPayouts(payoutsData || []);
      setBatches(batchesData || []);

      // Calculate total earnings (not refunded)
      const earnings = (payoutsData || [])
        .filter(p => !p.is_refunded)
        .reduce((sum, p) => sum + Number(p.payout_amount), 0);
      setTotalEarnings(earnings);

    } catch (error: any) {
      console.error('Error fetching payouts:', error);
      toast.error('Failed to load payouts');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'text-yellow-600 bg-yellow-50';
      case 'batched':
        return 'text-blue-600 bg-blue-50';
      case 'processing':
        return 'text-purple-600 bg-purple-50';
      case 'paid':
        return 'text-green-600 bg-green-50';
      case 'failed':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusIcon = (status: string, isRefunded: boolean) => {
    if (isRefunded) {
      return <XCircleIcon className="w-5 h-5 text-red-500" />;
    }
    switch (status) {
      case 'pending':
      case 'batched':
        return <ClockIcon className="w-5 h-5 text-yellow-500" />;
      case 'processing':
        return <ClockIcon className="w-5 h-5 text-purple-500" />;
      case 'paid':
        return <CheckCircleIcon className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <XCircleIcon className="w-5 h-5 text-red-500" />;
      default:
        return <ClockIcon className="w-5 h-5 text-gray-500" />;
    }
  };

  const formatWeekRange = (startDate: string, endDate: string) => {
    try {
      const start = parseISO(startDate);
      const end = parseISO(endDate);
      return `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`;
    } catch (error) {
      return `${startDate} - ${endDate}`;
    }
  };

  const getWeekPayouts = (weekStart: string) => {
    return payouts.filter(p => p.week_start_date === weekStart);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Total Earnings */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-2">Your Earnings</h2>
            <p className="text-blue-100">Track your payouts and earnings</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">${totalEarnings.toFixed(2)}</div>
            <div className="text-sm text-blue-100">Total Earned</div>
          </div>
        </div>
      </div>

      {/* Weekly Batches */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Weekly Payouts</h3>
          <p className="text-sm text-gray-500 mt-1">Payouts are batched weekly and processed on Mondays</p>
        </div>

        {batches.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <CurrencyDollarIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No payouts yet</h3>
            <p className="mt-1 text-sm text-gray-500">
              Complete orders to start earning!
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {batches.map((batch) => {
              const weekPayouts = getWeekPayouts(batch.week_start_date);
              const isExpanded = selectedWeek === batch.week_start_date;

              return (
                <div key={batch.id} className="px-6 py-4">
                  <button
                    onClick={() => setSelectedWeek(isExpanded ? null : batch.week_start_date)}
                    className="w-full text-left"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <CalendarIcon className="w-6 h-6 text-gray-400" />
                        <div>
                          <div className="font-medium text-gray-900">
                            {formatWeekRange(batch.week_start_date, batch.week_end_date)}
                          </div>
                          <div className="text-sm text-gray-500">
                            {batch.total_orders} order{batch.total_orders !== 1 ? 's' : ''}
                            {batch.total_refunded_amount > 0 && (
                              <span className="text-red-600 ml-2">
                                ({weekPayouts.filter(p => p.is_refunded).length} refunded)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <div className="font-semibold text-gray-900">
                            ${batch.net_payout_amount.toFixed(2)}
                          </div>
                          {batch.total_refunded_amount > 0 && (
                            <div className="text-xs text-gray-500">
                              (${batch.total_payout_amount.toFixed(2)} - ${batch.total_refunded_amount.toFixed(2)} refunds)
                            </div>
                          )}
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(batch.status)}`}>
                          {batch.status}
                        </span>
                      </div>
                    </div>
                  </button>

                  {/* Expanded: Show individual payouts for this week */}
                  {isExpanded && (
                    <div className="mt-4 ml-10 space-y-3">
                      {weekPayouts.map((payout) => (
                        <div
                          key={payout.id}
                          className={`flex items-center justify-between p-4 rounded-lg border ${
                            payout.is_refunded 
                              ? 'bg-red-50 border-red-200' 
                              : 'bg-gray-50 border-gray-200'
                          }`}
                        >
                          <div className="flex items-center space-x-3">
                            {getStatusIcon(payout.status, payout.is_refunded)}
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                Order #{payout.order_id.slice(0, 8)}
                              </div>
                              <div className="text-xs text-gray-500">
                                {format(parseISO(payout.created_at), 'MMM d, yyyy h:mm a')}
                              </div>
                              {payout.is_refunded && (
                                <div className="text-xs text-red-600 mt-1">
                                  Refunded: {payout.refund_reason}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="text-right">
                            <div className={`font-semibold ${payout.is_refunded ? 'text-red-600 line-through' : 'text-gray-900'}`}>
                              ${payout.payout_amount.toFixed(2)}
                            </div>
                            <div className="text-xs text-gray-500">
                              ${payout.order_amount.toFixed(2)} - {payout.admin_fee_percentage}% fee
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* All Payouts (Detailed View) */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">All Payouts</h3>
          <p className="text-sm text-gray-500 mt-1">Complete list of your earnings</p>
        </div>

        {payouts.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-gray-500">No payouts to display</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Order
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Week
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Order Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Admin Fee
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Your Payout
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {payouts.map((payout) => (
                  <tr key={payout.id} className={payout.is_refunded ? 'bg-red-50' : ''}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {format(parseISO(payout.created_at), 'MMM d, yyyy')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      #{payout.order_id.slice(0, 8)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {format(parseISO(payout.week_start_date), 'MMM d')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ${payout.order_amount.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {payout.admin_fee_percentage}% (${payout.admin_fee_amount.toFixed(2)})
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm font-semibold ${
                      payout.is_refunded ? 'text-red-600 line-through' : 'text-gray-900'
                    }`}>
                      ${payout.payout_amount.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(payout.status, payout.is_refunded)}
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(payout.status)}`}>
                          {payout.is_refunded ? 'Refunded' : payout.status}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

