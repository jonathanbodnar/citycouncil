import { NextResponse } from 'next/server';
import { fetchAllMeetings, fetchMeetingsForCities, getAllMockMeetings, getMockMeetingsForCities } from '@/lib/scraper';
import { getCitySlugsByZipCode, getNearbyCitySlugs, NORTH_TEXAS_CITIES } from '@/lib/cities';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const zipCode = searchParams.get('zip');
  const citySlugs = searchParams.get('cities')?.split(',');
  const all = searchParams.get('all') === 'true';

  let meetings;
  let matchedCities: typeof NORTH_TEXAS_CITIES = [];
  let isNearby = false;
  let usingMockData = false;

  try {
    if (all) {
      // Fetch all meetings
      try {
        meetings = await fetchAllMeetings();
      } catch {
        console.log('Database unavailable, using mock data');
        meetings = getAllMockMeetings();
        usingMockData = true;
      }
      matchedCities = NORTH_TEXAS_CITIES;
    } else if (citySlugs && citySlugs.length > 0) {
      // Fetch specific cities
      try {
        meetings = await fetchMeetingsForCities(citySlugs);
      } catch {
        console.log('Database unavailable, using mock data');
        meetings = getMockMeetingsForCities(citySlugs);
        usingMockData = true;
      }
      matchedCities = NORTH_TEXAS_CITIES.filter(c => citySlugs.includes(c.slug));
    } else if (zipCode) {
      // Fetch by zip code
      let slugs = getCitySlugsByZipCode(zipCode);
      
      if (slugs.length === 0) {
        // Try nearby cities
        slugs = getNearbyCitySlugs(zipCode);
        isNearby = slugs.length > 0;
      }

      if (slugs.length === 0) {
        return NextResponse.json({
          meetings: [],
          cities: [],
          isNearby: false,
          message: 'No cities found for this zip code'
        });
      }

      try {
        meetings = await fetchMeetingsForCities(slugs);
      } catch {
        console.log('Database unavailable, using mock data');
        meetings = getMockMeetingsForCities(slugs);
        usingMockData = true;
      }
      matchedCities = NORTH_TEXAS_CITIES.filter(c => slugs.includes(c.slug));
    } else {
      return NextResponse.json({
        error: 'Please provide zip, cities, or all=true parameter'
      }, { status: 400 });
    }

    return NextResponse.json({
      meetings,
      cities: matchedCities,
      isNearby,
      count: meetings.length,
      usingMockData
    });

  } catch (error) {
    console.error('Error fetching meetings:', error);
    // Final fallback - return mock data for all cities
    return NextResponse.json({
      meetings: getAllMockMeetings(),
      cities: NORTH_TEXAS_CITIES,
      isNearby: false,
      count: NORTH_TEXAS_CITIES.length * 4,
      usingMockData: true
    });
  }
}
