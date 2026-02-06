// Web Scraper for City Council Meetings
// Scrapes real meeting data from city websites and caches in Supabase

import { NORTH_TEXAS_CITIES } from './cities';
import { Meeting, MeetingType, MeetingStatus } from './types';
import { supabase, supabaseAdmin, DbMeeting } from './supabase';

// Cache duration: 6 hours (meetings don't change that often)
const CACHE_DURATION_MS = 6 * 60 * 60 * 1000;

// ============================================================================
// CIVICPLUS SCRAPER (Frisco, Prosper, Aubrey, Celina, Allen, Murphy, McKinney)
// Uses schema.org structured data embedded in HTML
// ============================================================================

interface ScrapedEvent {
  name: string;
  startDate: string;
  location?: string;
  address?: string;
  description?: string;
  eventId?: string;
}

function parseCivicPlusHTML(html: string): ScrapedEvent[] {
  const events: ScrapedEvent[] = [];
  const seen = new Set<string>();
  
  // Method 1: Match schema.org Event blocks (most common)
  const eventBlockRegex = /<div[^>]*itemscope[^>]*itemtype="http:\/\/schema\.org\/Event"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi;
  
  let match;
  while ((match = eventBlockRegex.exec(html)) !== null) {
    const block = match[0];
    
    // Extract name
    const nameMatch = block.match(/<span[^>]*itemprop="name"[^>]*>([^<]*)<\/span>/i) ||
                      block.match(/<span[^>]*itemprop="name"[^>]*><[^>]*>([^<]*)<\/[^>]*><\/span>/i);
    const name = nameMatch ? nameMatch[1].trim() : '';
    
    // Extract startDate
    const dateMatch = block.match(/<span[^>]*itemprop="startDate"[^>]*>([^<]*)<\/span>/i);
    const startDate = dateMatch ? dateMatch[1].trim() : '';
    
    // Extract location
    const locationMatch = block.match(/<span[^>]*itemprop="name"[^>]*><p>([^<]*)<\/p><\/span>/i);
    const location = locationMatch ? locationMatch[1].trim() : '';
    
    // Extract address
    const streetMatch = block.match(/<span[^>]*itemprop="streetAddress"[^>]*>([^<]*)<\/span>/i);
    const cityMatch = block.match(/<span[^>]*itemprop="addressLocality"[^>]*>([^<]*)<\/span>/i);
    const stateMatch = block.match(/<span[^>]*itemprop="addressRegion"[^>]*>([^<]*)<\/span>/i);
    const zipMatch = block.match(/<span[^>]*itemprop="postalCode"[^>]*>([^<]*)<\/span>/i);
    
    let address = '';
    if (streetMatch) {
      address = [
        streetMatch[1],
        cityMatch ? cityMatch[1] : '',
        stateMatch ? stateMatch[1] : '',
        zipMatch ? zipMatch[1] : ''
      ].filter(Boolean).join(', ');
    }
    
    // Extract event ID from nearby anchor
    const eventIdMatch = html.substring(Math.max(0, match.index - 500), match.index)
      .match(/EID=(\d+)/i);
    const eventId = eventIdMatch ? eventIdMatch[1] : '';
    
    if (name && startDate && !seen.has(`${name}-${startDate}`)) {
      seen.add(`${name}-${startDate}`);
      events.push({
        name,
        startDate,
        location: location || undefined,
        address: address || undefined,
        eventId
      });
    }
  }
  
  // Method 2: Parse event titles from h3 > a > span pattern with nearby date div
  // Pattern: <h3><a id="eventTitle_1185" href="..."><span>City Council Meeting</span></a></h3>
  //          <div class="date">February&nbsp;26,&nbsp;2026,&nbsp;6:00 PM</div>
  const h3AnchorRegex = /<h3>[^<]*<a[^>]*id="eventTitle_(\d+)"[^>]*>[^<]*<span>([^<]+)<\/span><\/a><\/h3>/gi;
  
  while ((match = h3AnchorRegex.exec(html)) !== null) {
    const [fullMatch, eventId, name] = match;
    
    // Look for the date div that follows this anchor (within next 500 chars)
    const afterContext = html.substring(match.index, match.index + 500);
    const dateMatch = afterContext.match(/<div[^>]*class="date"[^>]*>([^<]+)<\/div>/i);
    
    if (dateMatch) {
      const dateStr = dateMatch[1].replace(/&nbsp;/g, ' ').replace(/&thinsp;/g, ' ').trim();
      
      // Parse date string like "February 26, 2026, 6:00 PM - 7:00 PM"
      const cleanDateStr = dateStr.replace(/\s*-\s*\d{1,2}:\d{2}\s*(AM|PM)/i, ''); // Remove end time
      const parsedDate = new Date(cleanDateStr.replace(/,\s*\d{1,2}:\d{2}\s*(AM|PM)/i, ''));
      const timeMatch = dateStr.match(/(\d{1,2}:\d{2}\s*(AM|PM))/i);
      
      if (!isNaN(parsedDate.getTime())) {
        const timeStr = timeMatch ? convertTo24Hour(timeMatch[0]) : '18:00:00';
        const startDate = parsedDate.toISOString().split('T')[0] + 'T' + timeStr;
        
        if (name && !seen.has(`${eventId}`)) {
          seen.add(`${eventId}`);
          events.push({
            name: name.trim(),
            startDate,
            eventId
          });
        }
      }
    }
  }
  
  return events;
}

