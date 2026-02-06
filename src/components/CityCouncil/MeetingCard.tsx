import React from 'react';
import { Meeting, MeetingCardProps } from './types';
import { getRelativeDate } from './cityCouncilService';

// Meeting type badge colors - using inline styles to override dark theme
const meetingTypeStyles: Record<Meeting['meetingType'], { bg: string; color: string; label: string }> = {
  regular: { bg: '#eff6ff', color: '#1d4ed8', label: 'Regular Meeting' },
  work_session: { bg: '#faf5ff', color: '#7e22ce', label: 'Work Session' },
  special: { bg: '#fffbeb', color: '#b45309', label: 'Special Meeting' },
  public_hearing: { bg: '#f0fdf4', color: '#15803d', label: 'Public Hearing' },
  other: { bg: '#f9fafb', color: '#374151', label: 'Meeting' }
};

export const MeetingCard: React.FC<MeetingCardProps> = ({ meeting, onClick }) => {
  const typeStyle = meetingTypeStyles[meeting.meetingType];
  const relativeDate = getRelativeDate(meeting.date);
  const isToday = relativeDate === 'Today';
  const isTomorrow = relativeDate === 'Tomorrow';

  return (
    <button
      onClick={() => onClick(meeting)}
      className="w-full text-left group"
    >
      <div 
        className="rounded-2xl border border-gray-200 p-6 transition-all duration-200 hover:shadow-lg hover:border-gray-300 hover:-translate-y-0.5"
        style={{ backgroundColor: '#ffffff' }}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1 min-w-0">
            {/* City name */}
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium" style={{ color: '#6b7280' }}>{meeting.cityName}, TX</span>
              <span 
                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                style={{ backgroundColor: typeStyle.bg, color: typeStyle.color }}
              >
                {typeStyle.label}
              </span>
            </div>
            
            {/* Meeting title */}
            <h3 
              className="text-lg font-semibold group-hover:text-blue-600 transition-colors truncate"
              style={{ color: '#111827' }}
            >
              {meeting.title}
            </h3>
          </div>
          
          {/* Date badge */}
          <div className="flex-shrink-0 text-right">
            <div 
              className="text-sm font-semibold"
              style={{ color: isToday ? '#dc2626' : isTomorrow ? '#2563eb' : '#4b5563' }}
            >
              {relativeDate}
            </div>
            <div className="text-xs" style={{ color: '#6b7280' }}>
              {meeting.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="space-y-2">
          {/* Time */}
          <div className="flex items-center gap-2 text-sm" style={{ color: '#4b5563' }}>
            <svg className="w-4 h-4" style={{ color: '#9ca3af' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{meeting.time}</span>
          </div>
          
          {/* Location */}
          <div className="flex items-center gap-2 text-sm" style={{ color: '#4b5563' }}>
            <svg className="w-4 h-4" style={{ color: '#9ca3af' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="truncate">{meeting.location}</span>
          </div>
        </div>

        {/* Arrow indicator */}
        <div className="mt-4 flex items-center text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: '#2563eb' }}>
          <span>View details</span>
          <svg className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </button>
  );
};

export default MeetingCard;
