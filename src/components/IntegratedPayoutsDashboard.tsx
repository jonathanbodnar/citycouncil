import React, { useState, useEffect } from 'react';
import {
  BanknotesIcon,
  CreditCardIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  PlusIcon,
  CurrencyDollarIcon,
  CalendarIcon
} from '@heroicons/react/24/outline';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { Payout, PayoutBatch, VendorBankInfo } from '../types';
import toast from 'react-hot-toast';
import PayoutOnboardingWizard from './payout/PayoutOnboardingWizard';
import { format, parseISO } from 'date-fns';

const IntegratedPayoutsDashboard: React.FC = () => {
  const { user } = useAuth();
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [batches, setBatches] = useState<PayoutBatch[]>([]);
  const [bankInfo, setBankInfo] = useState<VendorBankInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [moovAccountId, setMoovAccountId] = useState<string | null>(null);
  const [isLinkingBank, setIsLinkingBank] = useState(false);
  const [payoutsEnabled, setPayoutsEnabled] = useState(false);
  const [talentId, setTalentId] = useState<string | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);
  const [showOnboardingWizard, setShowOnboardingWizard] = useState(false);
  const [payoutOnboardingCompleted, setPayoutOnboardingCompleted] = useState(false);

  useEffect(() => {
    if (user?.user_type === 'talent') {
      fetchPayoutData();
      fetchPayoutsEnabledSetting();
    }
  }, [user]);

  const fetchPayoutsEnabledSetting = async () => {
    try {
      const { data, error } = await supabase
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', 'payouts_enabled')
        .single();

      if (error) throw error;
      setPayoutsEnabled(data?.setting_value === 'true');
    } catch (error) {
      console.error('Error fetching payouts enabled setting:', error);
      setPayoutsEnabled(false);
    }
  };

  const fetchPayoutData = async () => {
    try {
      setLoading(true);

      console.log('🔍 Fetching payout data for user:', user?.id);

      // Get talent profile
      const { data: talentProfile, error: talentError } = await supabase
        .from('talent_profiles')
        .select('id, moov_account_id, payout_onboarding_completed, bank_account_linked')
        .eq('user_id', user?.id)
        .single();

      if (talentError) {
        console.error('❌ Error fetching talent profile:', talentError);
        throw talentError;
      }

      if (!talentProfile) {
        console.error('❌ No talent profile found for user:', user?.id);
        return;
      }

      console.log('✅ Talent profile found:', {
        talentId: talentProfile.id,
        moovAccountId: talentProfile.moov_account_id,
        onboardingCompleted: talentProfile.payout_onboarding_completed
      });

      setTalentId(talentProfile.id);
      const currentMoovId = talentProfile.moov_account_id || null;
      setMoovAccountId(currentMoovId);
      setPayoutOnboardingCompleted(talentProfile.payout_onboarding_completed || false);

      // Fetch payouts from new system (without foreign key joins to avoid RLS issues)
      const { data: payoutsData, error: payoutsError } = await supabase
        .from('payouts')
        .select('*')
        .eq('talent_id', talentProfile.id)
        .order('created_at', { ascending: false });

      if (payoutsError) {
        console.error('Error fetching payouts:', payoutsError);
        throw payoutsError;
      }
      
      console.log('💰 Payouts fetched:', {
        count: payoutsData?.length || 0,
        data: payoutsData
      });
      setPayouts(payoutsData || []);

      // Fetch weekly batches
      const { data: batchesData, error: batchesError } = await supabase
        .from('payout_batches')
        .select('*')
        .eq('talent_id', talentProfile.id)
        .order('week_start_date', { ascending: false });

      if (batchesError) {
        console.error('Error fetching batches:', batchesError);
        throw batchesError;
      }
      
      console.log('📦 Batches fetched:', {
        count: batchesData?.length || 0,
        data: batchesData
      });
      setBatches(batchesData || []);

      // Fetch bank info if Moov account exists
      if (currentMoovId) {
        const { data: banksData, error: banksError } = await supabase.functions.invoke(
          'moov-list-bank-accounts',
          { body: { moovAccountId: currentMoovId } }
        );

        if (banksError) throw banksError;

        if (banksData && banksData.length > 0) {
          const latestBank = banksData[banksData.length - 1];
          const moovBank = banksData[latestBank];
          const bankInfoForDisplay: VendorBankInfo = {
            id: moovBank.bankAccountID,
            talent_id: talentProfile.id,
            account_holder_name: moovBank.holderName,
            bank_name: moovBank.bankName,
            account_type: moovBank.bankAccountType,
            account_number_masked: `****${moovBank.lastFourAccountNumber}`,
            is_verified: moovBank.status === 'verified',
            routing_number: moovBank.routingNumber,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          setBankInfo(bankInfoForDisplay);
        } else {
          setBankInfo(null);
        }
      } else {
        setBankInfo(null);
      }
    } catch (error) {
      console.error('Error fetching payout data:', error);
      toast.error('Failed to load payout information');
    } finally {
      setLoading(false);
    }
  };

  const linkBankViaPlaid = async () => {
    try {
      if (isLinkingBank) return;
      setIsLinkingBank(true);

      const { data: talentProfile, error: tpErr } = await supabase
        .from('talent_profiles')
        .select('id, moov_account_id')
        .eq('user_id', user?.id)
        .single();

      if (tpErr) throw tpErr;
      if (!talentProfile) throw new Error('Talent profile not found');

      const accountId = talentProfile.moov_account_id || moovAccountId;
      if (!accountId) {
        toast.error('Please create your Moov account before linking your bank.');
        return;
      }

      toast.loading('Preparing Plaid Link…', { id: 'plaid-link' });
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth?.user?.id || user?.id;
      if (!uid) throw new Error('Not authenticated');

      const { data: tokenResp, error: tokenErr } = await supabase.functions.invoke(
        'plaid-create-link-token',
        { body: { userId: uid } }
      );

      if (tokenErr) throw tokenErr;
      const linkToken = (tokenResp as any)?.link_token;
      if (!linkToken) throw new Error('Missing Plaid link_token');

      const loadPlaidScript = () =>
        new Promise<void>((resolve, reject) => {
          if ((window as any).Plaid) return resolve();
          const s = document.createElement('script');
          s.src = 'https://cdn.plaid.com/link/v2/stable/link-initialize.js';
          s.async = true;
          s.onload = () => resolve();
          s.onerror = () => reject(new Error('Failed to load Plaid Link'));
          document.body.appendChild(s);
        });

      await loadPlaidScript();

      const handler = (window as any).Plaid.create({
        token: linkToken,
        onSuccess: async (public_token: string, metadata: any) => {
          try {
            const selectedAccountId = metadata?.accounts?.[0]?.id || metadata?.account_id;
            if (!selectedAccountId) throw new Error('No account selected');

            toast.loading('Linking your bank to Moov…', { id: 'plaid-link' });
            const { error: linkErr } = await supabase.functions.invoke('moov-plaid-link-account', {
              body: {
                public_token,
                account_id: selectedAccountId,
                moov_account_id: accountId
              }
            });

            if (linkErr) throw linkErr;
            toast.success('Bank account linked successfully!', { id: 'plaid-link' });
            await fetchPayoutData();
          } catch (error: any) {
            console.error('Plaid link error:', error);
            toast.error(error?.message || 'Failed to link bank account', { id: 'plaid-link' });
          }
        },
        onExit: () => {
          setIsLinkingBank(false);
        }
      });

      handler.open();
    } catch (error: any) {
      console.error('Error initiating Plaid:', error);
      toast.error(error?.message || 'Failed to start bank linking');
      setIsLinkingBank(false);
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

  const totalEarnings = payouts
    .filter(p => !p.is_refunded)
    .reduce((sum, p) => sum + Number(p.payout_amount), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Onboarding Wizard Modal */}
      {showOnboardingWizard && (
        <PayoutOnboardingWizard
          onComplete={() => {
            setShowOnboardingWizard(false);
            setPayoutOnboardingCompleted(true);
            fetchPayoutData();
          }}
          onClose={() => setShowOnboardingWizard(false)}
        />
      )}

      {/* Payouts Notice */}
      {!payoutsEnabled && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <ClockIcon className="h-5 w-5 text-yellow-700" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-900 font-semibold">
                Payouts will be enabled before soft launch - all videos completed prior to launch
                will be paid out as soon as payouts are enabled.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Payout Onboarding Setup */}
      {!payoutOnboardingCompleted && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Complete Payout Setup</h3>
              <p className="text-sm text-gray-600 mt-1">
                Set up your payouts in 3 easy steps: W-9 form, identity verification, and bank account linking.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowOnboardingWizard(true)}
            disabled={!payoutsEnabled}
            className="inline-flex items-center px-6 py-3 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Setup Payouts
          </button>
          {!payoutsEnabled && (
            <p className="text-xs text-gray-500 mt-2">
              This button will be enabled when payouts are activated before soft launch.
            </p>
          )}
        </div>
      )}

      {/* Connected Bank Info */}
      {payoutOnboardingCompleted && bankInfo && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CreditCardIcon className="h-8 w-8 text-gray-400" />
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-gray-900">{bankInfo.bank_name}</h3>
                <p className="text-sm text-gray-600">
                  {bankInfo.account_type} •••• {bankInfo.account_number_masked?.slice(-4)}
                </p>
                <p className="text-xs text-gray-500 mt-1">{bankInfo.account_holder_name}</p>
              </div>
            </div>
            {bankInfo.is_verified ? (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                <CheckCircleIcon className="w-4 h-4 mr-1" />
                Verified
              </span>
            ) : (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
                <ClockIcon className="w-4 h-4 mr-1" />
                Pending
              </span>
            )}
          </div>
        </div>
      )}

      {/* Total Earnings Summary */}
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
          <p className="text-sm text-gray-500 mt-1">
            Payouts are batched weekly and processed on Mondays
          </p>
        </div>

        {batches.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <CurrencyDollarIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No payouts yet</h3>
            <p className="mt-1 text-sm text-gray-500">Complete orders to start earning!</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {batches.map((batch) => {
              const weekPayouts = getWeekPayouts(batch.week_start_date);
              const isExpanded = selectedWeek === batch.week_start_date;

              return (
                <div key={batch.id} className="px-6 py-4">
                  <button
                    onClick={() =>
                      setSelectedWeek(isExpanded ? null : batch.week_start_date)
                    }
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
                                ({weekPayouts.filter((p) => p.is_refunded).length} refunded)
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
                              (${batch.total_payout_amount.toFixed(2)} - $
                              {batch.total_refunded_amount.toFixed(2)} refunds)
                            </div>
                          )}
                        </div>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                            batch.status
                          )}`}
                        >
                          {batch.status}
                        </span>
                      </div>
                    </div>
                  </button>

                  {/* Expanded: Show individual payouts */}
                  {isExpanded && (
                    <div className="mt-4 ml-10 space-y-3">
                      {weekPayouts.map((payout: any) => (
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
                            <div
                              className={`font-semibold ${
                                payout.is_refunded
                                  ? 'text-red-600 line-through'
                                  : 'text-gray-900'
                              }`}
                            >
                              ${payout.payout_amount.toFixed(2)}
                            </div>
                            <div className="text-xs text-gray-500">
                              ${payout.order_amount.toFixed(2)} - {payout.admin_fee_percentage}%
                              fee
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
    </div>
  );
};

export default IntegratedPayoutsDashboard;

