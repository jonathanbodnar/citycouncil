const express = require('express');
const path = require('path');
const helmet = require('helmet');
const prerender = require('prerender-node');

const app = express();
const PORT = process.env.PORT || 3000;

// Security headers with Helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'", 
        // Note: 'unsafe-eval' is required for React/Vite in production
        // 'unsafe-inline' removed for better security - use nonces for inline scripts
        "'unsafe-eval'",
        "data:", // Allow data: URIs for base64 encoded scripts (SearchAtlas Otto)
        "https://connect.facebook.net",
        "https://static.cloudflareinsights.com",
        "https://js.fortis.tech",
        "https://*.fortis.tech",
        "https://cdn.plaid.com",
        "https://*.plaid.com",
        "https://www.googletagmanager.com",
        "https://www.google-analytics.com",
        "https://dashboard.searchatlas.com",
        "https://*.searchatlas.com"
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
        "wss://*.supabase.co",
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
        "https://dashboard.searchatlas.com",
        "https://*.searchatlas.com"
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

// Serve static files from the React build
app.use(express.static(path.join(__dirname, 'build'), {
  maxAge: '1d',
  etag: false
}));

// Handle React routing - use middleware instead of route
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📱 Prerender enabled: ${!!process.env.PRERENDER_TOKEN}`);
});

