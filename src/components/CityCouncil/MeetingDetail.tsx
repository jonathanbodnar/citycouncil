import React from 'react';
import { Meeting } from './types';
import { formatMeetingDate, getRelativeDate } from './cityCouncilService';
import { NORTH_TEXAS_CITIES } from './cityData';

interface MeetingDetailProps {
  meeting: Meeting;
  onClose: () => void;
}

const meetingTypeLabels: Record<Meeting['meetingType'], string> = {
  regular: 'Regular Council Meeting',
  work_session: 'Work Session',
  special: 'Special Called Meeting',
  public_hearing: 'Public Hearing',
  other: 'City Meeting'
};

export const MeetingDetail: React.FC<MeetingDetailProps> = ({ meeting, onClose }) => {
  const city = NORTH_TEXAS_CITIES.find(c => c.id === meeting.cityId);
  const relativeDate = getRelativeDate(meeting.date);

  // Handle escape key
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return (
    <div 
      className="fixed inset-0 z-50 overflow-y-auto light-theme"
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div 
        className="fixed inset-0 backdrop-blur-sm transition-opacity"
        style={{ backgroundColor: 'rgba(17, 24, 39, 0.6)' }}
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div 
          className="relative w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden transform transition-all"
          style={{ backgroundColor: '#ffffff' }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 px-8 py-8" style={{ color: '#ffffff' }}>
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-full transition-colors"
              style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: '#ffffff' }}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            <div className="flex items-center gap-2 mb-3">
              <span className="px-3 py-1 rounded-full text-sm font-medium" style={{ backgroundColor: 'rgba(255,255,255,0.2)', color: '#ffffff' }}>
                {meeting.cityName}, TX
              </span>
              <span className="px-3 py-1 rounded-full text-sm font-medium" style={{ backgroundColor: 'rgba(255,255,255,0.2)', color: '#ffffff' }}>
                {meetingTypeLabels[meeting.meetingType]}
              </span>
            </div>
            
            <h2 id="modal-title" className="text-2xl font-bold" style={{ color: '#ffffff' }}>
              {meeting.title}
            </h2>
          </div>

          {/* Content */}
          <div className="px-8 py-6 space-y-6">
            {/* Date & Time */}
            <div className="flex items-start gap-4 p-4 rounded-2xl" style={{ backgroundColor: '#eff6ff' }}>
              <div className="flex-shrink-0 w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6" style={{ color: '#ffffff' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <div className="text-sm font-medium" style={{ color: '#2563eb' }}>{relativeDate}</div>
                <div className="text-lg font-semibold" style={{ color: '#111827' }}>
                  {formatMeetingDate(meeting.date)}
                </div>
                <div style={{ color: '#4b5563' }}>at {meeting.time}</div>
              </div>
            </div>

            {/* Location */}
            <div className="flex items-start gap-4 p-4 rounded-2xl" style={{ backgroundColor: '#f9fafb' }}>
              <div className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#4b5563' }}>
                <svg className="w-6 h-6" style={{ color: '#ffffff' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <div className="text-sm font-medium" style={{ color: '#6b7280' }}>Location</div>
                <div className="text-lg font-semibold" style={{ color: '#111827' }}>{meeting.location}</div>
                {meeting.address && meeting.address !== meeting.location && (
                  <div style={{ color: '#4b5563' }}>{meeting.address}</div>
                )}
              </div>
            </div>

            {/* Description */}
            {meeting.description && (
              <div>
                <h3 className="text-sm font-medium uppercase tracking-wider mb-2" style={{ color: '#6b7280' }}>
                  About this meeting
                </h3>
                <p className="leading-relaxed" style={{ color: '#374151' }}>
                  {meeting.description}
                </p>
              </div>
            )}

            {/* Meeting Schedule Info */}
            {city?.meetingSchedule && (
              <div className="p-4 rounded-2xl" style={{ backgroundColor: '#fffbeb', border: '1px solid #fcd34d' }}>
                <div className="flex items-center gap-2" style={{ color: '#92400e' }}>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-medium">Regular Schedule:</span>
                  <span>{city.meetingSchedule}</span>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3 pt-4" style={{ borderTop: '1px solid #e5e7eb' }}>
              {meeting.agendaUrl && (
                <a
                  href={meeting.agendaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 rounded-xl font-medium hover:bg-blue-700 transition-colors"
                  style={{ color: '#ffffff' }}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  View Agenda
                </a>
              )}
              
              {meeting.liveStreamUrl && (
                <a
                  href={meeting.liveStreamUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                  style={{ color: '#374151', backgroundColor: '#f3f4f6' }}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Watch Live
                </a>
              )}
              
              {city?.websiteUrl && (
                <a
                  href={city.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                  style={{ color: '#374151', backgroundColor: '#f3f4f6' }}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                  </svg>
                  City Website
                </a>
              )}
              
              <a
                href={`https://maps.google.com/maps?q=${encodeURIComponent(meeting.location + ', ' + meeting.cityName + ', TX')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                style={{ color: '#374151', backgroundColor: '#f3f4f6' }}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                Get Directions
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MeetingDetail;
