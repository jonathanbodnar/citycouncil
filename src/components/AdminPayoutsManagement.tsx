import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { PayoutBatch, Payout, TalentProfile } from '../types';
import { 
  CurrencyDollarIcon, 
  CalendarIcon, 
  UserIcon,
  ChevronDownIcon,
  ChevronUpIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { format, parseISO } from 'date-fns';

export default function AdminPayoutsManagement() {
  const [batches, setBatches] = useState<(PayoutBatch & { talent?: TalentProfile })[]>([]);
  const [talents, setTalents] = useState<TalentProfile[]>([]);
  const [selectedTalent, setSelectedTalent] = useState<string>('all');
  const [selectedBatch, setSelectedBatch] = useState<string | null>(null);
  const [batchPayouts, setBatchPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPayouts, setLoadingPayouts] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    fetchBatches();
  }, [selectedTalent]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch all talent
      const { data: talentsData, error: talentsError } = await supabase
        .from('talent_profiles')
        .select(`
          *,
          users!talent_profiles_user_id_fkey (
            id,
            full_name
          )
        `)
        .order('username', { ascending: true });

      if (talentsError) throw talentsError;

      setTalents(talentsData || []);
      await fetchBatches();

    } catch (error: any) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load payout data');
    } finally {
      setLoading(false);
    }
  };

  const fetchBatches = async () => {
    try {
      let query = supabase
        .from('payout_batches')
        .select(`
          *,
          talent_profiles!payout_batches_talent_id_fkey (
            id,
            username,
            temp_full_name,
            users!talent_profiles_user_id_fkey (
              full_name
            )
          )
        `)
        .order('week_start_date', { ascending: false });

      if (selectedTalent !== 'all') {
        query = query.eq('talent_id', selectedTalent);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Flatten the nested structure
      const formattedData = (data || []).map((batch: any) => ({
        ...batch,
        talent: {
          ...batch.talent_profiles,
          full_name: batch.talent_profiles?.users?.full_name || batch.talent_profiles?.temp_full_name
        }
      }));

      setBatches(formattedData);

    } catch (error: any) {
      console.error('Error fetching batches:', error);
      toast.error('Failed to load payout batches');
    }
  };

  const fetchBatchPayouts = async (batchId: string, weekStart: string, talentId: string) => {
    try {
      setLoadingPayouts(true);

      const { data, error } = await supabase
        .from('payouts')
        .select(`
          *,
          orders!payouts_order_id_fkey (
            id,
            request_details,
            recipient_name,
            created_at,
            status
          )
        `)
        .eq('talent_id', talentId)
        .eq('week_start_date', weekStart)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setBatchPayouts(data || []);

    } catch (error: any) {
      console.error('Error fetching batch payouts:', error);
      toast.error('Failed to load payout details');
    } finally {
      setLoadingPayouts(false);
    }
  };

  const handleBatchClick = async (batch: PayoutBatch & { talent?: TalentProfile }) => {
    if (selectedBatch === batch.id) {
      setSelectedBatch(null);
      setBatchPayouts([]);
    } else {
      setSelectedBatch(batch.id);
      await fetchBatchPayouts(batch.id, batch.week_start_date, batch.talent_id);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'processing':
        return 'text-purple-600 bg-purple-50 border-purple-200';
      case 'paid':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'failed':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
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

  const getTotalStats = () => {
    const total = batches.reduce((sum, b) => sum + Number(b.net_payout_amount), 0);
    const pending = batches.filter(b => b.status === 'pending').reduce((sum, b) => sum + Number(b.net_payout_amount), 0);
    const paid = batches.filter(b => b.status === 'paid').reduce((sum, b) => sum + Number(b.net_payout_amount), 0);

    return { total, pending, paid };
  };

  const stats = getTotalStats();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <CurrencyDollarIcon className="h-8 w-8 text-gray-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Payouts</p>
              <p className="text-2xl font-semibold text-gray-900">${stats.total.toFixed(2)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <CalendarIcon className="h-8 w-8 text-yellow-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Pending</p>
              <p className="text-2xl font-semibold text-yellow-600">${stats.pending.toFixed(2)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <CurrencyDollarIcon className="h-8 w-8 text-green-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Paid Out</p>
              <p className="text-2xl font-semibold text-green-600">${stats.paid.toFixed(2)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <label htmlFor="talent-filter" className="block text-sm font-medium text-gray-700 mb-2">
              Filter by Talent
            </label>
            <select
              id="talent-filter"
              value={selectedTalent}
              onChange={(e) => setSelectedTalent(e.target.value)}
              className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
            >
              <option value="all">All Talent</option>
              {talents.map((talent) => (
                <option key={talent.id} value={talent.id}>
                  {talent.username} ({talent.full_name || talent.temp_full_name || 'No name'})
                </option>
              ))}
            </select>
          </div>

          <div className="text-sm text-gray-500">
            Showing {batches.length} batch{batches.length !== 1 ? 'es' : ''}
          </div>
        </div>
      </div>

      {/* Payout Batches List */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Weekly Payout Batches</h3>
          <p className="text-sm text-gray-500 mt-1">Click on a batch to see itemized payouts</p>
        </div>

        {batches.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <CurrencyDollarIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No payout batches</h3>
            <p className="mt-1 text-sm text-gray-500">
              Payouts will appear here when orders are completed
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {batches.map((batch) => {
              const isExpanded = selectedBatch === batch.id;

              return (
                <div key={batch.id}>
                  <button
                    onClick={() => handleBatchClick(batch)}
                    className="w-full px-6 py-4 text-left hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4 flex-1">
                        <UserIcon className="w-6 h-6 text-gray-400" />
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">
                            {batch.talent?.username || 'Unknown Talent'}
                          </div>
                          <div className="text-sm text-gray-500">
                            {batch.talent?.full_name || batch.talent?.temp_full_name}
                          </div>
                        </div>

                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {formatWeekRange(batch.week_start_date, batch.week_end_date)}
                          </div>
                          <div className="text-xs text-gray-500">
                            {batch.total_orders} order{batch.total_orders !== 1 ? 's' : ''}
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="font-semibold text-gray-900">
                            ${batch.net_payout_amount.toFixed(2)}
                          </div>
                          {batch.total_refunded_amount > 0 && (
                            <div className="text-xs text-red-600">
                              -${batch.total_refunded_amount.toFixed(2)} refunded
                            </div>
                          )}
                        </div>

                        <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(batch.status)}`}>
                          {batch.status}
                        </span>

                        {isExpanded ? (
                          <ChevronUpIcon className="w-5 h-5 text-gray-400" />
                        ) : (
                          <ChevronDownIcon className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                    </div>
                  </button>

                  {/* Expanded: Show itemized payouts */}
                  {isExpanded && (
                    <div className="px-6 pb-4 bg-gray-50">
                      {loadingPayouts ? (
                        <div className="flex items-center justify-center py-8">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        </div>
                      ) : (
                        <div className="mt-4 space-y-3">
                          <h4 className="text-sm font-medium text-gray-700 mb-3">Itemized Payouts</h4>
                          {batchPayouts.map((payout: any) => (
                            <div
                              key={payout.id}
                              className={`flex items-center justify-between p-4 rounded-lg border ${
                                payout.is_refunded 
                                  ? 'bg-red-50 border-red-200' 
                                  : 'bg-white border-gray-200'
                              }`}
                            >
                              <div className="flex-1">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <div className="text-sm font-medium text-gray-900">
                                      Order #{payout.order_id.slice(0, 8)}
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1">
                                      {payout.orders?.recipient_name && (
                                        <span>For: {payout.orders.recipient_name} • </span>
                                      )}
                                      {format(parseISO(payout.created_at), 'MMM d, yyyy h:mm a')}
                                    </div>
                                    {payout.orders?.request_details && (
                                      <div className="text-xs text-gray-600 mt-1 max-w-md truncate">
                                        {payout.orders.request_details}
                                      </div>
                                    )}
                                    {payout.is_refunded && (
                                      <div className="text-xs text-red-600 mt-1 font-medium">
                                        ⚠️ REFUNDED: {payout.refund_reason}
                                      </div>
                                    )}
                                  </div>

                                  <div className="text-right ml-4">
                                    <div className={`text-sm font-semibold ${payout.is_refunded ? 'text-red-600 line-through' : 'text-gray-900'}`}>
                                      ${payout.payout_amount.toFixed(2)}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      ${payout.order_amount.toFixed(2)} - {payout.admin_fee_percentage}% (${payout.admin_fee_amount.toFixed(2)})
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