function convertTo24Hour(time12h: string): string {
  const [time, modifier] = time12h.split(/\s+/);
  let [hours, minutes] = time.split(':').map(Number);
  
  if (modifier?.toUpperCase() === 'PM' && hours !== 12) {
    hours += 12;
  } else if (modifier?.toUpperCase() === 'AM' && hours === 12) {
    hours = 0;
  }
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`;
}

function filterCouncilMeetings(events: ScrapedEvent[]): ScrapedEvent[] {
  const councilKeywords = [
    'city council',
    'town council',
    'council meeting',
    'council work session',
    'council regular',
    'council special',
    'public hearing'
  ];
  
  return events.filter(event => {
    const lowerName = event.name.toLowerCase();
    return councilKeywords.some(keyword => lowerName.includes(keyword));
  });
}

// Helper to fetch with multiple proxy fallbacks
async function fetchWithProxy(url: string, timeout: number = 15000): Promise<string | null> {
  const proxies = [
    (u: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
    (u: string) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
    (u: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`
  ];
  
  for (const proxyFn of proxies) {
    try {
      const proxyUrl = proxyFn(url);
      const response = await fetch(proxyUrl, {
        headers: { 'Accept': 'text/html, */*' },
        cache: 'no-store',
        signal: AbortSignal.timeout(timeout)
      });
      
      if (response.ok) {
        const text = await response.text();
        if (text && text.length > 1000) {
          return text;
        }
      }
    } catch (e) {
      // Try next proxy
      continue;
    }
  }
  
  return null;
}

async function scrapeCivicPlus(
  calendarUrl: string,
  cityId: string,
  cityName: string,
  defaultLocation: string
): Promise<Meeting[]> {
  try {
    const html = await fetchWithProxy(calendarUrl);
    
    if (!html) {
      console.warn(`Failed to fetch ${cityName} calendar`);
      return [];
    }

    const allEvents = parseCivicPlusHTML(html);
    const councilEvents = filterCouncilMeetings(allEvents);
    
    console.log(`Found ${councilEvents.length} council meetings for ${cityName}`);

    const now = new Date();
    const meetings: Meeting[] = [];

    for (const event of councilEvents) {
      const meetingDate = new Date(event.startDate);
      
      // Skip past meetings
      if (meetingDate < now) continue;
      
      // Determine meeting type
      const lowerName = event.name.toLowerCase();
      let meetingType: MeetingType = 'REGULAR';
      if (lowerName.includes('work session')) meetingType = 'WORK_SESSION';
      else if (lowerName.includes('special')) meetingType = 'SPECIAL';
      else if (lowerName.includes('public hearing')) meetingType = 'PUBLIC_HEARING';

      // Format time
      const time = meetingDate.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });

      const meetingId = event.eventId 
        ? `${cityId}-${event.eventId}`
        : `${cityId}-${meetingDate.toISOString().split('T')[0]}`;

      meetings.push({
        id: meetingId,
        externalId: meetingId,
        cityId,
        cityName,
        title: event.name,
        description: `${event.name} for ${cityName}`,
        date: meetingDate,
        time,
        location: event.location || defaultLocation,
        address: event.address || defaultLocation,
        agendaUrl: event.eventId 
          ? `${calendarUrl.split('?')[0]}?EID=${event.eventId}`
          : calendarUrl,
        liveStreamUrl: null,
        meetingType,
        status: 'UPCOMING' as MeetingStatus
      });
    }

    return meetings.sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  } catch (error) {
    console.error(`Error scraping CivicPlus for ${cityName}:`, error);
    return [];
  }
}

