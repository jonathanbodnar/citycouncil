// RSS Feed Scraper with caching

import prisma from './prisma';
import { NORTH_TEXAS_CITIES } from './cities';
import { Meeting, MeetingType, MeetingStatus } from './types';

// Cache duration in seconds (1 hour)
const CACHE_DURATION = 60 * 60;

// Parse RSS XML to extract meeting data
function parseRSSFeed(xml: string, cityId: string, citySlug: string, defaultLocation: string): Partial<Meeting>[] {
  const meetings: Partial<Meeting>[] = [];
  
  // Simple XML parsing (could use a proper XML parser in production)
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
        .trim();

      meetings.push({
        externalId: `${citySlug}-${index}-${meetingDate.getTime()}`,
        cityId,
        title: title || `City Council Meeting`,
        description: cleanDescription || `City council meeting`,
        date: meetingDate,
        time,
        location: defaultLocation,
        agendaUrl: link || undefined,
        meetingType,
        status: meetingDate > new Date() ? 'UPCOMING' : 'COMPLETED'
      });
    }
    
    index++;
  }
  
  return meetings;
}

// Fetch and cache meetings for a single city
export async function fetchAndCacheCityMeetings(citySlug: string): Promise<Meeting[]> {
  const cityConfig = NORTH_TEXAS_CITIES.find(c => c.slug === citySlug);
  if (!cityConfig) {
    throw new Error(`City not found: ${citySlug}`);
  }

  // Check if city exists in DB, create if not
  let city = await prisma.city.findUnique({
    where: { slug: citySlug }
  });

  if (!city) {
    city = await prisma.city.create({
      data: {
        slug: cityConfig.slug,
        name: cityConfig.name,
        state: cityConfig.state,
        zipCodes: cityConfig.zipCodes,
        rssUrl: cityConfig.rssUrl,
        calendarUrl: cityConfig.calendarUrl,
        websiteUrl: cityConfig.websiteUrl,
        meetingSchedule: cityConfig.meetingSchedule,
        location: cityConfig.location
      }
    });
  }

  // Check cache freshness
  const cacheKey = `city-meetings-${citySlug}`;
  const cacheMetadata = await prisma.cacheMetadata.findUnique({
    where: { key: cacheKey }
  });

  const now = new Date();
  const cacheValid = cacheMetadata && cacheMetadata.expiresAt > now;

  if (cacheValid) {
    // Return cached meetings
    const cachedMeetings = await prisma.meeting.findMany({
      where: {
        cityId: city.id,
        status: 'UPCOMING',
        date: { gte: now }
      },
      orderBy: { date: 'asc' }
    });

    return cachedMeetings.map(m => ({
      ...m,
      cityName: city!.name
    }));
  }

  // Fetch fresh data from RSS feed
  try {
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(cityConfig.rssUrl)}`;
    
    const response = await fetch(proxyUrl, {
      headers: {
        'Accept': 'application/rss+xml, application/xml, text/xml'
      },
      next: { revalidate: 0 } // Don't cache at fetch level
    });

    if (!response.ok) {
      console.warn(`Failed to fetch RSS for ${city.name}: ${response.status}`);
      // Return mock data as fallback
      return generateMockMeetings(city);
    }

    const xml = await response.text();
    const parsedMeetings = parseRSSFeed(xml, city.id, citySlug, cityConfig.location || `${city.name} City Hall`);
    
    if (parsedMeetings.length === 0) {
      return generateMockMeetings(city);
    }

    // Clear old meetings and insert new ones
    await prisma.meeting.deleteMany({
      where: { cityId: city.id }
    });

    const createdMeetings = await prisma.meeting.createMany({
      data: parsedMeetings.map(m => ({
        externalId: m.externalId!,
        cityId: city!.id,
        title: m.title!,
        description: m.description,
        date: m.date!,
        time: m.time!,
        location: m.location!,
        address: m.address,
        agendaUrl: m.agendaUrl,
        liveStreamUrl: m.liveStreamUrl,
        meetingType: m.meetingType!,
        status: m.status!
      }))
    });

    // Update cache metadata
    await prisma.cacheMetadata.upsert({
      where: { key: cacheKey },
      update: {
        lastUpdated: now,
        expiresAt: new Date(now.getTime() + CACHE_DURATION * 1000)
      },
      create: {
        key: cacheKey,
        lastUpdated: now,
        expiresAt: new Date(now.getTime() + CACHE_DURATION * 1000)
      }
    });

    // Update city lastFetched
    await prisma.city.update({
      where: { id: city.id },
      data: { lastFetched: now }
    });

    // Return the fresh meetings
    const freshMeetings = await prisma.meeting.findMany({
      where: {
        cityId: city.id,
        status: 'UPCOMING',
        date: { gte: now }
      },
      orderBy: { date: 'asc' }
    });

    return freshMeetings.map(m => ({
      ...m,
      cityName: city!.name
    }));

  } catch (error) {
    console.error(`Error fetching meetings for ${city.name}:`, error);
    return generateMockMeetings(city);
  }
}

// Fetch meetings for multiple cities
export async function fetchMeetingsForCities(citySlugs: string[]): Promise<Meeting[]> {
  const meetingPromises = citySlugs.map(slug => fetchAndCacheCityMeetings(slug));
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

// Generate mock meetings for demo/fallback
function generateMockMeetings(city: { id: string; name: string; meetingSchedule?: string | null; location?: string | null; websiteUrl: string }): Meeting[] {
  const meetings: Meeting[] = [];
  const now = new Date();
  
  const schedule = city.meetingSchedule || '1st and 3rd Tuesday';
  const timeMatch = schedule.match(/(\d{1,2}:\d{2}\s*(AM|PM)?)/i);
  const defaultTime = timeMatch ? timeMatch[0] : '6:00 PM';
  
  for (let i = 0; i < 4; i++) {
    const meetingDate = new Date(now);
    meetingDate.setDate(now.getDate() + (7 * (i + 1)) + Math.floor(Math.random() * 7));
    meetingDate.setHours(18, 0, 0, 0);
    
    const isWorkSession = i % 2 === 1;
    
    meetings.push({
      id: `${city.id}-mock-${i}`,
      externalId: `mock-${i}`,
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
      address: city.location || undefined,
      agendaUrl: city.websiteUrl,
      liveStreamUrl: city.websiteUrl,
      meetingType: isWorkSession ? 'WORK_SESSION' : 'REGULAR',
      status: 'UPCOMING'
    });
  }
  
  return meetings;
}

// Get cache status for debugging
export async function getCacheStatus(): Promise<{ key: string; lastUpdated: Date; expiresAt: Date; isValid: boolean }[]> {
  const metadata = await prisma.cacheMetadata.findMany();
  const now = new Date();
  
  return metadata.map(m => ({
    key: m.key,
    lastUpdated: m.lastUpdated,
    expiresAt: m.expiresAt,
    isValid: m.expiresAt > now
  }));
}

// Force refresh cache for a city
export async function refreshCityCache(citySlug: string): Promise<void> {
  const cacheKey = `city-meetings-${citySlug}`;
  await prisma.cacheMetadata.deleteMany({
    where: { key: cacheKey }
  });
}

// Force refresh all caches
export async function refreshAllCaches(): Promise<void> {
  await prisma.cacheMetadata.deleteMany();
}

// Generate mock meetings without database (for fallback when DB not available)
export function generateMockMeetingsForCity(cityConfig: typeof NORTH_TEXAS_CITIES[0]): Meeting[] {
  const meetings: Meeting[] = [];
  const now = new Date();
  
  const schedule = cityConfig.meetingSchedule || '1st and 3rd Tuesday';
  const timeMatch = schedule.match(/(\d{1,2}:\d{2}\s*(AM|PM)?)/i);
  const defaultTime = timeMatch ? timeMatch[0] : '6:00 PM';
  
  for (let i = 0; i < 4; i++) {
    const meetingDate = new Date(now);
    meetingDate.setDate(now.getDate() + (7 * (i + 1)) + Math.floor(Math.random() * 7));
    meetingDate.setHours(18, 0, 0, 0);
    
    const isWorkSession = i % 2 === 1;
    
    meetings.push({
      id: `${cityConfig.slug}-mock-${i}`,
      externalId: `mock-${i}`,
      cityId: cityConfig.slug,
      cityName: cityConfig.name,
      title: isWorkSession 
        ? `${cityConfig.name} City Council Work Session`
        : `${cityConfig.name} City Council Regular Meeting`,
      description: isWorkSession
        ? `Work session to discuss upcoming agenda items and city business for ${cityConfig.name}.`
        : `Regular city council meeting for the City of ${cityConfig.name}. Public comment period available.`,
      date: meetingDate,
      time: isWorkSession ? '5:00 PM' : defaultTime,
      location: cityConfig.location || `${cityConfig.name} City Hall`,
      address: cityConfig.location || null,
      agendaUrl: cityConfig.websiteUrl,
      liveStreamUrl: cityConfig.websiteUrl,
      meetingType: isWorkSession ? 'WORK_SESSION' : 'REGULAR',
      status: 'UPCOMING'
    });
  }
  
  return meetings;
}

// Get mock meetings for multiple cities (fallback mode)
export function getMockMeetingsForCities(citySlugs: string[]): Meeting[] {
  const cities = NORTH_TEXAS_CITIES.filter(c => citySlugs.includes(c.slug));
  return cities.flatMap(city => generateMockMeetingsForCity(city))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

// Get all mock meetings (fallback mode)
export function getAllMockMeetings(): Meeting[] {
  return NORTH_TEXAS_CITIES.flatMap(city => generateMockMeetingsForCity(city))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}
