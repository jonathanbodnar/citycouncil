// RSS Feed Scraper with database caching
// Scrapes once per day, serves from database

import prisma from './prisma';
import { NORTH_TEXAS_CITIES } from './cities';
import { Meeting, MeetingType } from './types';

// Cache duration: 24 hours
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000;

// Parse RSS XML to extract meeting data
function parseRSSFeed(xml: string, citySlug: string, cityName: string, defaultLocation: string): Omit<Meeting, 'id'>[] {
  const meetings: Omit<Meeting, 'id'>[] = [];
  
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
      let meetingType: MeetingType = 'REGULAR';
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
        externalId: `${citySlug}-${index}`,
        citySlug,
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

// Scrape RSS feed for a city
async function scrapeCity(citySlug: string): Promise<Omit<Meeting, 'id'>[]> {
  const cityConfig = NORTH_TEXAS_CITIES.find(c => c.slug === citySlug);
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

    return parseRSSFeed(
      xml, 
      citySlug, 
      cityConfig.name, 
      cityConfig.location || `${cityConfig.name} City Hall`
    );
  } catch (error) {
    console.error(`Error scraping ${citySlug}:`, error);
    return [];
  }
}

// Check if city cache is stale (older than 24 hours)
async function isCacheStale(citySlug: string): Promise<boolean> {
  const cache = await prisma.cityCache.findUnique({
    where: { citySlug }
  });
  
  if (!cache) return true;
  
  const age = Date.now() - cache.lastScraped.getTime();
  return age > CACHE_DURATION_MS;
}

// Refresh cache for a city - scrape and save to database
async function refreshCityCache(citySlug: string): Promise<void> {
  console.log(`Refreshing cache for ${citySlug}...`);
  
  const meetings = await scrapeCity(citySlug);
  
  if (meetings.length === 0) {
    console.log(`No meetings found for ${citySlug}`);
    return;
  }

  // Delete old meetings for this city
  await prisma.meeting.deleteMany({
    where: { citySlug }
  });

  // Insert new meetings
  await prisma.meeting.createMany({
    data: meetings.map(m => ({
      ...m,
      date: m.date
    }))
  });

  // Update cache timestamp
  await prisma.cityCache.upsert({
    where: { citySlug },
    update: { lastScraped: new Date() },
    create: { citySlug, lastScraped: new Date() }
  });

  console.log(`Cached ${meetings.length} meetings for ${citySlug}`);
}

// Get meetings for a city - from cache, refreshing if stale
export async function getMeetingsForCity(citySlug: string): Promise<Meeting[]> {
  // Check if we need to refresh
  if (await isCacheStale(citySlug)) {
    await refreshCityCache(citySlug);
  }

  // Return from database
  const meetings = await prisma.meeting.findMany({
    where: {
      citySlug,
      status: 'UPCOMING',
      date: { gte: new Date() }
    },
    orderBy: { date: 'asc' }
  });

  return meetings.map(m => ({
    ...m,
    meetingType: m.meetingType as MeetingType
  }));
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

// Force refresh all cities (can be called by a cron job)
export async function refreshAllCities(): Promise<void> {
  for (const city of NORTH_TEXAS_CITIES) {
    await refreshCityCache(city.slug);
  }
}