// ============================================================================
// LEGISTAR SCRAPER (Denton)
// ============================================================================

async function scrapeLegistar(
  calendarUrl: string,
  cityId: string,
  cityName: string,
  defaultLocation: string
): Promise<Meeting[]> {
  try {
    const html = await fetchWithProxy(calendarUrl);
    
    if (!html) {
      console.warn(`Legistar scrape failed for ${cityName}`);
      return [];
    }
    
    // Legistar uses table rows with meeting data
    // Look for City Council meetings in the grid
    const meetings: Meeting[] = [];
    const now = new Date();
    
    // Match table rows that contain City Council
    const rowRegex = /<tr[^>]*class="[^"]*rgRow[^"]*"[^>]*>([\s\S]*?)<\/tr>/gi;
    let match;
    let index = 0;
    
    while ((match = rowRegex.exec(html)) !== null) {
      const row = match[1];
      
      // Check if this is a City Council meeting
      if (!row.toLowerCase().includes('city council')) continue;
      
      // Extract date - Legistar format varies
      const dateMatch = row.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
      if (!dateMatch) continue;
      
      const meetingDate = new Date(dateMatch[1]);
      if (meetingDate < now) continue;
      
      // Extract time
      const timeMatch = row.match(/(\d{1,2}:\d{2}\s*(AM|PM))/i);
      const time = timeMatch ? timeMatch[0] : '6:00 PM';
      
      // Extract location from row
      const locationMatch = row.match(/City Council[^<]*<[^>]*>[^<]*<[^>]*>([^<]+)/i);
      const location = locationMatch ? locationMatch[1].trim() : defaultLocation;
      
      const meetingId = `${cityId}-${index++}`;
      
      meetings.push({
        id: meetingId,
        externalId: meetingId,
        cityId,
        cityName,
        title: `${cityName} City Council Meeting`,
        description: `City Council meeting for ${cityName}`,
        date: meetingDate,
        time,
        location: location || defaultLocation,
        address: defaultLocation,
        agendaUrl: calendarUrl,
        liveStreamUrl: null,
        meetingType: 'REGULAR' as MeetingType,
        status: 'UPCOMING' as MeetingStatus
      });
    }

    console.log(`Found ${meetings.length} council meetings for ${cityName} via Legistar`);
    return meetings;
  } catch (error) {
    console.error(`Error scraping Legistar for ${cityName}:`, error);
    return [];
  }
}

// ============================================================================
// NOVUSAGENDA SCRAPER (Plano)
// ============================================================================

