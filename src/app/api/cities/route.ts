import { NextResponse } from 'next/server';
import { NORTH_TEXAS_CITIES, getCitySlugsByZipCode, isZipCodeCovered } from '@/lib/cities';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const zipCode = searchParams.get('zip');

  if (zipCode) {
    // Get cities for a specific zip code
    const slugs = getCitySlugsByZipCode(zipCode);
    const cities = NORTH_TEXAS_CITIES.filter(c => slugs.includes(c.slug));
    
    return NextResponse.json({
      zipCode,
      isCovered: isZipCodeCovered(zipCode),
      cities
    });
  }

  // Return all cities
  return NextResponse.json({
    cities: NORTH_TEXAS_CITIES,
    total: NORTH_TEXAS_CITIES.length
  });
}
