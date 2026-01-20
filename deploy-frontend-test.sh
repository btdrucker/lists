#!/bin/bash
set -e

echo "🚀 Deploying to TEST environment..."

# Build frontend for test
echo "📦 Building frontend..."
cd frontend
npm run build -- --mode test
cd ..

# Switch to test project
echo "🔄 Switching to test Firebase project..."
firebase use test

# Deploy frontend to Firebase Hosting
echo "🌐 Deploying frontend to Firebase Hosting..."
firebase deploy --only hosting

echo "✅ Test deployment complete!"
echo ""
echo "Frontend URL: Check Firebase Console for your hosting URL"
echo ""
echo "⚠️  Don't forget to deploy the backend separately using Cloud Run or Functions"
echo "    See DEPLOYMENT.md for backend deployment instructions"

