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
        "'unsafe-inline'", 
        "'unsafe-eval'", 
        "https://connect.facebook.net",
        "https://static.cloudflareinsights.com",
        "https://js.fortis.tech",
        "https://*.fortis.tech"
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
        "https://res.cloudinary.com"
      ],
      frameSrc: [
        "'self'", 
        "https://www.facebook.com",
        "https://*.facebook.com",
        "https://js.fortis.tech",
        "https://*.fortis.tech"
      ],
      formAction: [
        "'self'",
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

