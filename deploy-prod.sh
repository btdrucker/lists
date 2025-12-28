#!/bin/bash
set -e

echo "🚀 Deploying to PRODUCTION environment..."
echo ""
read -p "⚠️  Are you sure you want to deploy to PRODUCTION? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "❌ Deployment cancelled"
    exit 1
fi

# Build frontend for production
echo "📦 Building frontend..."
cd frontend
npm run build -- --mode production
cd ..

# Switch to production project
echo "🔄 Switching to production Firebase project..."
firebase use prod

# Deploy frontend to Firebase Hosting
echo "🌐 Deploying frontend to Firebase Hosting..."
firebase deploy --only hosting

echo "✅ Production deployment complete!"
echo ""
echo "Frontend URL: https://listster-8ffc9.web.app"
echo ""
echo "⚠️  Don't forget to deploy the backend separately using Cloud Run or Functions"
echo "    See DEPLOYMENT.md for backend deployment instructions"

