// North Texas City Data with RSS feeds and zip code mappings

import { City } from './types';

export const NORTH_TEXAS_CITIES: City[] = [
  {
    id: 'frisco',
    name: 'Frisco',
    state: 'TX',
    zipCodes: ['75033', '75034', '75035', '75070', '75071', '75078'],
    rssUrl: 'https://www.friscotexas.gov/RSSFeed.aspx?ModID=58&CID=Public-Meetings-13',
    calendarUrl: 'https://www.friscotexas.gov/Calendar.aspx',
    websiteUrl: 'https://www.friscotexas.gov',
    meetingSchedule: '1st and 3rd Tuesday at 6:30 PM',
    location: 'Frisco City Hall, 6101 Frisco Square Blvd'
  },
  {
    id: 'prosper',
    name: 'Prosper',
    state: 'TX',
    zipCodes: ['75078'],
    rssUrl: 'https://www.prospertx.gov/RSSFeed.aspx?ModID=58&CID=Public-Meetings-13',
    calendarUrl: 'https://www.prospertx.gov/Calendar.aspx',
    websiteUrl: 'https://www.prospertx.gov',
    meetingSchedule: '2nd and 4th Tuesday at 6:00 PM',
    location: 'Prosper Town Hall, 250 W. First St'
  },
  {
    id: 'denton',
    name: 'Denton',
    state: 'TX',
    zipCodes: ['76201', '76203', '76205', '76206', '76207', '76208', '76209', '76210', '76226', '76227', '76259'],
    rssUrl: 'https://www.cityofdenton.com/RSSFeed.aspx?ModID=58&CID=Public-Meetings-13',
    calendarUrl: 'https://denton-tx.legistar.com/',
    websiteUrl: 'https://www.cityofdenton.com',
    meetingSchedule: '1st and 3rd Tuesday at 6:30 PM',
    location: 'City Hall, 215 E. McKinney St'
  },
  {
    id: 'plano',
    name: 'Plano',
    state: 'TX',
    zipCodes: ['75023', '75024', '75025', '75026', '75074', '75075', '75082', '75093', '75094'],
    rssUrl: 'https://plano.novusagenda.com/agendapublic/rss.ashx',
    calendarUrl: 'https://plano.novusagenda.com/agendapublic/',
    websiteUrl: 'https://www.plano.gov',
    meetingSchedule: '2nd and 4th Monday at 7:00 PM',
    location: 'Plano Municipal Center, 1520 K Ave'
  },
  {
    id: 'aubrey',
    name: 'Aubrey',
    state: 'TX',
    zipCodes: ['76227'],
    rssUrl: 'https://www.aubreytx.gov/RSSFeed.aspx?ModID=58&CID=Public-Meetings-23',
    calendarUrl: 'https://www.aubreytx.gov/Calendar.aspx',
    websiteUrl: 'https://www.aubreytx.gov',
    meetingSchedule: '1st and 3rd Tuesday at 6:00 PM',
    location: 'Aubrey City Hall, 107 S. Main St'
  },
  {
    id: 'celina',
    name: 'Celina',
    state: 'TX',
    zipCodes: ['75009', '75078'],
    rssUrl: 'https://www.celina-tx.gov/RSSFeed.aspx?ModID=58&CID=Public-Meetings-13',
    calendarUrl: 'https://www.celina-tx.gov/Calendar.aspx',
    websiteUrl: 'https://www.celina-tx.gov',
    meetingSchedule: '2nd Tuesday at 6:30 PM',
    location: 'Celina City Hall, 142 N. Ohio St'
  },
  {
    id: 'allen',
    name: 'Allen',
    state: 'TX',
    zipCodes: ['75002', '75013'],
    rssUrl: 'https://cityofallen.org/RSSFeed.aspx?ModID=58&CID=City-Meeting-Notices-40',
    calendarUrl: 'https://cityofallen.org/Calendar.aspx',
    websiteUrl: 'https://www.cityofallen.org',
    meetingSchedule: '2nd and 4th Tuesday at 7:00 PM',
    location: 'Allen City Hall, 305 Century Pkwy'
  },
  {
    id: 'murphy',
    name: 'Murphy',
    state: 'TX',
    zipCodes: ['75048', '75094'],
    rssUrl: 'https://www.murphytx.org/RSSFeed.aspx?ModID=58&CID=City-Public-Meetings-13',
    calendarUrl: 'https://www.murphytx.org/Calendar.aspx',
    websiteUrl: 'https://www.murphytx.org',
    meetingSchedule: '1st and 3rd Tuesday at 6:00 PM',
    location: 'Murphy City Hall, 206 N. Murphy Rd'
  }
];

// Create a lookup map for zip codes
export const ZIP_CODE_TO_CITIES: Map<string, City[]> = new Map();

NORTH_TEXAS_CITIES.forEach(city => {
  city.zipCodes.forEach(zip => {
    const existing = ZIP_CODE_TO_CITIES.get(zip) || [];
    existing.push(city);
    ZIP_CODE_TO_CITIES.set(zip, existing);
  });
});

// Get all unique zip codes
export const ALL_ZIP_CODES = Array.from(ZIP_CODE_TO_CITIES.keys()).sort();

// Find cities by zip code
export function getCitiesByZipCode(zipCode: string): City[] {
  return ZIP_CODE_TO_CITIES.get(zipCode) || [];
}

// Check if zip code is in our coverage area
export function isZipCodeCovered(zipCode: string): boolean {
  return ZIP_CODE_TO_CITIES.has(zipCode);
}

// Get nearby cities (for zip codes not directly covered)
export function getNearbyCities(zipCode: string): City[] {
  // If zip code is covered, return those cities
  if (isZipCodeCovered(zipCode)) {
    return getCitiesByZipCode(zipCode);
  }
  
  // Check if it's in the general North Texas area (75xxx or 76xxx)
  if (zipCode.startsWith('75') || zipCode.startsWith('76')) {
    // Return all cities as "nearby" options
    return NORTH_TEXAS_CITIES;
  }
  
  return [];
}