async function scrapeNovusAgenda(
  calendarUrl: string,
  cityId: string,
  cityName: string,
  defaultLocation: string
): Promise<Meeting[]> {
  try {
    const html = await fetchWithProxy(calendarUrl);
    
    if (!html) {
      console.warn(`NovusAgenda scrape failed for ${cityName}`);
      return [];
    }
    
    const meetings: Meeting[] = [];
    const now = new Date();
    const seen = new Set<string>();
    
    // NovusAgenda pattern: table rows with date, meeting type, location, and MeetingID links
    // Pattern: <td>MM/DD/YY</td><td>City Council Regular Meeting</td><td>Location</td>...MeetingID=XXX
    const rowRegex = /<td[^>]*>(\d{2}\/\d{2}\/\d{2})<\/td><td[^>]*>([^<]+)<\/td><td[^>]*>([^<]+)<\/td>/gi;
    
    let match;
    while ((match = rowRegex.exec(html)) !== null) {
      const [, dateStr, meetingType, location] = match;
      
      // Only include City Council meetings
      const lowerType = meetingType.toLowerCase();
      if (!lowerType.includes('city council')) continue;
      
      // Skip cancellations
      if (location.toLowerCase().includes('cancellation')) continue;
      
      // Parse date (MM/DD/YY format)
      const [month, day, year] = dateStr.split('/');
      const fullYear = parseInt(year) < 50 ? 2000 + parseInt(year) : 1900 + parseInt(year);
      const meetingDate = new Date(fullYear, parseInt(month) - 1, parseInt(day), 19, 0, 0); // Default 7 PM
      
      // Skip past meetings
      if (meetingDate < now) continue;
      
      // Extract MeetingID from nearby context
      const afterContext = html.substring(match.index, match.index + 500);
      const idMatch = afterContext.match(/MeetingID=(\d+)/);
      const meetingId = idMatch ? idMatch[1] : `${dateStr.replace(/\//g, '')}`;
      
      if (seen.has(meetingId)) continue;
      seen.add(meetingId);
      
      // Determine meeting type
      let type: MeetingType = 'REGULAR';
      if (lowerType.includes('pom') || lowerType.includes('work session')) {
        type = 'WORK_SESSION';
      } else if (lowerType.includes('special')) {
        type = 'SPECIAL';
      }

      const id = `${cityId}-${meetingId}`;
      
      meetings.push({
        id,
        externalId: id,
        cityId,
        cityName,
        title: meetingType.trim(),
        description: `${meetingType.trim()} for ${cityName}`,
        date: meetingDate,
        time: type === 'WORK_SESSION' ? '5:00 PM' : '7:00 PM',
        location: location.includes('...') ? defaultLocation : location.trim(),
        address: defaultLocation,
        agendaUrl: `https://plano.novusagenda.com/agendapublic/MeetingView.aspx?MeetingID=${meetingId}`,
        liveStreamUrl: null,
        meetingType: type,
        status: 'UPCOMING' as MeetingStatus
      });
    }

    console.log(`Found ${meetings.length} council meetings for ${cityName} via NovusAgenda`);
    return meetings.sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  } catch (error) {
    console.error(`Error scraping NovusAgenda for ${cityName}:`, error);
    return [];
  }
}

// ============================================================================
// AGENDALINK SCRAPER (Allen)
// Uses Horizon AgendaLink API
// ============================================================================

