import React, { useState, useEffect } from 'react';
import { MagnifyingGlassIcon, PhoneIcon, CalendarIcon, TagIcon, ArrowDownTrayIcon, TrophyIcon, CheckCircleIcon, GiftIcon } from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolid } from '@heroicons/react/24/solid';
import { supabase } from '../../services/supabase';
import toast from 'react-hot-toast';

interface PromoSignup {
  id: string;
  phone_number: string;
  subscribed_at: string;
  source: string;
  utm_source: string | null;
  reminder_sent_at: string | null;
  is_winner?: boolean;
  winner_notified_at?: string | null;
}


const HolidayPromoSignups: React.FC = () => {
  const [signups, setSignups] = useState<PromoSignup[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterUtm, setFilterUtm] = useState<string>('all');
  const [utmSources, setUtmSources] = useState<string[]>([]);
  const [selectedWinners, setSelectedWinners] = useState<Set<string>>(new Set());
  const [sendingNotification, setSendingNotification] = useState(false);

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
      const uniqueUtms = Array.from(new Set(data?.map(s => s.utm_source).filter(Boolean) || []));
      setUtmSources(uniqueUtms as string[]);
    } catch (error) {
      console.error('Error fetching signups:', error);
      toast.error('Failed to load signups');
    } finally {
      setLoading(false);
    }
  };

  const toggleWinnerSelection = (signupId: string) => {
    const newSelected = new Set(selectedWinners);
    if (newSelected.has(signupId)) {
      newSelected.delete(signupId);
    } else {
      if (newSelected.size >= 3) {
        toast.error('You can only select 3 winners at a time');
        return;
      }
      newSelected.add(signupId);
    }
    setSelectedWinners(newSelected);
  };

  const confirmWinners = async () => {
    if (selectedWinners.size === 0) {
      toast.error('Please select at least one winner');
      return;
    }

    setSendingNotification(true);
    
    try {
      const selectedSignups = signups.filter(s => selectedWinners.has(s.id));
      
      for (const signup of selectedSignups) {
        // Send winning SMS notification
        const winningMessage = `You won a free ShoutOut 🎉 (up to $100 value) you can order on shoutout.us with code Winner100 to claim your $100 credit, expires in 24 hrs https://shoutout.us`;
        
        const { error: smsError } = await supabase.functions.invoke('send-sms', {
          body: {
            to: signup.phone_number,
            message: winningMessage,
            from: 'user' // Use user number for giveaway
          }
        });

        if (smsError) {
          console.error('Error sending SMS:', smsError);
          toast.error(`Failed to notify ${signup.phone_number}`);
        }

        // Update beta_signups to mark as winner
        await supabase
          .from('beta_signups')
          .update({ 
            is_winner: true,
            winner_notified_at: new Date().toISOString()
          })
          .eq('id', signup.id);
      }

      toast.success(`🎉 ${selectedSignups.length} winner(s) notified!`);
      setSelectedWinners(new Set());
      fetchSignups();
    } catch (error) {
      console.error('Error confirming winners:', error);
      toast.error('Failed to confirm winners');
    } finally {
      setSendingNotification(false);
    }
  };

  const isAlreadyWinner = (signup: PromoSignup) => {
    return signup.is_winner === true;
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
          <h2 className="text-2xl font-bold text-gray-900">🎁 Giveaway Signups</h2>
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

      {/* Main Content - Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side - Signups Table (2/3 width) */}
        <div className="lg:col-span-2 space-y-4">
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

          {/* Selection Info */}
          {selectedWinners.size > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrophyIcon className="h-5 w-5 text-yellow-600" />
                <span className="text-yellow-800 font-medium">
                  {selectedWinners.size} winner{selectedWinners.size > 1 ? 's' : ''} selected
                </span>
              </div>
              <button
                onClick={confirmWinners}
                disabled={sendingNotification}
                className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {sendingNotification ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Sending...
                  </>
                ) : (
                  <>
                    <GiftIcon className="h-5 w-5" />
                    Confirm & Notify Winners
                  </>
                )}
              </button>
            </div>
          )}

          {/* Table */}
          <div className="glass rounded-2xl overflow-hidden">
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50/50 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Select
                    </th>
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
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white/50 divide-y divide-gray-200">
                  {filteredSignups.map((signup) => {
                    const alreadyWinner = isAlreadyWinner(signup);
                    const isSelected = selectedWinners.has(signup.id);
                    
                    return (
                      <tr 
                        key={signup.id} 
                        className={`hover:bg-gray-50/50 ${alreadyWinner ? 'bg-green-50/50' : ''} ${isSelected ? 'bg-yellow-50/50' : ''}`}
                      >
                        <td className="px-4 py-3 whitespace-nowrap">
                          {alreadyWinner ? (
                            <CheckCircleSolid className="h-6 w-6 text-green-500" title="Already a winner" />
                          ) : (
                            <button
                              onClick={() => toggleWinnerSelection(signup.id)}
                              className={`h-6 w-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                                isSelected 
                                  ? 'bg-yellow-500 border-yellow-500 text-white' 
                                  : 'border-gray-300 hover:border-yellow-500'
                              }`}
                            >
                              {isSelected && <CheckCircleIcon className="h-4 w-4" />}
                            </button>
                          )}
                        </td>
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
                            {new Date(signup.subscribed_at).toLocaleDateString()}
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
                          {alreadyWinner ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                              <TrophyIcon className="h-3 w-3" />
                              Winner
                            </span>
                          ) : (
                            <span className="text-gray-400 text-sm">—</span>
                          )}
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

        {/* Right Side - Winners Panel (1/3 width) */}
        <div className="space-y-4">
          <div className="glass rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <TrophyIcon className="h-6 w-6 text-yellow-500" />
              <h3 className="text-lg font-bold text-gray-900">Select Winners</h3>
            </div>
            
            <p className="text-sm text-gray-600 mb-4">
              Select up to 3 people from the table and click "Confirm & Notify Winners" to send them the winning SMS with coupon code <strong>Winner100</strong>.
            </p>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-yellow-800">
                <strong>Coupon:</strong> Winner100<br/>
                <strong>Value:</strong> $100 off<br/>
                <strong>Expires:</strong> 24 hours after sending
              </p>
            </div>

            <div className="border-t border-gray-200 pt-4">
              <h4 className="font-medium text-gray-900 mb-3">
                Previous Winners ({signups.filter(s => s.is_winner).length})
              </h4>
              
              {signups.filter(s => s.is_winner).length === 0 ? (
                <p className="text-sm text-gray-500 italic">No winners selected yet</p>
              ) : (
                <div className="space-y-3 max-h-[300px] overflow-y-auto">
                  {signups.filter(s => s.is_winner).map((winner) => (
                    <div 
                      key={winner.id}
                      className="bg-green-50 border border-green-200 rounded-lg p-3"
                    >
                      <div className="flex items-center gap-2">
                        <TrophyIcon className="h-5 w-5 text-yellow-500" />
                        <span className="font-medium text-gray-900">
                          {formatPhoneNumber(winner.phone_number)}
                        </span>
                      </div>
                      {winner.winner_notified_at && (
                        <p className="text-xs text-gray-500 mt-1">
                          Notified {new Date(winner.winner_notified_at).toLocaleString()}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Winning Message Preview */}
          <div className="glass rounded-2xl p-6">
            <h4 className="font-medium text-gray-900 mb-3">📱 Winning Message Preview</h4>
            <div className="bg-gray-100 rounded-lg p-4 text-sm text-gray-700">
              You won a free ShoutOut 🎉 (up to $100 value) you can order on shoutout.us with code Winner100 to claim your $100 credit, expires in 24 hrs https://shoutout.us
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HolidayPromoSignups;
