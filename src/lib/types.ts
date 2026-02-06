// City Council Meeting Types

export interface City {
  id: string;
  slug: string;
  name: string;
  state: string;
  zipCodes: string[];
  rssUrl: string;
  calendarUrl: string;
  websiteUrl: string;
  meetingSchedule?: string;
  location?: string;
  lastFetched?: Date;
}

export interface Meeting {
  id: string;
  externalId?: string | null;
  cityId: string;
  cityName?: string | null;
  title: string;
  description?: string | null;
  date: Date;
  time: string;
  location: string;
  address?: string | null;
  agendaUrl?: string | null;
  liveStreamUrl?: string | null;
  meetingType: MeetingType;
  status: MeetingStatus;
}

export type MeetingType = 'REGULAR' | 'WORK_SESSION' | 'SPECIAL' | 'PUBLIC_HEARING' | 'OTHER';
export type MeetingStatus = 'UPCOMING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface MeetingCardProps {
  meeting: Meeting;
  cityName: string;
  onClick: (meeting: Meeting) => void;
}

export interface SearchResult {
  meetings: Meeting[];
  cities: City[];
  fromCache: boolean;
  cacheAge?: number; // seconds since last refresh
}
