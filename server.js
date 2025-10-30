const express = require('express');
const path = require('path');
const prerender = require('prerender-node');

const app = express();
const PORT = process.env.PORT || 3000;

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