async function scrapeAgendaLink(
  clientId: string,
  cityId: string,
  cityName: string,
  defaultLocation: string
): Promise<Meeting[]> {
  try {
    // AgendaLink uses a GraphQL-like API
    const apiUrl = `https://horizon.agendalink.app/api/public/clients/${clientId}/agendas`;
    
    const response = await fetch(apiUrl, {
      headers: { 
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
      // Try alternative endpoint
      const altUrl = `https://horizon.agendalink.app/api/engage/v2/clients/${clientId}/agendas`;
      const altResponse = await fetch(altUrl, {
        headers: { 'Accept': 'application/json' },
        cache: 'no-store',
        signal: AbortSignal.timeout(15000)
      });
      
      if (!altResponse.ok) {
        console.warn(`AgendaLink API failed for ${cityName}`);
        return [];
      }
      
      const data = await altResponse.json();
      return parseAgendaLinkData(data, cityId, cityName, defaultLocation);
    }

    const data = await response.json();
    return parseAgendaLinkData(data, cityId, cityName, defaultLocation);
  } catch (error) {
    console.error(`Error scraping AgendaLink for ${cityName}:`, error);
    return [];
  }
}

function parseAgendaLinkData(
  data: any,
  cityId: string,
  cityName: string,
  defaultLocation: string
): Meeting[] {
  const meetings: Meeting[] = [];
  const now = new Date();
  
  // AgendaLink returns an array of agendas
  const agendas = Array.isArray(data) ? data : (data.agendas || data.items || []);
  
  for (const agenda of agendas) {
    const title = agenda.title || agenda.name || '';
    const lowerTitle = title.toLowerCase();
    
    // Only include City Council meetings
    if (!lowerTitle.includes('city council') && !lowerTitle.includes('council meeting')) {
      continue;
    }
    
    const meetingDate = new Date(agenda.meetingDate || agenda.date || agenda.startDate);
    if (isNaN(meetingDate.getTime()) || meetingDate < now) continue;
    
    const meetingId = agenda.id || agenda._id || `${meetingDate.toISOString().split('T')[0]}`;
    
    let meetingType: MeetingType = 'REGULAR';
    if (lowerTitle.includes('workshop') || lowerTitle.includes('work session')) {
      meetingType = 'WORK_SESSION';
    } else if (lowerTitle.includes('special')) {
      meetingType = 'SPECIAL';
    }

    const time = meetingDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    const id = `${cityId}-${meetingId}`;
    
    meetings.push({
      id,
      externalId: id,
      cityId,
      cityName,
      title,
      description: `${title} for ${cityName}`,
      date: meetingDate,
      time,
      location: agenda.location || defaultLocation,
      address: defaultLocation,
      agendaUrl: agenda.url || agenda.agendaUrl || `https://horizon.agendalink.app/engage-v2/${cityId}/agendas`,
      liveStreamUrl: null,
      meetingType,
      status: 'UPCOMING' as MeetingStatus
    });
  }

  console.log(`Found ${meetings.length} council meetings for ${cityName} via AgendaLink`);
  return meetings.sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );
}

// ============================================================================
// SCHEDULE-BASED FALLBACK
// ============================================================================

function generateMeetingsFromSchedule(
  cityId: string,
  cityName: string,
  schedule: string,
  location: string,
  websiteUrl: string,
  monthsAhead: number = 3
): Meeting[] {
  const meetings: Meeting[] = [];
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const lowerSchedule = schedule.toLowerCase();
  
  // Extract time
  const timeMatch = schedule.match(/(\d{1,2}:\d{2}\s*(AM|PM|am|pm))/i);
  const meetingTime = timeMatch ? timeMatch[0] : '6:00 PM';
  
  // Parse which weeks
  const weekPatterns: number[] = [];
  if (lowerSchedule.includes('1st')) weekPatterns.push(1);
  if (lowerSchedule.includes('2nd')) weekPatterns.push(2);
  if (lowerSchedule.includes('3rd')) weekPatterns.push(3);
  if (lowerSchedule.includes('4th')) weekPatterns.push(4);
  if (weekPatterns.length === 0) weekPatterns.push(1, 3);
  
  // Parse day of week
  const daysOfWeek: { [key: string]: number } = {
    'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
    'thursday': 4, 'friday': 5, 'saturday': 6
  };
  let meetingDay = 2;
  for (const [day, num] of Object.entries(daysOfWeek)) {
    if (lowerSchedule.includes(day)) {
      meetingDay = num;
      break;
    }
  }
  
  for (let monthOffset = 0; monthOffset < monthsAhead; monthOffset++) {
    const targetMonth = (currentMonth + monthOffset) % 12;
    const targetYear = currentYear + Math.floor((currentMonth + monthOffset) / 12);
    
    for (const weekNum of weekPatterns) {
      const meetingDate = getNthDayOfMonth(targetYear, targetMonth, meetingDay, weekNum);
      
      if (meetingDate > now) {
        const meetingId = `${cityId}-sched-${meetingDate.toISOString().split('T')[0]}`;
        
        meetings.push({
          id: meetingId,
          externalId: meetingId,
          cityId,
          cityName,
          title: `${cityName} City Council Regular Meeting`,
          description: `Regular city council meeting for ${cityName}. Meetings are typically held ${schedule}.`,
          date: meetingDate,
          time: meetingTime,
          location,
          address: location,
          agendaUrl: websiteUrl,
          liveStreamUrl: null,
          meetingType: 'REGULAR' as MeetingType,
          status: 'UPCOMING' as MeetingStatus
        });
      }
    }
  }
  
  return meetings.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

function getNthDayOfMonth(year: number, month: number, dayOfWeek: number, n: number): Date {
  const firstDay = new Date(year, month, 1);
  const firstDayOfWeek = firstDay.getDay();
  let firstOccurrence = 1 + ((dayOfWeek - firstDayOfWeek + 7) % 7);
  const targetDay = firstOccurrence + (n - 1) * 7;
  return new Date(year, month, targetDay, 18, 0, 0);
}

// ============================================================================
// MAIN SCRAPER LOGIC
// ============================================================================

type ScraperType = 'civicplus' | 'legistar' | 'novusagenda' | 'agendalink';

interface CityConfig {
  slug: string;
  name: string;
  calendarUrl: string;
  websiteUrl: string;
  location: string;
  meetingSchedule: string;
  scraperType: ScraperType;
}

// Map cities to their scraper types
const CITY_SCRAPER_CONFIG: Record<string, ScraperType> = {
  'frisco': 'civicplus',
  'prosper': 'civicplus',
  'aubrey': 'civicplus',
  'celina': 'civicplus',
  'allen': 'agendalink',
  'murphy': 'civicplus',
  'mckinney': 'civicplus',
  'denton': 'legistar',
  'plano': 'novusagenda'
};

// AgendaLink client IDs
const AGENDALINK_CLIENTS: Record<string, string> = {
  'allen': 'allentx'
};

async function scrapeCity(cityId: string): Promise<Meeting[]> {
  const cityConfig = NORTH_TEXAS_CITIES.find(c => c.slug === cityId);
  if (!cityConfig) return [];

  const scraperType = CITY_SCRAPER_CONFIG[cityId] || 'civicplus';
  let scrapedMeetings: Meeting[] = [];

  // Try scraping based on scraper type
  try {
    switch (scraperType) {
      case 'civicplus':
        scrapedMeetings = await scrapeCivicPlus(
          cityConfig.calendarUrl,
          cityId,
          cityConfig.name,
          cityConfig.location
        );
        break;
      case 'legistar':
        scrapedMeetings = await scrapeLegistar(
          cityConfig.calendarUrl,
          cityId,
          cityConfig.name,
          cityConfig.location
        );
        break;
      case 'novusagenda':
        scrapedMeetings = await scrapeNovusAgenda(
          cityConfig.calendarUrl,
          cityId,
          cityConfig.name,
          cityConfig.location
        );
        break;
      case 'agendalink':
        const clientId = AGENDALINK_CLIENTS[cityId];
        if (clientId) {
          scrapedMeetings = await scrapeAgendaLink(
            clientId,
            cityId,
            cityConfig.name,
            cityConfig.location
          );
        }
        break;
    }
  } catch (error) {
    console.error(`Scraping failed for ${cityConfig.name}:`, error);
  }

  // If scraping returned results, use them
  if (scrapedMeetings.length > 0) {
    console.log(`✓ Scraped ${scrapedMeetings.length} meetings for ${cityConfig.name}`);
    return scrapedMeetings;
  }

  // Fall back to schedule-based generation
  console.log(`↻ Falling back to schedule for ${cityConfig.name}`);
  return generateMeetingsFromSchedule(
    cityId,
    cityConfig.name,
    cityConfig.meetingSchedule || '1st and 3rd Tuesday at 6:00 PM',
    cityConfig.location || `${cityConfig.name} City Hall`,
    cityConfig.calendarUrl || cityConfig.websiteUrl,
    3
  );
}

// ============================================================================
// DATABASE CACHING (Supabase)
// ============================================================================

function dbToMeeting(db: DbMeeting): Meeting {
  return {
    id: db.id,
    externalId: db.external_id,
    cityId: db.city_id,
    cityName: db.city_name,
    title: db.title,
    description: db.description || '',
    date: new Date(db.date),
    time: db.time,
    location: db.location || '',
    address: db.address || '',
    agendaUrl: db.agenda_url,
    liveStreamUrl: db.live_stream_url,
    meetingType: db.meeting_type as MeetingType,
    status: db.status as MeetingStatus
  };
}

async function getMeetingsWithCache(cityId: string): Promise<Meeting[]> {
  // If no admin client (no service role key) or no supabase client, scrape directly
  if (!supabaseAdmin || !supabase) {
    console.log(`⚠️ No Supabase connection, scraping ${cityId} directly`);
    return scrapeCity(cityId);
  }

  try {
    // Check cache freshness
    const { data: cache } = await supabase
      .from('city_cache')
      .select('last_scraped')
      .eq('city_id', cityId)
      .single();
    
    const now = new Date();
    const cacheValid = cache && (Date.now() - new Date(cache.last_scraped).getTime()) < CACHE_DURATION_MS;

    if (cacheValid) {
      // Get cached meetings
      const { data: meetings, error } = await supabase
        .from('meetings')
        .select('*')
        .eq('city_id', cityId)
        .eq('status', 'UPCOMING')
        .gte('date', now.toISOString())
        .order('date', { ascending: true });

      if (!error && meetings && meetings.length > 0) {
        console.log(`📦 Using cached ${meetings.length} meetings for ${cityId}`);
        return meetings.map(dbToMeeting);
      }
    }

    // Cache stale or empty, scrape fresh
    console.log(`🔄 Refreshing cache for ${cityId}...`);
    const freshMeetings = await scrapeCity(cityId);
    
    if (freshMeetings.length > 0) {
      try {
        // Delete old meetings for this city
        await supabaseAdmin
          .from('meetings')
          .delete()
          .eq('city_id', cityId);

        // Insert new meetings
        const { error: insertError } = await supabaseAdmin
          .from('meetings')
          .insert(freshMeetings.map(m => ({
            id: m.id,
            external_id: m.externalId || `${cityId}-${m.id}`,
            city_id: m.cityId,
            city_name: m.cityName || cityId,
            title: m.title,
            description: m.description,
            date: m.date instanceof Date ? m.date.toISOString() : m.date,
            time: m.time,
            location: m.location,
            address: m.address,
            agenda_url: m.agendaUrl,
            live_stream_url: m.liveStreamUrl,
            meeting_type: m.meetingType,
            status: m.status,
            updated_at: now.toISOString()
          })));

        if (insertError) {
          console.error('Failed to insert meetings:', insertError);
        }

        // Update cache timestamp
        await supabaseAdmin
          .from('city_cache')
          .upsert({
            city_id: cityId,
            last_scraped: now.toISOString()
          });

        console.log(`💾 Cached ${freshMeetings.length} meetings for ${cityId}`);
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

// ============================================================================
// PUBLIC API
// ============================================================================

export async function getMeetingsForCity(cityId: string): Promise<Meeting[]> {
  return getMeetingsWithCache(cityId);
}

export async function fetchMeetingsForCities(citySlugs: string[]): Promise<Meeting[]> {
  const meetingArrays = await Promise.all(
    citySlugs.map(slug => getMeetingsForCity(slug))
  );
  
  return meetingArrays
    .flat()
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

export async function fetchAllMeetings(): Promise<Meeting[]> {
  const allSlugs = NORTH_TEXAS_CITIES.map(c => c.slug);
  return fetchMeetingsForCities(allSlugs);
}

// Force refresh (bypasses cache)
export async function refreshMeetingsForCity(cityId: string): Promise<Meeting[]> {
  if (supabaseAdmin) {
    await supabaseAdmin.from('city_cache').delete().eq('city_id', cityId);
    await supabaseAdmin.from('meetings').delete().eq('city_id', cityId);
  }
  return getMeetingsForCity(cityId);
}
