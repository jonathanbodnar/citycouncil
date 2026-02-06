import { NextResponse } from 'next/server';
import { NORTH_TEXAS_CITIES, getCitySlugsByZipCode, isZipCodeCovered } from '@/lib/cities';
import prisma from '@/lib/prisma';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const zipCode = searchParams.get('zip');

  try {
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

    // Return all cities with cache status
    const dbCities = await prisma.city.findMany({
      select: {
        slug: true,
        lastFetched: true,
        _count: {
          select: { meetings: true }
        }
      }
    });

    const citiesWithStatus = NORTH_TEXAS_CITIES.map(city => {
      const dbCity = dbCities.find(c => c.slug === city.slug);
      return {
        ...city,
        lastFetched: dbCity?.lastFetched || null,
        meetingCount: dbCity?._count.meetings || 0
      };
    });

    return NextResponse.json({
      cities: citiesWithStatus,
      total: citiesWithStatus.length
    });

  } catch (error) {
    console.error('Error fetching cities:', error);
    return NextResponse.json({
      error: 'Failed to fetch cities',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
