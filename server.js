const express = require('express');
const path = require('path');
const helmet = require('helmet');
const compression = require('compression');
const prerender = require('prerender-node');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable gzip compression for all responses
app.use(compression({
  level: 6, // Balanced compression level (1-9)
  threshold: 1024, // Only compress responses > 1KB
  filter: (req, res) => {
    // Compress everything except images (they're already compressed)
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  }
}));
console.log('✅ Gzip compression enabled');

// Security headers with Helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'", 
        // Note: 'unsafe-eval' is required for React/Vite in production
        "'unsafe-eval'",
        "'unsafe-inline'", // Required for inline scripts (Rumble, Meta Pixel, etc.)
        "data:", // Allow data: URIs for base64 encoded scripts
        "https://connect.facebook.net",
        "https://static.cloudflareinsights.com",
        "https://js.fortis.tech",
        "https://*.fortis.tech",
        "https://cdn.plaid.com",
        "https://*.plaid.com",
        "https://www.googletagmanager.com",
        "https://www.google-analytics.com",
        "https://a.ads.rmbl.ws", // Rumble Ads
        "https://*.rmbl.ws" // Rumble Ads wildcard
      ],
      styleSrc: [
        "'self'", 
        "'unsafe-inline'", 
        "https://fonts.googleapis.com"
      ],
      fontSrc: [
        "'self'", 
        "https://fonts.gstatic.com"
      ],
      imgSrc: [
        "'self'", 
        "data:", 
        "https:", 
        "blob:"
      ],
      mediaSrc: [
        "'self'",
        "blob:",
        "data:",
        "https://*.wasabisys.com",
        "https://s3.us-central-1.wasabisys.com",
        "https://*.cloudinary.com",
        "https://res.cloudinary.com"
      ],
      connectSrc: [
        "'self'", 
        "https://*.railway.app", // Railway deployment domains
        "https://*.supabase.co", 
        "https://utafetamgwukkbrlezev.supabase.co", // Specific Supabase project
        "wss://*.supabase.co",
        "wss://utafetamgwukkbrlezev.supabase.co",
        "https://api.fortis.tech",
        "https://*.fortis.tech",
        "https://*.wasabisys.com",
        "https://s3.us-central-1.wasabisys.com",
        "https://www.facebook.com",
        "https://*.facebook.com",
        "https://cloudflareinsights.com",
        "https://*.cloudinary.com",
        "https://res.cloudinary.com",
        "https://cdn.plaid.com",
        "https://*.plaid.com",
        "https://production.plaid.com",
        "https://sandbox.plaid.com",
        "https://www.google-analytics.com",
        "https://analytics.google.com",
        "https://www.googletagmanager.com",
        "https://a.ads.rmbl.ws", // Rumble Ads
        "https://*.rmbl.ws", // Rumble Ads wildcard
        "https://hooks.zapier.com", // Zapier webhooks
        "https://*.zapier.com" // Zapier wildcard
      ],
      frameSrc: [
        "'self'",
        "https://*.railway.app", // Railway deployment domains
        "https://www.facebook.com",
        "https://*.facebook.com",
        "https://js.fortis.tech",
        "https://*.fortis.tech",
        "https://cdn.plaid.com",
        "https://*.plaid.com"
      ],
      formAction: [
        "'self'",
        "https://*.railway.app", // Railway deployment domains
        "https://js.fortis.tech",
        "https://*.fortis.tech",
        "https://www.facebook.com"
      ],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false, // Allow embedding for social media
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
}));

console.log('✅ Helmet security headers enabled');

// Prerender.io middleware
// Set your Prerender.io token as PRERENDER_TOKEN environment variable in Railway
if (process.env.PRERENDER_TOKEN) {
  app.use(prerender
    .set('prerenderToken', process.env.PRERENDER_TOKEN)
    .set('protocol', 'https')
  );
  console.log('✅ Prerender.io middleware enabled');
} else {
  console.warn('⚠️  PRERENDER_TOKEN not set - social media previews may not work');
}

// Sitemap.xml route - must come before static files
app.get('/sitemap.xml', async (req, res) => {
  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.REACT_APP_SUPABASE_URL,
      process.env.REACT_APP_SUPABASE_ANON_KEY
    );

    // Fetch active talent profiles
    const { data: talents, error } = await supabase
      .from('talent_profiles')
      .select('slug, full_name, updated_at')
      .eq('is_active', true)
      .order('full_name');

    if (error) throw error;

    const baseUrl = 'https://shoutout.us';
    const now = new Date().toISOString().split('T')[0];

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    // Homepage
    xml += `  <url>\n    <loc>${baseUrl}</loc>\n    <lastmod>${now}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>\n`;

    // Category pages
    const categories = [
      'political-commentators',
      'faith-leaders',
      'conservative-voices',
      'patriots',
      'sports',
      'entertainment',
      'business'
    ];

    categories.forEach(cat => {
      xml += `  <url>\n    <loc>${baseUrl}/category/${cat}</loc>\n    <lastmod>${now}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
    });

    // Talent profiles
    if (talents) {
      talents.forEach(talent => {
        const slug = talent.slug || talent.full_name.toLowerCase().replace(/\s+/g, '-');
        const lastMod = talent.updated_at ? new Date(talent.updated_at).toISOString().split('T')[0] : now;
        xml += `  <url>\n    <loc>${baseUrl}/talent/${slug}</loc>\n    <lastmod>${lastMod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.9</priority>\n  </url>\n`;
      });
    }

    xml += '</urlset>';

    res.header('Content-Type', 'application/xml');
    res.send(xml);
  } catch (error) {
    console.error('Error generating sitemap:', error);
    res.status(500).send('Error generating sitemap');
  }
});

// Serve static files from the React build with proper caching
app.use(express.static(path.join(__dirname, 'build'), {
  maxAge: '1y', // Cache static assets for 1 year (they have hashed filenames)
  etag: true,
  immutable: true, // Tell browsers these files never change
  setHeaders: (res, filePath) => {
    // HTML files should not be cached (they reference the latest JS/CSS)
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
    // JS and CSS files have content hashes, cache forever
    else if (filePath.match(/\.(js|css)$/)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
    // Images, fonts, etc - cache for 1 year
    else if (filePath.match(/\.(png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000');
    }
  }
}));

// Handle React routing - use middleware instead of route
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📱 Prerender enabled: ${!!process.env.PRERENDER_TOKEN}`);
});

