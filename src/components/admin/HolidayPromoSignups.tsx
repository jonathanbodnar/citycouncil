import React, { useState, useEffect } from 'react';
import { MagnifyingGlassIcon, PhoneIcon, CalendarIcon, TagIcon, ArrowDownTrayIcon, GiftIcon, TrashIcon } from '@heroicons/react/24/outline';
import { supabase } from '../../services/supabase';
import toast from 'react-hot-toast';

interface PromoSignup {
  id: string;
  phone_number: string;
  subscribed_at: string;
  source: string;
  utm_source: string | null;
  prize_won: string | null;
}

const PRIZE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  FREE_SHOUTOUT: { label: '🏆 Free ShoutOut', color: 'text-yellow-800', bg: 'bg-yellow-100' },
  '25_OFF': { label: '25% Off', color: 'text-purple-800', bg: 'bg-purple-100' },
  '15_OFF': { label: '15% Off', color: 'text-blue-800', bg: 'bg-blue-100' },
  '10_OFF': { label: '10% Off', color: 'text-green-800', bg: 'bg-green-100' },
  '25_DOLLARS': { label: '$25 Off', color: 'text-pink-800', bg: 'bg-pink-100' },
};

const HolidayPromoSignups: React.FC = () => {
  const [signups, setSignups] = useState<PromoSignup[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterUtm, setFilterUtm] = useState<string>('all');
  const [filterPrize, setFilterPrize] = useState<string>('all');
  const [utmSources, setUtmSources] = useState<string[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchSignups();
  }, []);

  const fetchSignups = async () => {
    try {
      const { data, error } = await supabase
        .from('beta_signups')
        .select('*')
        .eq('source', 'holiday_popup')
        .order('subscribed_at', { ascending: false });

      if (error) throw error;
      
      setSignups(data || []);
      
      const uniqueUtms = Array.from(new Set(data?.map(s => s.utm_source).filter(Boolean) || []));
      setUtmSources(uniqueUtms as string[]);
    } catch (error) {
      console.error('Error fetching signups:', error);
      toast.error('Failed to load signups');
    } finally {
      setLoading(false);
    }
  };

  const filteredSignups = signups.filter(signup => {
    const matchesSearch = signup.phone_number.includes(search);
    const matchesUtm = filterUtm === 'all' || 
      (filterUtm === 'none' ? !signup.utm_source : signup.utm_source === filterUtm);
    const matchesPrize = filterPrize === 'all' || signup.prize_won === filterPrize;
    return matchesSearch && matchesUtm && matchesPrize;
  });

  const formatPhoneNumber = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }
    return phone;
  };

  const exportToCSV = () => {
    const headers = ['Phone Number', 'Signed Up', 'UTM Source', 'Prize Won'];
    const rows = filteredSignups.map(s => [
      s.phone_number,
      new Date(s.subscribed_at).toLocaleString(),
      s.utm_source || '',
      s.prize_won ? PRIZE_LABELS[s.prize_won]?.label || s.prize_won : ''
    ]);
    
    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `giveaway-signups-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('Exported to CSV');
  };

  const handleDelete = async (signup: PromoSignup) => {
    if (!window.confirm(`Delete ${formatPhoneNumber(signup.phone_number)} from the giveaway?`)) {
      return;
    }

    setDeletingId(signup.id);
    try {
      const { error } = await supabase
        .from('beta_signups')
        .delete()
        .eq('id', signup.id);

      if (error) throw error;

      toast.success('Entry deleted');
      fetchSignups();
    } catch (error) {
      console.error('Error deleting entry:', error);
      toast.error('Failed to delete entry');
    } finally {
      setDeletingId(null);
    }
  };

  // Calculate prize statistics
  const prizeStats = {
    FREE_SHOUTOUT: signups.filter(s => s.prize_won === 'FREE_SHOUTOUT').length,
    '25_OFF': signups.filter(s => s.prize_won === '25_OFF').length,
    '15_OFF': signups.filter(s => s.prize_won === '15_OFF').length,
    '10_OFF': signups.filter(s => s.prize_won === '10_OFF').length,
    '25_DOLLARS': signups.filter(s => s.prize_won === '25_DOLLARS').length,
    none: signups.filter(s => !s.prize_won).length,
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">🎁 Instant Giveaway</h2>
          <p className="text-gray-600">{signups.length} total entries</p>
        </div>
        <button
          onClick={exportToCSV}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          <ArrowDownTrayIcon className="h-5 w-5" />
          Export CSV
        </button>
      </div>

      {/* Prize Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="glass rounded-xl p-4">
          <p className="text-sm text-gray-600">Total</p>
          <p className="text-2xl font-bold text-gray-900">{signups.length}</p>
        </div>
        <div className="glass rounded-xl p-4 border-2 border-yellow-300">
          <p className="text-sm text-yellow-700">🏆 Free ShoutOut</p>
          <p className="text-2xl font-bold text-yellow-600">{prizeStats.FREE_SHOUTOUT}</p>
        </div>
        <div className="glass rounded-xl p-4">
          <p className="text-sm text-purple-600">25% Off</p>
          <p className="text-2xl font-bold text-purple-700">{prizeStats['25_OFF']}</p>
        </div>
        <div className="glass rounded-xl p-4">
          <p className="text-sm text-blue-600">15% Off</p>
          <p className="text-2xl font-bold text-blue-700">{prizeStats['15_OFF']}</p>
        </div>
        <div className="glass rounded-xl p-4">
          <p className="text-sm text-green-600">10% Off</p>
          <p className="text-2xl font-bold text-green-700">{prizeStats['10_OFF']}</p>
        </div>
        <div className="glass rounded-xl p-4">
          <p className="text-sm text-pink-600">$25 Off</p>
          <p className="text-2xl font-bold text-pink-700">{prizeStats['25_DOLLARS']}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search phone number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
        <select
          value={filterUtm}
          onChange={(e) => setFilterUtm(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        >
          <option value="all">All Sources</option>
          <option value="none">No UTM</option>
          {utmSources.map(utm => (
            <option key={utm} value={utm}>{utm}</option>
          ))}
        </select>
        <select
          value={filterPrize}
          onChange={(e) => setFilterPrize(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        >
          <option value="all">All Prizes</option>
          <option value="FREE_SHOUTOUT">🏆 Free ShoutOut</option>
          <option value="25_OFF">25% Off</option>
          <option value="15_OFF">15% Off</option>
          <option value="10_OFF">10% Off</option>
          <option value="25_DOLLARS">$25 Off</option>
        </select>
      </div>

      {/* Table */}
      <div className="glass rounded-2xl overflow-hidden">
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50/50 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Phone Number
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Signed Up
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  UTM
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Prize Won
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white/50 divide-y divide-gray-200">
              {filteredSignups.map((signup) => {
                const prizeInfo = signup.prize_won ? PRIZE_LABELS[signup.prize_won] : null;
                return (
                  <tr 
                    key={signup.id} 
                    className={`hover:bg-gray-50/50 ${signup.prize_won === 'FREE_SHOUTOUT' ? 'bg-yellow-50/50' : ''}`}
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <PhoneIcon className="h-4 w-4 text-gray-400" />
                        <span className="font-medium text-gray-900">
                          {formatPhoneNumber(signup.phone_number)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <CalendarIcon className="h-4 w-4" />
                        {new Date(signup.subscribed_at).toLocaleDateString()} {new Date(signup.subscribed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {signup.utm_source ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                          <TagIcon className="h-3 w-3" />
                          {signup.utm_source}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-sm">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {prizeInfo ? (
                        <span className={`inline-flex items-center gap-1 px-3 py-1 ${prizeInfo.bg} ${prizeInfo.color} text-xs font-medium rounded-full`}>
                          <GiftIcon className="h-3 w-3" />
                          {prizeInfo.label}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-sm">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <button
                        onClick={() => handleDelete(signup)}
                        disabled={deletingId === signup.id}
                        className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                        title="Delete entry"
                      >
                        {deletingId === signup.id ? (
                          <div className="animate-spin h-4 w-4 border-2 border-red-500 border-t-transparent rounded-full"></div>
                        ) : (
                          <TrashIcon className="h-4 w-4" />
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        {filteredSignups.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No signups found
          </div>
        )}
      </div>
    </div>
  );
};

export default HolidayPromoSignups;
