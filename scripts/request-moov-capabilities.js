// One-time script to request capabilities on Shawn's Moov account
// Run with: node scripts/request-moov-capabilities.js

const MOOV_ACCOUNT_ID = '70a8db6b-9135-4887-92f3-fbae01932b14';

// You'll need to set these or replace with actual values
const MOOV_PUBLIC_KEY = process.env.MOOV_PUBLIC_KEY;
const MOOV_SECRET_KEY = process.env.MOOV_SECRET_KEY;

async function requestCapabilities() {
  if (!MOOV_PUBLIC_KEY || !MOOV_SECRET_KEY) {
    console.error('Please set MOOV_PUBLIC_KEY and MOOV_SECRET_KEY environment variables');
    console.log('Example: MOOV_PUBLIC_KEY=xxx MOOV_SECRET_KEY=yyy node scripts/request-moov-capabilities.js');
    process.exit(1);
  }

  // First, get an access token
  const authResponse = await fetch('https://api.moov.io/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(`${MOOV_PUBLIC_KEY}:${MOOV_SECRET_KEY}`).toString('base64')
    },
    body: 'grant_type=client_credentials&scope=/accounts.write'
  });

  if (!authResponse.ok) {
    const error = await authResponse.text();
    console.error('Auth failed:', error);
    process.exit(1);
  }

  const authData = await authResponse.json();
  const accessToken = authData.access_token;
  console.log('Got access token');

  // Now request capabilities
  const capResponse = await fetch(`https://api.moov.io/accounts/${MOOV_ACCOUNT_ID}/capabilities`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'x-moov-version': 'v2024.01.00'
    },
    body: JSON.stringify({
      capabilities: ['transfers', 'send-funds']
    })
  });

  const result = await capResponse.text();
  console.log('Response status:', capResponse.status);
  console.log('Response:', result);

  if (capResponse.ok) {
    console.log('\n✅ Capabilities requested successfully!');
    console.log('Shawn should now be able to link his bank account.');
  } else {
    console.log('\n❌ Failed to request capabilities');
  }
}

requestCapabilities().catch(console.error);



