// RSS Feed Scraper with database caching
// Falls back to direct scraping if database unavailable

import { NORTH_TEXAS_CITIES } from './cities';
import { Meeting, MeetingType, MeetingStatus } from './types';

// Cache duration: 24 hours
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000;

// Lazy load prisma to handle connection errors gracefully
let prismaClient: any = null;
async function getPrisma() {
  if (prismaClient) return prismaClient;
  try {
    const { PrismaClient } = await import('@prisma/client');
    prismaClient = new PrismaClient();
    await prismaClient.$connect();
    return prismaClient;
  } catch (error) {
    console.error('Failed to connect to database:', error);
    return null;
  }
}

interface DbMeeting {
  externalId: string;
  cityId: string;
  cityName: string;
  title: string;
  description: string | null;
  date: Date;
  time: string;
  location: string;
  address: string | null;
  agendaUrl: string | null;
  liveStreamUrl: string | null;
  meetingType: string;
  status: string;
}

// Parse RSS XML to extract meeting data
function parseRSSFeed(xml: string, cityId: string, cityName: string, defaultLocation: string): DbMeeting[] {
  const meetings: DbMeeting[] = [];
  
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
    
    const lowerTitle = title.toLowerCase();
    const isCouncilMeeting = 
      lowerTitle.includes('council') ||
      lowerTitle.includes('city council') ||
      lowerTitle.includes('town council') ||
      lowerTitle.includes('regular meeting') ||
      lowerTitle.includes('work session') ||
      lowerTitle.includes('public hearing');

    if (isCouncilMeeting || index < 10) {
      let meetingType = 'REGULAR';
      if (lowerTitle.includes('work session')) meetingType = 'WORK_SESSION';
      else if (lowerTitle.includes('special')) meetingType = 'SPECIAL';
      else if (lowerTitle.includes('public hearing')) meetingType = 'PUBLIC_HEARING';

      let meetingDate = new Date(pubDate);
      if (isNaN(meetingDate.getTime())) {
        const dateMatch = title.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})|(\w+ \d{1,2}, \d{4})/);
        if (dateMatch) {
          meetingDate = new Date(dateMatch[0]);
        } else {
          meetingDate = new Date();
        }
      }

      const timeMatch = description.match(/(\d{1,2}:\d{2}\s*(AM|PM|am|pm)?)/i) ||
                       title.match(/(\d{1,2}:\d{2}\s*(AM|PM|am|pm)?)/i);
      const time = timeMatch ? timeMatch[0] : '6:00 PM';

      const cleanDescription = description
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#\d+;/g, '')
        .trim();

      meetings.push({
        externalId: `${cityId}-${index}`,
        cityId,
        cityName,
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

// Scrape RSS feed for a city (direct, no caching)
async function scrapeCity(cityId: string): Promise<Meeting[]> {
  const cityConfig = NORTH_TEXAS_CITIES.find(c => c.slug === cityId);
  if (!cityConfig) return [];

  try {
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(cityConfig.rssUrl)}`;
    
    const response = await fetch(proxyUrl, {
      headers: { 'Accept': 'application/rss+xml, application/xml, text/xml, */*' },
      cache: 'no-store'
    });

    if (!response.ok) {
      console.warn(`Failed to fetch RSS for ${cityConfig.name}: ${response.status}`);
      return [];
    }

    const xml = await response.text();
    if (!xml || xml.length < 100) return [];

    const dbMeetings = parseRSSFeed(
      xml, 
      cityId, 
      cityConfig.name, 
      cityConfig.location || `${cityConfig.name} City Hall`
    );
    
    // Convert to Meeting type and filter upcoming
    const now = new Date();
    return dbMeetings
      .filter(m => new Date(m.date) >= now)
      .map((m, i) => ({
        id: `${cityId}-${i}`,
        ...m,
        meetingType: m.meetingType as MeetingType,
        status: m.status as MeetingStatus
      }));
  } catch (error) {
    console.error(`Error scraping ${cityId}:`, error);
    return [];
  }
}

// Try to get from cache, fall back to scraping
async function getMeetingsWithCache(cityId: string): Promise<Meeting[]> {
  const prisma = await getPrisma();
  
  if (!prisma) {
    // No database, scrape directly
    console.log(`No DB connection, scraping ${cityId} directly`);
    return scrapeCity(cityId);
  }

  try {
    // Check cache
    const cache = await prisma.cityCache.findUnique({
      where: { cityId }
    });
    
    const now = new Date();
    const cacheValid = cache && (Date.now() - cache.lastScraped.getTime()) < CACHE_DURATION_MS;

    if (cacheValid) {
      // Return from database
      const meetings = await prisma.meeting.findMany({
        where: {
          cityId,
          status: 'UPCOMING',
          date: { gte: now }
        },
        orderBy: { date: 'asc' }
      });

      if (meetings.length > 0) {
        return meetings.map((m: any) => ({
          ...m,
          meetingType: m.meetingType as MeetingType,
          status: m.status as MeetingStatus
        }));
      }
    }

    // Cache stale or empty, scrape fresh
    console.log(`Refreshing cache for ${cityId}...`);
    const freshMeetings = await scrapeCity(cityId);
    
    if (freshMeetings.length > 0) {
      // Save to database
      try {
        await prisma.meeting.deleteMany({ where: { cityId } });
        await prisma.meeting.createMany({
          data: freshMeetings.map(m => ({
            externalId: m.externalId || `${cityId}-${m.id}`,
            cityId: m.cityId,
            cityName: m.cityName || cityId,
            title: m.title,
            description: m.description,
            date: m.date,
            time: m.time,
            location: m.location,
            address: m.address,
            agendaUrl: m.agendaUrl,
            liveStreamUrl: m.liveStreamUrl,
            meetingType: m.meetingType,
            status: m.status
          }))
        });
        await prisma.cityCache.upsert({
          where: { cityId },
          update: { lastScraped: now },
          create: { cityId, lastScraped: now }
        });
      } catch (dbError) {
        console.error('Failed to cache meetings:', dbError);
      }
    }

    return freshMeetings;
  } catch (error) {
    console.error(`Database error for ${cityId}, falling back to scraping:`, error);
    return scrapeCity(cityId);
  }
}

// Get meetings for a city
export async function getMeetingsForCity(cityId: string): Promise<Meeting[]> {
  return getMeetingsWithCache(cityId);
}

// Get meetings for multiple cities
export async function fetchMeetingsForCities(citySlugs: string[]): Promise<Meeting[]> {
  const meetingArrays = await Promise.all(
    citySlugs.map(slug => getMeetingsForCity(slug))
  );
  
  return meetingArrays
    .flat()
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

// Get all meetings from all cities
export async function fetchAllMeetings(): Promise<Meeting[]> {
  const allSlugs = NORTH_TEXAS_CITIES.map(c => c.slug);
  return fetchMeetingsForCities(allSlugs);
}
