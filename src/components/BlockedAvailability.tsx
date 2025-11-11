import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { CalendarIcon, XMarkIcon, PlusIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

interface BlockedDate {
  id: string;
  talent_id: string;
  start_date: string;
  end_date: string;
  reason?: string;
  created_at: string;
}

interface BlockedAvailabilityProps {
  talentId: string;
  talentUserId: string;
}

const BlockedAvailability: React.FC<BlockedAvailabilityProps> = ({ talentId, talentUserId }) => {
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => {
    fetchBlockedDates();
  }, [talentId]);

  const fetchBlockedDates = async () => {
    try {
      const { data, error } = await supabase
        .from('blocked_availability')
        .select('*')
        .eq('talent_id', talentId)
        .order('start_date', { ascending: true });

      if (error) throw error;
      setBlockedDates(data || []);
    } catch (error) {
      console.error('Error fetching blocked dates:', error);
      toast.error('Failed to load blocked dates');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!startDate || !endDate) {
      toast.error('Please select both start and end dates');
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      toast.error('End date must be after start date');
      return;
    }

    setAdding(true);
    try {
      const { error } = await supabase
        .from('blocked_availability')
        .insert({
          talent_id: talentId,
          start_date: startDate,
          end_date: endDate,
          reason: reason || null
        });

      if (error) throw error;

      toast.success('Blocked dates added');
      setStartDate('');
      setEndDate('');
      setReason('');
      fetchBlockedDates();
    } catch (error) {
      console.error('Error adding blocked dates:', error);
      toast.error('Failed to add blocked dates');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove these blocked dates?')) return;

    try {
      const { error } = await supabase
        .from('blocked_availability')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Blocked dates removed');
      fetchBlockedDates();
    } catch (error) {
      console.error('Error deleting blocked dates:', error);
      toast.error('Failed to remove blocked dates');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const isCurrentlyBlocked = (start: string, end: string) => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const startDate = new Date(start);
    const endDate = new Date(end);
    return now >= startDate && now <= endDate;
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Blocked Availability</h3>
        <p className="text-sm text-gray-600 mb-4">
          Set date ranges when you're unavailable. Your profile will show "Unavailable" and orders will be disabled during these periods.
        </p>
      </div>

      {/* Add New Blocked Dates Form */}
      <form onSubmit={handleAdd} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Date *
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              End Date *
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate || new Date().toISOString().split('T')[0]}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reason (optional)
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Vacation"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={adding}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
        >
          {adding ? (
            <>
              <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
              <span>Adding...</span>
            </>
          ) : (
            <>
              <PlusIcon className="h-4 w-4" />
              <span>Add Blocked Dates</span>
            </>
          )}
        </button>
      </form>

      {/* List of Blocked Dates */}
      {blockedDates.length > 0 ? (
        <div className="space-y-3">
          {blockedDates.map((blocked) => {
            const isActive = isCurrentlyBlocked(blocked.start_date, blocked.end_date);
            return (
              <div
                key={blocked.id}
                className={`flex items-center justify-between p-4 rounded-lg border ${
                  isActive
                    ? 'bg-yellow-50 border-yellow-200'
                    : 'bg-white border-gray-200'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <CalendarIcon className={`h-5 w-5 ${isActive ? 'text-yellow-600' : 'text-gray-400'}`} />
                  <div>
                    <div className="font-medium text-gray-900">
                      {formatDate(blocked.start_date)} – {formatDate(blocked.end_date)}
                      {isActive && (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                          Active Now
                        </span>
                      )}
                    </div>
                    {blocked.reason && (
                      <div className="text-sm text-gray-600 mt-0.5">{blocked.reason}</div>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(blocked.id)}
                  className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                  title="Remove blocked dates"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
          <CalendarIcon className="h-12 w-12 text-gray-400 mx-auto mb-2" />
          <p className="text-gray-600">No blocked dates set</p>
          <p className="text-sm text-gray-500 mt-1">Add dates when you'll be unavailable</p>
        </div>
      )}
    </div>
  );
};

export default BlockedAvailability;

