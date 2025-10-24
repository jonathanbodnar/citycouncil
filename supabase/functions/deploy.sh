#!/bin/bash

# Deploy Supabase Edge Functions for ShoutOut
# Run this script to deploy email sending function

echo "🚀 Deploying ShoutOut Edge Functions..."
echo ""

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Install it first:"
    echo "   npm install -g supabase"
    exit 1
fi

echo "✅ Supabase CLI found"
echo ""

# Deploy send-email function
echo "📧 Deploying send-email function..."
supabase functions deploy send-email --no-verify-jwt

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📋 Next steps:"
echo "1. Set secrets:"
echo "   supabase secrets set MAILGUN_API_KEY=your_key"
echo "   supabase secrets set MAILGUN_DOMAIN=mail.shoutout.us"
echo ""
echo "2. Test the function:"
echo "   Visit https://shoutout.us/email-test"
echo ""
echo "3. Monitor logs:"
echo "   Visit Supabase Dashboard > Edge Functions > send-email"

