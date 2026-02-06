import { NextResponse } from 'next/server';
import { fetchAllMeetings, fetchMeetingsForCities } from '@/lib/scraper';
import { getCitySlugsByZipCode, getNearbyCitySlugs, NORTH_TEXAS_CITIES } from '@/lib/cities';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const zipCode = searchParams.get('zip');
  const citySlugs = searchParams.get('cities')?.split(',');
  const all = searchParams.get('all') === 'true';

  try {
    let meetings;
    let matchedCities: typeof NORTH_TEXAS_CITIES = [];
    let isNearby = false;

    if (all) {
      // Fetch all meetings
      meetings = await fetchAllMeetings();
      matchedCities = NORTH_TEXAS_CITIES;
    } else if (citySlugs && citySlugs.length > 0) {
      // Fetch specific cities
      meetings = await fetchMeetingsForCities(citySlugs);
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

      meetings = await fetchMeetingsForCities(slugs);
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
      count: meetings.length
    });

  } catch (error) {
    console.error('Error fetching meetings:', error);
    return NextResponse.json({
      error: 'Failed to fetch meetings',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
