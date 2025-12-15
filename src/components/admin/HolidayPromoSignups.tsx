import React, { useState, useEffect, useCallback } from 'react';
import { MagnifyingGlassIcon, PhoneIcon, CalendarIcon, TagIcon, ArrowDownTrayIcon, TrophyIcon, XMarkIcon } from '@heroicons/react/24/outline';
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
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const [showWinnerModal, setShowWinnerModal] = useState(false);
  const [lastWinnerPhone, setLastWinnerPhone] = useState<string>('');
  const [countdown, setCountdown] = useState({ hours: 24, minutes: 0, seconds: 0 });

  useEffect(() => {
    fetchSignups();
  }, []);

  // Countdown timer effect
  useEffect(() => {
    if (!showWinnerModal) return;
    
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev.seconds > 0) {
          return { ...prev, seconds: prev.seconds - 1 };
        } else if (prev.minutes > 0) {
          return { ...prev, minutes: prev.minutes - 1, seconds: 59 };
        } else if (prev.hours > 0) {
          return { hours: prev.hours - 1, minutes: 59, seconds: 59 };
        }
        return prev;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [showWinnerModal]);

  // Blur phone number - show first 4 digits, blur last 7
  const blurPhoneNumber = useCallback((phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length >= 10) {
      const visible = cleaned.slice(0, 4);
      return `+${visible[0]} (${visible.slice(1)}) •••-••••`;
    }
    return phone.slice(0, 4) + '•'.repeat(Math.max(0, phone.length - 4));
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

  const selectWinner = async (signup: PromoSignup) => {
    if (signup.is_winner) {
      toast.error('This person is already a winner');
      return;
    }

    setSendingTo(signup.id);
    
    try {
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
        toast.error(`Failed to send SMS to ${formatPhoneNumber(signup.phone_number)}`);
        return;
      }

      // Update beta_signups to mark as winner
      const { error: updateError } = await supabase
        .from('beta_signups')
        .update({ 
          is_winner: true,
          winner_notified_at: new Date().toISOString()
        })
        .eq('id', signup.id);

      if (updateError) {
        console.error('Error updating winner status:', updateError);
      }

      toast.success(`🎉 Winner selected! SMS sent to ${formatPhoneNumber(signup.phone_number)}`);
      
      // Show winner celebration modal
      setLastWinnerPhone(signup.phone_number);
      setCountdown({ hours: 24, minutes: 0, seconds: 0 });
      setShowWinnerModal(true);
      
      fetchSignups();
    } catch (error) {
      console.error('Error selecting winner:', error);
      toast.error('Failed to select winner');
    } finally {
      setSendingTo(null);
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
    const headers = ['Phone Number', 'Signed Up', 'UTM Source', 'Winner', 'Notified At'];
    const rows = filteredSignups.map(s => [
      s.phone_number,
      new Date(s.subscribed_at).toLocaleString(),
      s.utm_source || '',
      s.is_winner ? 'Yes' : 'No',
      s.winner_notified_at ? new Date(s.winner_notified_at).toLocaleString() : ''
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

  const winners = signups.filter(s => s.is_winner);

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
          <p className="text-gray-600">{signups.length} total signups • {winners.length} winners selected</p>
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

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="glass rounded-xl p-4">
              <p className="text-sm text-gray-600">Total</p>
              <p className="text-2xl font-bold text-gray-900">{signups.length}</p>
            </div>
            <div className="glass rounded-xl p-4">
              <p className="text-sm text-gray-600">Winners</p>
              <p className="text-2xl font-bold text-yellow-600">{winners.length}</p>
            </div>
            <div className="glass rounded-xl p-4">
              <p className="text-sm text-gray-600">No UTM</p>
              <p className="text-2xl font-bold text-gray-900">
                {signups.filter(s => !s.utm_source).length}
              </p>
            </div>
            {utmSources.slice(0, 1).map(utm => (
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
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white/50 divide-y divide-gray-200">
                  {filteredSignups.map((signup) => (
                    <tr 
                      key={signup.id} 
                      className={`hover:bg-gray-50/50 ${signup.is_winner ? 'bg-green-50/50' : ''}`}
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
                        {signup.is_winner ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                            <CheckCircleSolid className="h-4 w-4" />
                            Winner
                          </span>
                        ) : (
                          <button
                            onClick={() => selectWinner(signup)}
                            disabled={sendingTo === signup.id}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-yellow-500 hover:bg-yellow-600 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                          >
                            {sendingTo === signup.id ? (
                              <>
                                <div className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent"></div>
                                Sending...
                              </>
                            ) : (
                              <>
                                <TrophyIcon className="h-4 w-4" />
                                Select Winner
                              </>
                            )}
                          </button>
                        )}
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

        {/* Right Side - Winners Panel (1/3 width) */}
        <div className="space-y-4">
          <div className="glass rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <TrophyIcon className="h-6 w-6 text-yellow-500" />
              <h3 className="text-lg font-bold text-gray-900">Winners ({winners.length})</h3>
            </div>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-yellow-800">
                <strong>Coupon:</strong> Winner100<br/>
                <strong>Value:</strong> $100 off<br/>
                <strong>Expires:</strong> 24 hours
              </p>
            </div>

            {winners.length === 0 ? (
              <p className="text-sm text-gray-500 italic">No winners selected yet. Click "Select Winner" on any row to send them the winning SMS.</p>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {winners.map((winner) => (
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

          {/* Winning Message Preview */}
          <div className="glass rounded-2xl p-6">
            <h4 className="font-medium text-gray-900 mb-3">📱 Winning Message</h4>
            <div className="bg-gray-100 rounded-lg p-4 text-sm text-gray-700">
              You won a free ShoutOut 🎉 (up to $100 value) you can order on shoutout.us with code Winner100 to claim your $100 credit, expires in 24 hrs https://shoutout.us
            </div>
          </div>
        </div>
      </div>

      {/* Winner Celebration Modal */}
      {showWinnerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="relative bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 text-center animate-bounce-in">
            {/* Close button */}
            <button
              onClick={() => setShowWinnerModal(false)}
              className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>

            {/* Party emoji */}
            <div className="text-7xl mb-4 animate-bounce">
              🎉
            </div>

            {/* Title */}
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Winner was just sent a free ShoutOut!
            </h2>

            {/* Phone number (blurred) */}
            <div className="bg-gray-100 rounded-xl py-4 px-6 mb-6">
              <p className="text-sm text-gray-500 mb-1">Winner's Number</p>
              <p className="text-xl font-mono font-semibold text-gray-900">
                {blurPhoneNumber(lastWinnerPhone)}
              </p>
            </div>

            {/* Next winner countdown */}
            <div className="bg-gray-100 border border-gray-200 rounded-xl p-6">
              <p className="text-sm font-medium text-gray-700 mb-2">
                Next winner chosen in
              </p>
              <div className="flex justify-center gap-3">
                <div className="bg-white rounded-lg px-4 py-2 shadow-sm border border-gray-200">
                  <span className="text-2xl font-bold text-gray-900">{String(countdown.hours).padStart(2, '0')}</span>
                  <p className="text-xs text-gray-600">hours</p>
                </div>
                <div className="text-2xl font-bold text-gray-400 self-center">:</div>
                <div className="bg-white rounded-lg px-4 py-2 shadow-sm border border-gray-200">
                  <span className="text-2xl font-bold text-gray-900">{String(countdown.minutes).padStart(2, '0')}</span>
                  <p className="text-xs text-gray-600">mins</p>
                </div>
                <div className="text-2xl font-bold text-gray-400 self-center">:</div>
                <div className="bg-white rounded-lg px-4 py-2 shadow-sm border border-gray-200">
                  <span className="text-2xl font-bold text-gray-900">{String(countdown.seconds).padStart(2, '0')}</span>
                  <p className="text-xs text-gray-600">secs</p>
                </div>
              </div>
            </div>

            {/* Close button */}
            <button
              onClick={() => setShowWinnerModal(false)}
              className="mt-6 w-full py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-semibold rounded-xl hover:from-yellow-600 hover:to-orange-600 transition-all"
            >
              Awesome! 🎊
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default HolidayPromoSignups;
