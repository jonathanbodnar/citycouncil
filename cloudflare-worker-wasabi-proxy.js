/**
 * Cloudflare Worker: Wasabi CDN Proxy
 * Free tier: 100,000 requests/day
 * 
 * This worker proxies requests from videos.shoutout.us to Wasabi
 * and rewrites the Host header so Wasabi recognizes the bucket.
 */

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  // Get the original URL
  const url = new URL(request.url)
  
  // Only handle videos.shoutout.us
  if (url.hostname !== 'videos.shoutout.us') {
    return new Response('Not Found', { status: 404 })
  }
  
  // Build the Wasabi URL with correct hostname
  const wasabiUrl = `https://shoutoutorders.s3.us-central-1.wasabisys.com${url.pathname}${url.search}`
  
  // Create new request with correct headers
  const wasabiRequest = new Request(wasabiUrl, {
    method: request.method,
    headers: request.headers,
  })
  
  // Fetch from Wasabi
  const response = await fetch(wasabiRequest, {
    cf: {
      // Cloudflare CDN cache settings
      cacheTtl: 2592000, // 30 days
      cacheEverything: true,
    }
  })
  
  // Clone response and add cache headers
  const newResponse = new Response(response.body, response)
  
  // Set browser cache headers
  newResponse.headers.set('Cache-Control', 'public, max-age=14400') // 4 hours
  newResponse.headers.set('CDN-Cache-Control', 'public, max-age=2592000') // 30 days
  
  // CORS headers for browser access
  newResponse.headers.set('Access-Control-Allow-Origin', '*')
  newResponse.headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
  
  return newResponse
}

