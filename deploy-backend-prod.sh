#!/bin/bash
set -e

echo "🚀 Deploying backend to PRODUCTION environment..."
echo ""
read -p "⚠️  Are you sure you want to deploy to PRODUCTION? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "❌ Deployment cancelled"
    exit 1
fi

cd backend

# You'll need to create the production secret first:
# gcloud secrets create listster-prod-firebase-key --data-file=- --project=listster-8ffc9
# Then paste your production private key

gcloud run deploy listster-backend-prod \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --project listster-8ffc9 \
  --set-env-vars NODE_ENV=production,FRONTEND_URL=https://listster-8ffc9.web.app,FIREBASE_PROJECT_ID=listster-8ffc9,FIREBASE_CLIENT_EMAIL=YOUR_PROD_CLIENT_EMAIL \
  --update-secrets=FIREBASE_PRIVATE_KEY=listster-prod-firebase-key:latest

echo ""
echo "✅ Backend production deployment complete!"

