#!/bin/bash
set -e

echo "🚀 Deploying backend to TEST environment..."

gcloud run deploy listster-backend-test \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --project listster-test \
  --set-env-vars NODE_ENV=production,FRONTEND_URL=https://listster-test.web.app,FIREBASE_PROJECT_ID=listster-test,FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@listster-test.iam.gserviceaccount.com \
  --update-secrets=FIREBASE_PRIVATE_KEY=listster-test-firebase-key:latest

echo ""
echo "✅ Backend test deployment complete!"
echo ""
echo "Backend URL: https://listster-backend-test-505215258032.us-central1.run.app"

