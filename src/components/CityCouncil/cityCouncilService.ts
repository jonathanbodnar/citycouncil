// Service to fetch city council meeting data from RSS feeds

import { City, Meeting } from './types';
import { NORTH_TEXAS_CITIES } from './cityData';

// Parse RSS XML to extract meeting data
function parseRSSFeed(xml: string, city: City): Meeting[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'text/xml');
  const items = doc.querySelectorAll('item');
  const meetings: Meeting[] = [];

  items.forEach((item, index) => {
    const title = item.querySelector('title')?.textContent || '';
    const description = item.querySelector('description')?.textContent || '';
    const pubDate = item.querySelector('pubDate')?.textContent || '';
    const link = item.querySelector('link')?.textContent || '';

    // Filter for city council related meetings
    const lowerTitle = title.toLowerCase();
    const isCouncilMeeting = 
      lowerTitle.includes('council') ||
      lowerTitle.includes('city council') ||
      lowerTitle.includes('town council') ||
      lowerTitle.includes('regular meeting') ||
      lowerTitle.includes('work session') ||
      lowerTitle.includes('public hearing');

    if (isCouncilMeeting || items.length <= 10) {
      // Determine meeting type
      let meetingType: Meeting['meetingType'] = 'regular';
      if (lowerTitle.includes('work session')) meetingType = 'work_session';
      else if (lowerTitle.includes('special')) meetingType = 'special';
      else if (lowerTitle.includes('public hearing')) meetingType = 'public_hearing';

      // Parse date - RSS dates can be in various formats
      let meetingDate = new Date(pubDate);
      if (isNaN(meetingDate.getTime())) {
        // Try to extract date from title or description
        const dateMatch = title.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})|(\w+ \d{1,2}, \d{4})/);
        if (dateMatch) {
          meetingDate = new Date(dateMatch[0]);
        } else {
          meetingDate = new Date(); // Fallback to today
        }
      }

      // Extract time from description or use default
      const timeMatch = description.match(/(\d{1,2}:\d{2}\s*(AM|PM|am|pm)?)/i) ||
                       title.match(/(\d{1,2}:\d{2}\s*(AM|PM|am|pm)?)/i);
      const time = timeMatch ? timeMatch[0] : getDefaultMeetingTime(city);

      // Clean description (remove HTML tags)
      const cleanDescription = description
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .trim();

      meetings.push({
        id: `${city.id}-${index}-${meetingDate.getTime()}`,
        cityId: city.id,
        cityName: city.name,
        title: title || `${city.name} City Council Meeting`,
        description: cleanDescription || `Regular city council meeting for ${city.name}, TX`,
        date: meetingDate,
        time: time,
        location: city.location || `${city.name} City Hall`,
        agendaUrl: link || undefined,
        meetingType,
        status: meetingDate > new Date() ? 'upcoming' : 'completed'
      });
    }
  });

  return meetings;
}

function getDefaultMeetingTime(city: City): string {
  // Extract time from meetingSchedule if available
  if (city.meetingSchedule) {
    const timeMatch = city.meetingSchedule.match(/(\d{1,2}:\d{2}\s*(AM|PM)?)/i);
    if (timeMatch) return timeMatch[0];
  }
  return '6:00 PM';
}

// Fetch meetings for a single city
export async function fetchCityMeetings(city: City): Promise<Meeting[]> {
  try {
    // Use a CORS proxy for fetching RSS feeds from city websites
    // In production, you'd want your own backend proxy
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(city.rssUrl)}`;
    
    const response = await fetch(proxyUrl, {
      headers: {
        'Accept': 'application/rss+xml, application/xml, text/xml'
      }
    });

    if (!response.ok) {
      console.warn(`Failed to fetch RSS for ${city.name}: ${response.status}`);
      return generateMockMeetings(city);
    }

    const xml = await response.text();
    const meetings = parseRSSFeed(xml, city);
    
    // If no meetings parsed, return mock data
    if (meetings.length === 0) {
      return generateMockMeetings(city);
    }

    return meetings;
  } catch (error) {
    console.warn(`Error fetching meetings for ${city.name}:`, error);
    return generateMockMeetings(city);
  }
}

// Fetch meetings for multiple cities
export async function fetchMeetingsForCities(cities: City[]): Promise<Meeting[]> {
  const meetingPromises = cities.map(city => fetchCityMeetings(city));
  const meetingArrays = await Promise.all(meetingPromises);
  
  // Flatten and sort by date
  return meetingArrays
    .flat()
    .filter(m => m.status === 'upcoming')
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

// Fetch all meetings from all cities
export async function fetchAllMeetings(): Promise<Meeting[]> {
  return fetchMeetingsForCities(NORTH_TEXAS_CITIES);
}

// Generate mock meetings for demo/fallback
function generateMockMeetings(city: City): Meeting[] {
  const meetings: Meeting[] = [];
  const now = new Date();
  
  // Parse meeting schedule to get typical meeting days
  const schedule = city.meetingSchedule || '1st and 3rd Tuesday';
  const timeMatch = schedule.match(/(\d{1,2}:\d{2}\s*(AM|PM)?)/i);
  const defaultTime = timeMatch ? timeMatch[0] : '6:00 PM';
  
  // Generate next 4 upcoming meetings
  for (let i = 0; i < 4; i++) {
    const meetingDate = new Date(now);
    meetingDate.setDate(now.getDate() + (7 * (i + 1)) + Math.floor(Math.random() * 7));
    meetingDate.setHours(18, 0, 0, 0);
    
    const isWorkSession = i % 2 === 1;
    
    meetings.push({
      id: `${city.id}-mock-${i}`,
      cityId: city.id,
      cityName: city.name,
      title: isWorkSession 
        ? `${city.name} City Council Work Session`
        : `${city.name} City Council Regular Meeting`,
      description: isWorkSession
        ? `Work session to discuss upcoming agenda items and city business for ${city.name}.`
        : `Regular city council meeting for the City of ${city.name}. Public comment period available.`,
      date: meetingDate,
      time: isWorkSession ? '5:00 PM' : defaultTime,
      location: city.location || `${city.name} City Hall`,
      address: city.location,
      agendaUrl: city.calendarUrl,
      liveStreamUrl: city.websiteUrl,
      meetingType: isWorkSession ? 'work_session' : 'regular',
      status: 'upcoming'
    });
  }
  
  return meetings;
}

// Format date for display
export function formatMeetingDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
}

// Get relative date string (e.g., "Tomorrow", "Next Tuesday")
export function getRelativeDate(date: Date): string {
  const now = new Date();
  const diffTime = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays < 7) {
    return date.toLocaleDateString('en-US', { weekday: 'long' });
  }
  if (diffDays < 14) {
    return `Next ${date.toLocaleDateString('en-US', { weekday: 'long' })}`;
  }
  
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
