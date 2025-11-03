import React, { useState, useEffect } from 'react';
import { 
  BanknotesIcon, 
  CreditCardIcon, 
  ArrowDownTrayIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  PlusIcon
} from '@heroicons/react/24/outline';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { Payout, VendorBankInfo } from '../types';
import { lunarPayService } from '../services/lunarPayService';
import { bankAccountService } from '../services/bankAccountService';
import SecureBankInput from './SecureBankInput';
import toast from 'react-hot-toast';
import MoovOnboard from '../pages/MoovOnboard';

interface PayoutWithOrder extends Payout {
  orders: {
    id: string;
    request_details: string;
    created_at: string;
    amount: number;
  };
}

const PayoutsDashboard: React.FC = () => {
  const { user } = useAuth();
  const [payouts, setPayouts] = useState<PayoutWithOrder[]>([]);
  const [bankInfo, setBankInfo] = useState<VendorBankInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [showBankForm, setShowBankForm] = useState(false);
  const [bankFormData, setBankFormData] = useState({
    account_holder_name: '',
    bank_name: '',
    account_number: '',
    routing_number: '',
    account_type: 'checking' as 'checking' | 'savings'
  });

  useEffect(() => {
    if (user?.user_type === 'talent') {
      fetchPayoutData();
    }
  }, [user]);

  const fetchPayoutData = async () => {
    try {
      setLoading(true);

      // Get talent profile to get talent ID
      const { data: talentProfile } = await supabase
        .from('talent_profiles')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      if (!talentProfile) return;

      // Fetch payouts
      const { data: payoutsData, error: payoutsError } = await supabase
        .from('payouts')
        .select(`
          *,
          orders (
            id,
            request_details,
            created_at,
            amount
          )
        `)
        .eq('talent_id', talentProfile.id)
        .order('created_at', { ascending: false });

      if (payoutsError) throw payoutsError;

      // Fetch bank info (masked for display)
      const bankData = await bankAccountService.getBankAccountForDisplay(talentProfile.id);

      setPayouts(payoutsData || []);
      setBankInfo(bankData);

    } catch (error) {
      console.error('Error fetching payout data:', error);
      toast.error('Failed to load payout information');
    } finally {
      setLoading(false);
    }
  };

  const handleBankInfoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Get talent profile
      const { data: talentProfile } = await supabase
        .from('talent_profiles')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      if (!talentProfile) throw new Error('Talent profile not found');

      // Use secure bank account service with encryption
      await bankAccountService.updateBankAccount(talentProfile.id, {
        account_holder_name: bankFormData.account_holder_name,
        bank_name: bankFormData.bank_name,
        account_number: bankFormData.account_number,
        routing_number: bankFormData.routing_number,
        account_type: bankFormData.account_type
      });

      toast.success('Bank information encrypted and saved securely');
      setShowBankForm(false);
      fetchPayoutData();

    } catch (error) {
      console.error('Error saving bank info:', error);
      toast.error('Failed to save bank information');
    }
  };

  const exportPayouts = () => {
    if (payouts.length === 0) {
      toast.error('No payouts to export');
      return;
    }

    // Create CSV content
    const headers = ['Date', 'Order ID', 'Description', 'Amount', 'Status', 'Processed Date'];
    const csvContent = [
      headers.join(','),
      ...payouts.map(payout => [
        new Date(payout.created_at).toLocaleDateString(),
        payout.order_id,
        `"${payout.orders.request_details.substring(0, 50)}..."`,
        `$${payout.amount.toFixed(2)}`,
        payout.status,
        payout.processed_at ? new Date(payout.processed_at).toLocaleDateString() : 'N/A'
      ].join(','))
    ].join('\n');

    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payouts_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    toast.success('Payouts exported successfully');
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'processed':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <XCircleIcon className="h-5 w-5 text-red-500" />;
      case 'pending':
        return <ClockIcon className="h-5 w-5 text-yellow-500" />;
      default:
        return <ClockIcon className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'processed':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const totalEarnings = payouts
    .filter(p => p.status === 'processed')
    .reduce((sum, p) => sum + p.amount, 0);

  const pendingEarnings = payouts
    .filter(p => p.status === 'pending')
    .reduce((sum, p) => sum + p.amount, 0);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-gray-200 h-24 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Payouts</h2>
        <div className="flex gap-3 items-center">
        <MoovOnboard/>

          <button
            onClick={exportPayouts}
            className="flex h-14 w-full text-center justify-center items-center gap-2  px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <ArrowDownTrayIcon className="h-4 w-4" />
            Export CSV
          </button>
          {!bankInfo && (
            <button
              onClick={() => setShowBankForm(true)}
              className="flex h-14 w-full text-center justify-center items-center text-nowrap gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <PlusIcon className="h-4 w-4" />
              Add Bank Info
            </button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center">
            <BanknotesIcon className="h-8 w-8 text-green-500" />
            <div className="ml-4">
              <p className="text-sm text-gray-600">Total Earnings</p>
              <p className="text-2xl font-bold text-gray-900">${totalEarnings.toFixed(2)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center">
            <ClockIcon className="h-8 w-8 text-yellow-500" />
            <div className="ml-4">
              <p className="text-sm text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-gray-900">${pendingEarnings.toFixed(2)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center">
            <CreditCardIcon className="h-8 w-8 text-blue-500" />
            <div className="ml-4">
              <p className="text-sm text-gray-600">Total Payouts</p>
              <p className="text-2xl font-bold text-gray-900">{payouts.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bank Information */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Bank Information</h3>
        {bankInfo ? (
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Account Holder</p>
                <p className="font-medium">{bankInfo.account_holder_name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Bank Name</p>
                <p className="font-medium">{bankInfo.bank_name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Account Number</p>
                <p className="font-medium font-mono">{bankInfo.account_number_masked || `****${bankInfo.account_number?.slice(-4) || ''}`}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Status</p>
                <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                  bankInfo.is_verified ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {bankInfo.is_verified ? 'Verified' : 'Pending Verification'}
                </span>
              </div>
            </div>
            <button
              onClick={() => setShowBankForm(true)}
              className="mt-4 text-sm text-blue-600 hover:text-blue-700 underline"
            >
              Update Bank Information
            </button>
          </div>
        ) : (
          <div className="text-center py-8">
            <CreditCardIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">No bank information on file</p>
            <button
              onClick={() => setShowBankForm(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Add Bank Information
            </button>
          </div>
        )}
      </div>

      {/* Bank Form Modal */}
      {showBankForm && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
          <div className="glass-strong rounded-2xl p-8 w-full max-w-md border border-white/30 shadow-modern-xl" style={{ background: 'rgba(255, 255, 255, 0.25)', backdropFilter: 'blur(30px)' }}>
            <h3 className="text-lg font-semibold mb-4">
              {bankInfo ? 'Update' : 'Add'} Bank Information
            </h3>
            <form onSubmit={handleBankInfoSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Account Holder Name
                </label>
                <input
                  type="text"
                  required
                  value={bankFormData.account_holder_name}
                  onChange={(e) => setBankFormData({...bankFormData, account_holder_name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bank Name
                </label>
                <input
                  type="text"
                  required
                  value={bankFormData.bank_name}
                  onChange={(e) => setBankFormData({...bankFormData, bank_name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <SecureBankInput
                label="Account Number"
                type="account"
                value={bankFormData.account_number}
                onChange={(value) => setBankFormData({...bankFormData, account_number: value})}
                placeholder="Enter account number"
                required={true}
                maxLength={17}
              />
              
              <SecureBankInput
                label="Routing Number"
                type="routing"
                value={bankFormData.routing_number}
                onChange={(value) => setBankFormData({...bankFormData, routing_number: value})}
                placeholder="9-digit routing number"
                required={true}
                pattern="[0-9]{9}"
                maxLength={9}
              />
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Account Type
                </label>
                <select
                  value={bankFormData.account_type}
                  onChange={(e) => setBankFormData({...bankFormData, account_type: e.target.value as 'checking' | 'savings'})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="checking">Checking</option>
                  <option value="savings">Savings</option>
                </select>
              </div>
              
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowBankForm(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payouts List */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Payout History</h3>
        </div>
        
        {payouts.length > 0 ? (
          <div className="divide-y divide-gray-200">
            {payouts.map((payout) => (
              <div key={payout.id} className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(payout.status)}
                    <div>
                      <p className="font-medium text-gray-900">
                        Order #{payout.order_id.slice(-8)}
                      </p>
                      <p className="text-sm text-gray-600">
                        {payout.orders.request_details.substring(0, 60)}...
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(payout.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">
                      ${payout.amount.toFixed(2)}
                    </p>
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(payout.status)}`}>
                      {payout.status}
                    </span>
                    {payout.processed_at && (
                      <p className="text-xs text-gray-500 mt-1">
                        Processed {new Date(payout.processed_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <BanknotesIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No payouts yet</h3>
            <p className="text-gray-600">Payouts will appear here when orders are completed.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PayoutsDashboard;
