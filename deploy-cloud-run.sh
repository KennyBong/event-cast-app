#!/bin/bash
# Deploy Event Cast Server to Google Cloud Run

# Configuration
PROJECT_ID="collab-inn"
SERVICE_NAME="event-cast-server"
REGION="asia-southeast1"  # Change to your preferred region
SERVICE_ACCOUNT_FILE="server/service-account.json"

echo "🚀 Deploying Event Cast Server to Cloud Run..."

# Check if service account file exists
if [ ! -f "$SERVICE_ACCOUNT_FILE" ]; then
    echo "❌ Error: Service account file not found at $SERVICE_ACCOUNT_FILE"
    exit 1
fi

# Read service account JSON and escape it for use as env var
SERVICE_ACCOUNT_JSON=$(cat "$SERVICE_ACCOUNT_FILE" | tr -d '\n' | tr -d ' ')

echo "📦 Building and deploying to Cloud Run..."

# Deploy to Cloud Run with environment variables
gcloud run deploy $SERVICE_NAME \
  --source ./server \
  --project $PROJECT_ID \
  --region $REGION \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars="FIREBASE_SERVICE_ACCOUNT=$SERVICE_ACCOUNT_JSON" \
  --set-env-vars="AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID" \
  --set-env-vars="AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY" \
  --set-env-vars="AWS_REGION=${AWS_REGION:-ap-southeast-1}" \
  --set-env-vars="S3_BUCKET_NAME=$S3_BUCKET_NAME" \
  --timeout=300 \
  --memory=512Mi \
  --cpu=1

echo "✅ Deployment complete!"
echo ""
echo "To view logs:"
echo "  gcloud run services logs read $SERVICE_NAME --project $PROJECT_ID --region $REGION"
echo ""
echo "To get service URL:"
echo "  gcloud run services describe $SERVICE_NAME --project $PROJECT_ID --region $REGION --format='value(status.url)'"
