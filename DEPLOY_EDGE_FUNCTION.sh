#!/bin/bash

# Deploy admin-impersonate Edge Function
# Run this script to deploy the impersonation feature

echo "🚀 Deploying admin-impersonate Edge Function..."
echo ""

# Check if supabase CLI is available
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Installing..."
    npm install -g supabase
fi

# Deploy the function
echo "📦 Deploying function..."
supabase functions deploy admin-impersonate --project-ref yjivviljtkedbymnnpyk --no-verify-jwt

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Edge Function deployed successfully!"
    echo ""
    echo "📋 Next steps:"
    echo "1. Create audit log table (run SQL in dashboard)"
    echo "2. Test impersonation in Admin > Talent"
    echo ""
    echo "🔗 View function logs:"
    echo "https://supabase.com/dashboard/project/yjivviljtkedbymnnpyk/functions/admin-impersonate/logs"
else
    echo ""
    echo "❌ Deployment failed!"
    echo ""
    echo "📝 Manual deployment:"
    echo "1. Go to: https://supabase.com/dashboard/project/yjivviljtkedbymnnpyk/functions"
    echo "2. Click 'Create a new function'"
    echo "3. Name it: admin-impersonate"
    echo "4. Copy/paste the code from: supabase/functions/admin-impersonate/index.ts"
    echo ""
fi

