#!/bin/bash

# Payout Onboarding System - Install Dependencies
# Run this script before deploying the payout onboarding system

echo "🚀 Installing dependencies for Payout Onboarding System..."
echo ""

# Install react-signature-canvas for W-9 digital signatures
echo "📝 Installing react-signature-canvas..."
npm install react-signature-canvas

echo "📝 Installing TypeScript types..."
npm install --save-dev @types/react-signature-canvas

echo ""
echo "✅ All dependencies installed successfully!"
echo ""
echo "Next steps:"
echo "1. Run database migration: database/add_w9_and_payout_onboarding.sql"
echo "2. Deploy edge function: supabase functions deploy generate-w9-pdf"
echo "3. Build and deploy frontend: npm run build"
echo ""
echo "📖 See PAYOUT_ONBOARDING_DEPLOYMENT_GUIDE.md for detailed instructions"

