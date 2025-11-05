/**
 * Rate Limiter for Supabase Edge Functions
 * Prevents abuse and DoS attacks by limiting requests per IP/user
 */

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  keyPrefix?: string;
}

interface RateLimitStore {
  count: number;
  resetTime: number;
}

// In-memory store (resets on cold starts, but good enough for Edge Functions)
const rateLimitStore = new Map<string, RateLimitStore>();

/**
 * Clean up expired entries periodically
 */
function cleanupExpiredEntries() {
  const now = Date.now();
  for (const [key, value] of rateLimitStore.entries()) {
    if (now > value.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

// Run cleanup every 60 seconds
setInterval(cleanupExpiredEntries, 60000);

/**
 * Rate limit checker
 * @param identifier - Usually IP address or user ID
 * @param config - Rate limit configuration
 * @returns Object with allowed status and retry info
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
} {
  const key = `${config.keyPrefix || 'rl'}:${identifier}`;
  const now = Date.now();
  
  let store = rateLimitStore.get(key);
  
  // Initialize or reset if window expired
  if (!store || now > store.resetTime) {
    store = {
      count: 0,
      resetTime: now + config.windowMs,
    };
    rateLimitStore.set(key, store);
  }
  
  // Increment count
  store.count++;
  
  const allowed = store.count <= config.maxRequests;
  const remaining = Math.max(0, config.maxRequests - store.count);
  const retryAfter = allowed ? undefined : Math.ceil((store.resetTime - now) / 1000);
  
  return {
    allowed,
    remaining,
    resetTime: store.resetTime,
    retryAfter,
  };
}

/**
 * Get identifier from request (IP or user ID)
 */
export function getIdentifier(req: Request): string {
  // Try to get IP from headers (CloudFlare, Railway, etc.)
  const cfIP = req.headers.get('cf-connecting-ip');
  const forwardedFor = req.headers.get('x-forwarded-for');
  const realIP = req.headers.get('x-real-ip');
  
  return cfIP || forwardedFor?.split(',')[0] || realIP || 'unknown';
}

/**
 * Create rate limit response
 */
export function createRateLimitResponse(
  retryAfter: number,
  resetTime: number
): Response {
  return new Response(
    JSON.stringify({
      error: 'Too many requests',
      message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
      retryAfter,
      resetTime,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': retryAfter.toString(),
        'X-RateLimit-Reset': new Date(resetTime).toISOString(),
      },
    }
  );
}

/**
 * Preset rate limit configs for common use cases
 */
export const RateLimitPresets = {
  // Very strict - for sensitive operations (3 requests per 15 minutes)
  STRICT: {
    maxRequests: 3,
    windowMs: 15 * 60 * 1000,
  },
  
  // Moderate - for API endpoints (10 requests per minute)
  MODERATE: {
    maxRequests: 10,
    windowMs: 60 * 1000,
  },
  
  // Lenient - for general use (30 requests per minute)
  LENIENT: {
    maxRequests: 30,
    windowMs: 60 * 1000,
  },
  
  // Very lenient - for authenticated users (100 requests per minute)
  AUTHENTICATED: {
    maxRequests: 100,
    windowMs: 60 * 1000,
  },
  
  // Email sending - prevent spam (5 per hour)
  EMAIL: {
    maxRequests: 5,
    windowMs: 60 * 60 * 1000,
  },
  
  // SMS/MFA - expensive operations (3 per 15 minutes)
  SMS: {
    maxRequests: 3,
    windowMs: 15 * 60 * 1000,
  },
  
  // Payment operations - very strict (5 per 5 minutes)
  PAYMENT: {
    maxRequests: 5,
    windowMs: 5 * 60 * 1000,
  },
};

/**
 * Middleware wrapper for rate limiting
 * Usage:
 * 
 * serve(withRateLimit(async (req) => {
 *   // Your handler code
 * }, RateLimitPresets.MODERATE));
 */
export function withRateLimit(
  handler: (req: Request) => Promise<Response>,
  config: RateLimitConfig,
  options?: {
    getIdentifier?: (req: Request) => string;
    keyPrefix?: string;
  }
) {
  return async (req: Request): Promise<Response> => {
    const identifier = options?.getIdentifier?.(req) || getIdentifier(req);
    const fullConfig = {
      ...config,
      keyPrefix: options?.keyPrefix || config.keyPrefix,
    };
    
    const { allowed, remaining, resetTime, retryAfter } = checkRateLimit(
      identifier,
      fullConfig
    );
    
    if (!allowed && retryAfter) {
      return createRateLimitResponse(retryAfter, resetTime);
    }
    
    // Add rate limit headers to response
    const response = await handler(req);
    
    // Clone response to add headers
    const headers = new Headers(response.headers);
    headers.set('X-RateLimit-Limit', config.maxRequests.toString());
    headers.set('X-RateLimit-Remaining', remaining.toString());
    headers.set('X-RateLimit-Reset', new Date(resetTime).toISOString());
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  };
}

