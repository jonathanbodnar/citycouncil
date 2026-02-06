// City Council Meeting Types

export interface City {
  id: string;
  name: string;
  state: string;
  zipCodes: string[];
  rssUrl: string;
  calendarUrl: string;
  websiteUrl: string;
  meetingSchedule?: string;
  location?: string;
}

export interface Meeting {
  id: string;
  cityId: string;
  cityName: string;
  title: string;
  description: string;
  date: Date;
  time: string;
  location: string;
  address?: string;
  agendaUrl?: string;
  liveStreamUrl?: string;
  meetingType: 'regular' | 'special' | 'work_session' | 'public_hearing' | 'other';
  status: 'upcoming' | 'in_progress' | 'completed' | 'cancelled';
}

export interface MeetingCardProps {
  meeting: Meeting;
  onClick: (meeting: Meeting) => void;
}

export interface ZipCodeResult {
  zipCode: string;
  cities: City[];
  isValid: boolean;
}
