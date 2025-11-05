#!/bin/bash

# Wasabi CORS Configuration Script
# Sets up CORS for Cloudflare CDN access

echo "🚀 Setting up Wasabi CORS for Cloudflare CDN..."
echo ""

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI not found. Please install it first:"
    echo "   brew install awscli"
    echo "   or visit: https://aws.amazon.com/cli/"
    exit 1
fi

echo "✅ AWS CLI found"
echo ""

# CORS configuration
CORS_CONFIG='{
  "CORSRules": [
    {
      "AllowedOrigins": ["*"],
      "AllowedMethods": ["GET", "HEAD"],
      "AllowedHeaders": ["*"],
      "ExposeHeaders": ["ETag", "Content-Length", "Content-Type"],
      "MaxAgeSeconds": 3600
    }
  ]
}'

# Save CORS config to temp file
echo "$CORS_CONFIG" > /tmp/wasabi-cors-config.json

echo "📝 CORS Configuration:"
cat /tmp/wasabi-cors-config.json
echo ""

# Wasabi endpoint
WASABI_ENDPOINT="https://s3.us-central-1.wasabisys.com"

# Apply CORS to video bucket
echo "🎬 Applying CORS to video bucket (shoutoutorders)..."
aws s3api put-bucket-cors \
  --bucket shoutoutorders \
  --cors-configuration file:///tmp/wasabi-cors-config.json \
  --endpoint-url="$WASABI_ENDPOINT"

if [ $? -eq 0 ]; then
    echo "✅ CORS applied to shoutoutorders bucket"
else
    echo "❌ Failed to apply CORS to shoutoutorders bucket"
    echo "   Make sure AWS CLI is configured with Wasabi credentials"
    echo "   Run: aws configure --profile wasabi"
    exit 1
fi

echo ""

# Apply CORS to images bucket (optional)
read -p "📸 Do you have a separate images bucket (shoutout-assets)? (y/n): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Applying CORS to image bucket (shoutout-assets)..."
    aws s3api put-bucket-cors \
      --bucket shoutout-assets \
      --cors-configuration file:///tmp/wasabi-cors-config.json \
      --endpoint-url="$WASABI_ENDPOINT"
    
    if [ $? -eq 0 ]; then
        echo "✅ CORS applied to shoutout-assets bucket"
    else
        echo "⚠️  Failed to apply CORS to shoutout-assets bucket (bucket may not exist)"
    fi
fi

# Clean up
rm /tmp/wasabi-cors-config.json

echo ""
echo "✅ Wasabi CORS setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Set up Cloudflare DNS (see CLOUDFLARE_CDN_SETUP.md)"
echo "2. Configure cache rules in Cloudflare"
echo "3. Test CDN: curl -I https://videos.shoutout.us/[test-file]"
echo ""

