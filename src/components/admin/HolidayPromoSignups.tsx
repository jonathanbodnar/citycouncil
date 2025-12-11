import React, { useState, useEffect } from 'react';
import { MagnifyingGlassIcon, PhoneIcon, CalendarIcon, TagIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { supabase } from '../../services/supabase';
import toast from 'react-hot-toast';

interface PromoSignup {
  id: string;
  phone_number: string;
  subscribed_at: string;
  source: string;
  utm_source: string | null;
  reminder_sent_at: string | null;
}

const HolidayPromoSignups: React.FC = () => {
  const [signups, setSignups] = useState<PromoSignup[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterUtm, setFilterUtm] = useState<string>('all');
  const [utmSources, setUtmSources] = useState<string[]>([]);

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
      
      // Extract unique UTM sources
      const uniqueUtms = [...new Set(data?.map(s => s.utm_source).filter(Boolean) || [])];
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
    return matchesSearch && matchesUtm;
  });

  const formatPhoneNumber = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }
    return phone;
  };

  const exportToCSV = () => {
    const headers = ['Phone Number', 'Signed Up', 'UTM Source', 'Reminder Sent'];
    const rows = filteredSignups.map(s => [
      s.phone_number,
      new Date(s.subscribed_at).toLocaleString(),
      s.utm_source || '',
      s.reminder_sent_at ? new Date(s.reminder_sent_at).toLocaleString() : ''
    ]);
    
    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `holiday-promo-signups-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('Exported to CSV');
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
          <h2 className="text-2xl font-bold text-gray-900">🎄 Holiday Promo Signups</h2>
          <p className="text-gray-600">{signups.length} total signups</p>
        </div>
        <button
          onClick={exportToCSV}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          <ArrowDownTrayIcon className="h-5 w-5" />
          Export CSV
        </button>
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
      </div>

      {/* Stats by UTM */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="glass rounded-xl p-4">
          <p className="text-sm text-gray-600">Total</p>
          <p className="text-2xl font-bold text-gray-900">{signups.length}</p>
        </div>
        <div className="glass rounded-xl p-4">
          <p className="text-sm text-gray-600">No UTM</p>
          <p className="text-2xl font-bold text-gray-900">
            {signups.filter(s => !s.utm_source).length}
          </p>
        </div>
        {utmSources.slice(0, 2).map(utm => (
          <div key={utm} className="glass rounded-xl p-4">
            <p className="text-sm text-gray-600">{utm}</p>
            <p className="text-2xl font-bold text-gray-900">
              {signups.filter(s => s.utm_source === utm).length}
            </p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="glass rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Phone Number
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Signed Up
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  UTM Source
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Reminder Sent
                </th>
              </tr>
            </thead>
            <tbody className="bg-white/50 divide-y divide-gray-200">
              {filteredSignups.map((signup) => (
                <tr key={signup.id} className="hover:bg-gray-50/50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <PhoneIcon className="h-4 w-4 text-gray-400" />
                      <span className="font-medium text-gray-900">
                        {formatPhoneNumber(signup.phone_number)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <CalendarIcon className="h-4 w-4" />
                      {new Date(signup.subscribed_at).toLocaleString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {signup.utm_source ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                        <TagIcon className="h-3 w-3" />
                        {signup.utm_source}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-sm">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {signup.reminder_sent_at 
                      ? new Date(signup.reminder_sent_at).toLocaleString()
                      : <span className="text-gray-400">Not sent</span>
                    }
                  </td>
                </tr>
              ))}
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

