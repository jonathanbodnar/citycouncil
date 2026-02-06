'use client';

import { useState, useCallback } from 'react';
import { Meeting, City } from '@/lib/types';
import { NORTH_TEXAS_CITIES } from '@/lib/cities';
import MeetingCard from '@/components/MeetingCard';
import MeetingDetail from '@/components/MeetingDetail';

type SearchState = 'idle' | 'loading' | 'results' | 'no-results' | 'error';

export default function Home() {
  const [zipCode, setZipCode] = useState('');
  const [searchState, setSearchState] = useState<SearchState>('idle');
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [matchedCities, setMatchedCities] = useState<typeof NORTH_TEXAS_CITIES>([]);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [searchedZip, setSearchedZip] = useState('');
  const [isNearby, setIsNearby] = useState(false);

  const handleSearch = useCallback(async () => {
    const cleanZip = zipCode.trim();
    
    if (cleanZip.length !== 5 || !/^\d{5}$/.test(cleanZip)) {
      return;
    }

    setSearchState('loading');
    setSearchedZip(cleanZip);

    try {
      const response = await fetch(`/api/meetings?zip=${cleanZip}`);
      const data = await response.json();

      if (data.error) {
        setSearchState('error');
        return;
      }

      setMeetings(data.meetings || []);
      setMatchedCities(data.cities || []);
      setIsNearby(data.isNearby || false);
      setSearchState(data.meetings?.length > 0 ? 'results' : 'no-results');
    } catch (error) {
      console.error('Search error:', error);
      setSearchState('error');
    }
  }, [zipCode]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleZipChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 5);
    setZipCode(value);
  };

  const handleBrowseAll = async () => {
    setSearchState('loading');
    setSearchedZip('');
    
    try {
      const response = await fetch('/api/meetings?all=true');
      const data = await response.json();

      if (data.error) {
        setSearchState('error');
        return;
      }

      setMeetings(data.meetings || []);
      setMatchedCities(data.cities || []);
      setIsNearby(false);
      setSearchState(data.meetings?.length > 0 ? 'results' : 'no-results');
    } catch (error) {
      console.error('Browse error:', error);
      setSearchState('error');
    }
  };

  const handleReset = () => {
    setZipCode('');
    setSearchState('idle');
    setMeetings([]);
    setMatchedCities([]);
    setSearchedZip('');
  };

  const getCityForMeeting = (meeting: Meeting) => {
    return matchedCities.find(c => c.slug === meeting.cityId || c.name === meeting.cityName);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <button onClick={handleReset} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Council Finder</h1>
              <p className="text-xs text-gray-500">North Texas City Meetings</p>
            </div>
          </button>
          
          {searchState !== 'idle' && (
            <div className="flex items-center gap-2">
              <div className="relative">
                <input
                  type="text"
                  value={zipCode}
                  onChange={handleZipChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Zip code"
                  className="w-32 pl-4 pr-10 py-2 text-sm border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
                />
                <button
                  onClick={handleSearch}
                  className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 bg-blue-600 rounded-full text-white hover:bg-blue-700 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Idle State */}
        {searchState === 'idle' && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] -mt-8">
            <div className="mb-8">
              <div className="w-24 h-24 bg-gradient-to-br from-blue-600 to-blue-700 rounded-3xl flex items-center justify-center shadow-lg shadow-blue-500/25">
                <svg className="w-14 h-14 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
            </div>
            
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4 text-center">
              Council Finder
            </h1>
            <p className="text-xl text-gray-600 mb-10 text-center max-w-md">
              Find upcoming city council meetings in North Texas
            </p>

            <div className="w-full max-w-xl">
              <div className="relative">
                <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
                  <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  value={zipCode}
                  onChange={handleZipChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Enter your zip code"
                  className="w-full pl-14 pr-6 py-5 text-lg border border-gray-300 rounded-full shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent hover:shadow-md transition-shadow bg-white text-gray-900"
                  autoFocus
                />
              </div>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-6">
                <button
                  onClick={handleSearch}
                  disabled={zipCode.length !== 5}
                  className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Find Meetings
                </button>
                <button
                  onClick={handleBrowseAll}
                  className="px-8 py-3 border-2 border-gray-300 hover:border-gray-400 text-gray-700 bg-gray-100 rounded-lg font-medium transition-colors"
                >
                  Browse All Cities
                </button>
              </div>
            </div>

            <div className="mt-16 text-center">
              <p className="text-sm text-gray-500 mb-4">Currently covering</p>
              <div className="flex flex-wrap justify-center gap-2">
                {NORTH_TEXAS_CITIES.map(city => (
                  <span
                    key={city.slug}
                    className="px-3 py-1.5 bg-white border border-gray-200 rounded-full text-sm text-gray-600 hover:border-blue-300 hover:text-blue-600 transition-colors cursor-default"
                  >
                    {city.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {searchState === 'loading' && (
          <div className="flex flex-col items-center justify-center min-h-[50vh]">
            <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-6" />
            <p className="text-lg text-gray-600">Finding upcoming meetings...</p>
          </div>
        )}

        {/* Results State */}
        {searchState === 'results' && (
          <div>
            <div className="mb-8">
              {searchedZip ? (
                <>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    {isNearby ? 'Meetings near' : 'Meetings in'} {searchedZip}
                  </h2>
                  <p className="text-gray-600">
                    {isNearby && "Your zip code isn't directly covered, but here are nearby cities. "}
                    Showing {meetings.length} upcoming meeting{meetings.length !== 1 ? 's' : ''} in{' '}
                    {matchedCities.map(c => c.name).join(', ')}
                  </p>
                </>
              ) : (
                <>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    All Upcoming Meetings
                  </h2>
                  <p className="text-gray-600">
                    Showing {meetings.length} upcoming meeting{meetings.length !== 1 ? 's' : ''} across all North Texas cities
                  </p>
                </>
              )}
            </div>

            {matchedCities.length > 1 && (
              <div className="flex flex-wrap gap-2 mb-6">
                <span className="text-sm text-gray-500 py-1">Filter:</span>
                <button className="px-3 py-1 bg-blue-600 text-white rounded-full text-sm font-medium">
                  All Cities
                </button>
                {matchedCities.map(city => (
                  <button
                    key={city.slug}
                    className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full text-sm font-medium transition-colors"
                  >
                    {city.name}
                  </button>
                ))}
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {meetings.map(meeting => (
                <MeetingCard
                  key={meeting.id}
                  meeting={meeting}
                  cityName={meeting.cityName || matchedCities.find(c => c.slug === meeting.cityId)?.name || 'City'}
                  onClick={setSelectedMeeting}
                />
              ))}
            </div>
          </div>
        )}

        {/* No Results State */}
        {searchState === 'no-results' && (
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-6">
              <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">No meetings found</h2>
            <p className="text-gray-600 mb-6 max-w-md">
              {searchedZip 
                ? `We don't have coverage for zip code ${searchedZip} yet. We currently cover select North Texas cities.`
                : 'No upcoming meetings were found.'}
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleReset}
                className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg font-medium transition-colors"
              >
                Try Another Zip
              </button>
              <button
                onClick={handleBrowseAll}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                Browse All Cities
              </button>
            </div>
          </div>
        )}

        {/* Error State */}
        {searchState === 'error' && (
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-6">
              <svg className="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h2>
            <p className="text-gray-600 mb-6">We couldn&apos;t fetch the meeting data. Please try again.</p>
            <button
              onClick={handleSearch}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              Try Again
            </button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-gray-50 mt-auto">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-500">
            <p>Council Finder - Your guide to local government in North Texas</p>
            <div className="flex items-center gap-4">
              <span>Data sourced from official city websites</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Meeting Detail Modal */}
      {selectedMeeting && (
        <MeetingDetail
          meeting={selectedMeeting}
          city={getCityForMeeting(selectedMeeting)}
          onClose={() => setSelectedMeeting(null)}
        />
      )}
    </div>
  );
}
