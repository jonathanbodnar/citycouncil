import { NextResponse } from 'next/server';
import { getCacheStatus, refreshCityCache, refreshAllCaches } from '@/lib/scraper';

export async function GET() {
  try {
    const status = await getCacheStatus();
    return NextResponse.json({ caches: status });
  } catch (error) {
    console.error('Error getting cache status:', error);
    return NextResponse.json({
      error: 'Failed to get cache status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const citySlug = searchParams.get('city');

  try {
    if (citySlug) {
      await refreshCityCache(citySlug);
      return NextResponse.json({ message: `Cache refreshed for ${citySlug}` });
    } else {
      await refreshAllCaches();
      return NextResponse.json({ message: 'All caches refreshed' });
    }
  } catch (error) {
    console.error('Error refreshing cache:', error);
    return NextResponse.json({
      error: 'Failed to refresh cache',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
