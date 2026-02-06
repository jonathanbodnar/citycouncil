// RSS Feed Scraper - fetches real data from city RSS feeds

import { NORTH_TEXAS_CITIES } from './cities';
import { Meeting, MeetingType } from './types';

// Parse RSS XML to extract meeting data
function parseRSSFeed(xml: string, citySlug: string, cityName: string, defaultLocation: string): Meeting[] {
  const meetings: Meeting[] = [];
  
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  let index = 0;
  
  while ((match = itemRegex.exec(xml)) !== null) {
    const item = match[1];
    
    const getTagContent = (tag: string): string => {
      const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
      const m = item.match(regex);
      return m ? m[1].trim() : '';
    };
    
    const title = getTagContent('title');
    const description = getTagContent('description');
    const pubDate = getTagContent('pubDate');
    const link = getTagContent('link');
    
    // Filter for city council related meetings
    const lowerTitle = title.toLowerCase();
    const isCouncilMeeting = 
      lowerTitle.includes('council') ||
      lowerTitle.includes('city council') ||
      lowerTitle.includes('town council') ||
      lowerTitle.includes('regular meeting') ||
      lowerTitle.includes('work session') ||
      lowerTitle.includes('public hearing');

    if (isCouncilMeeting || index < 10) {
      // Determine meeting type
      let meetingType: MeetingType = 'REGULAR';
      if (lowerTitle.includes('work session')) meetingType = 'WORK_SESSION';
      else if (lowerTitle.includes('special')) meetingType = 'SPECIAL';
      else if (lowerTitle.includes('public hearing')) meetingType = 'PUBLIC_HEARING';

      // Parse date
      let meetingDate = new Date(pubDate);
      if (isNaN(meetingDate.getTime())) {
        const dateMatch = title.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})|(\w+ \d{1,2}, \d{4})/);
        if (dateMatch) {
          meetingDate = new Date(dateMatch[0]);
        } else {
          meetingDate = new Date();
        }
      }

      // Extract time from description or use default
      const timeMatch = description.match(/(\d{1,2}:\d{2}\s*(AM|PM|am|pm)?)/i) ||
                       title.match(/(\d{1,2}:\d{2}\s*(AM|PM|am|pm)?)/i);
      const time = timeMatch ? timeMatch[0] : '6:00 PM';

      // Clean description
      const cleanDescription = description
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#\d+;/g, '')
        .trim();

      meetings.push({
        id: `${citySlug}-${index}-${meetingDate.getTime()}`,
        externalId: `${citySlug}-${index}`,
        cityId: citySlug,
        cityName: cityName,
        title: title || `${cityName} City Council Meeting`,
        description: cleanDescription || `City council meeting for ${cityName}`,
        date: meetingDate,
        time,
        location: defaultLocation,
        address: defaultLocation,
        agendaUrl: link || null,
        liveStreamUrl: null,
        meetingType,
        status: meetingDate > new Date() ? 'UPCOMING' : 'COMPLETED'
      });
    }
    
    index++;
  }
  
  return meetings;
}

// Fetch meetings for a single city from RSS feed
export async function fetchCityMeetings(citySlug: string): Promise<Meeting[]> {
  const cityConfig = NORTH_TEXAS_CITIES.find(c => c.slug === citySlug);
  if (!cityConfig) {
    console.error(`City not found: ${citySlug}`);
    return [];
  }

  try {
    // Use a CORS proxy
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(cityConfig.rssUrl)}`;
    
    const response = await fetch(proxyUrl, {
      headers: {
        'Accept': 'application/rss+xml, application/xml, text/xml, */*'
      },
      cache: 'no-store'
    });

    if (!response.ok) {
      console.warn(`Failed to fetch RSS for ${cityConfig.name}: ${response.status}`);
      return [];
    }

    const xml = await response.text();
    
    if (!xml || xml.length < 100) {
      console.warn(`Empty or invalid RSS response for ${cityConfig.name}`);
      return [];
    }

    const meetings = parseRSSFeed(
      xml, 
      citySlug, 
      cityConfig.name, 
      cityConfig.location || `${cityConfig.name} City Hall`
    );
    
    // Filter for upcoming meetings only
    const now = new Date();
    return meetings.filter(m => new Date(m.date) >= now);

  } catch (error) {
    console.error(`Error fetching meetings for ${cityConfig.name}:`, error);
    return [];
  }
}

// Fetch meetings for multiple cities in parallel
export async function fetchMeetingsForCities(citySlugs: string[]): Promise<Meeting[]> {
  const meetingPromises = citySlugs.map(slug => fetchCityMeetings(slug));
  const meetingArrays = await Promise.all(meetingPromises);
  
  return meetingArrays
    .flat()
    .filter(m => m.status === 'UPCOMING')
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

// Fetch all meetings from all cities
export async function fetchAllMeetings(): Promise<Meeting[]> {
  const allSlugs = NORTH_TEXAS_CITIES.map(c => c.slug);
  return fetchMeetingsForCities(allSlugs);
}
