import React, { useEffect, useState } from 'react';
import { supabase } from '../../services/supabase';
import toast from 'react-hot-toast';
import { MagnifyingGlassIcon, PlusIcon, ClockIcon, CurrencyDollarIcon } from '@heroicons/react/24/outline';

interface User {
  id: string;
  email: string;
  full_name: string;
  credits: number;
  user_type: string;
}

interface CreditTransaction {
  id: string;
  user_id: string;
  amount: number;
  balance_after: number;
  transaction_type: string;
  order_id: string | null;
  admin_id: string | null;
  notes: string | null;
  created_at: string;
  users: {
    full_name: string;
    email: string;
  };
  admin: {
    full_name: string;
  } | null;
}

const CreditsManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [grantingCredits, setGrantingCredits] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [creditAmount, setCreditAmount] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch users with credits
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, email, full_name, credits, user_type')
        .eq('user_type', 'user')
        .order('credits', { ascending: false });

      if (usersError) throw usersError;
      setUsers(usersData || []);

      // Fetch recent credit transactions
      const { data: transactionsData, error: transactionsError } = await supabase
        .from('credit_transactions')
        .select(`
          *,
          users!credit_transactions_user_id_fkey (full_name, email),
          admin:users!credit_transactions_admin_id_fkey (full_name)
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (transactionsError) throw transactionsError;
      setTransactions(transactionsData || []);

    } catch (error) {
      console.error('Error fetching credit data:', error);
      toast.error('Failed to load credit data');
    } finally {
      setLoading(false);
    }
  };

  const handleGrantCredits = async () => {
    if (!selectedUser || !creditAmount || parseFloat(creditAmount) <= 0) {
      toast.error('Please select a user and enter a valid credit amount');
      return;
    }

    try {
      setGrantingCredits(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase.rpc('grant_user_credits', {
        target_user_id: selectedUser.id,
        credit_amount: parseFloat(creditAmount),
        admin_user_id: user.id,
        grant_notes: notes.trim() || null
      });

      if (error) throw error;

      if (data?.success) {
        toast.success(`Granted $${creditAmount} in credits to ${selectedUser.full_name}`);
        setCreditAmount('');
        setNotes('');
        setSelectedUser(null);
        fetchData();
      } else {
        throw new Error(data?.error || 'Failed to grant credits');
      }

    } catch (error: any) {
      console.error('Error granting credits:', error);
      toast.error(error.message || 'Failed to grant credits');
    } finally {
      setGrantingCredits(false);
    }
  };

  const filteredUsers = users.filter(user =>
    user.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getTransactionColor = (type: string) => {
    switch (type) {
      case 'admin_grant':
        return 'text-green-600 bg-green-50';
      case 'order_payment':
        return 'text-blue-600 bg-blue-50';
      case 'refund':
        return 'text-purple-600 bg-purple-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getTransactionLabel = (type: string) => {
    switch (type) {
      case 'admin_grant':
        return 'Credits Added';
      case 'order_payment':
        return 'Used for Order';
      case 'refund':
        return 'Refund';
      default:
        return type;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Grant Credits Section */}
      <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl p-6 border border-blue-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <PlusIcon className="h-5 w-5 mr-2 text-blue-600" />
          Grant Credits to User
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select User
            </label>
            <select
              value={selectedUser?.id || ''}
              onChange={(e) => {
                const user = users.find(u => u.id === e.target.value);
                setSelectedUser(user || null);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 !bg-white !text-gray-900"
              style={{ backgroundColor: 'white', color: '#111827' }}
            >
              <option value="">Choose a user...</option>
              {users.map(user => (
                <option key={user.id} value={user.id}>
                  {user.full_name} ({user.email}) - ${user.credits.toFixed(2)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Credit Amount ($)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={creditAmount}
              onChange={(e) => setCreditAmount(e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 !bg-white !text-gray-900 placeholder:text-gray-400"
              style={{ backgroundColor: 'white', color: '#111827' }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Reason for credit..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 !bg-white !text-gray-900 placeholder:text-gray-400"
              style={{ backgroundColor: 'white', color: '#111827' }}
            />
          </div>
        </div>

        <button
          onClick={handleGrantCredits}
          disabled={!selectedUser || !creditAmount || grantingCredits}
          className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {grantingCredits ? 'Granting Credits...' : 'Grant Credits'}
        </button>
      </div>

      {/* Users with Credits */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <CurrencyDollarIcon className="h-5 w-5 mr-2 text-green-600" />
              Users with Credits
            </h3>
            <span className="text-sm text-gray-600">
              Total: {users.reduce((sum, u) => sum + u.credits, 0).toFixed(2)} credits
            </span>
          </div>
          
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 !bg-white !text-gray-900 placeholder:text-gray-400"
              style={{ backgroundColor: 'white', color: '#111827' }}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Credits</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredUsers.length > 0 ? (
                filteredUsers.map(user => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {user.full_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {user.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className={`text-sm font-semibold ${
                        user.credits > 0 ? 'text-green-600' : 'text-gray-400'
                      }`}>
                        ${user.credits.toFixed(2)}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-gray-500">
                    No users found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <ClockIcon className="h-5 w-5 mr-2 text-gray-600" />
            Recent Credit Transactions
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Balance After</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {transactions.length > 0 ? (
                transactions.map(txn => (
                  <tr key={txn.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {new Date(txn.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div>{txn.users.full_name}</div>
                      <div className="text-xs text-gray-500">{txn.users.email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTransactionColor(txn.transaction_type)}`}>
                        {getTransactionLabel(txn.transaction_type)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className={`text-sm font-semibold ${
                        txn.amount > 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {txn.amount > 0 ? '+' : ''}${txn.amount.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-600">
                      ${txn.balance_after.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {txn.notes || '-'}
                      {txn.admin && (
                        <div className="text-xs text-gray-500 mt-1">
                          by {txn.admin.full_name}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    No transactions yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default CreditsManagement;

