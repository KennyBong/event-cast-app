# Quick Deploy Script - Reads from server/.env and deploys to Cloud Run
# This script automatically loads your environment variables and deploys

Write-Host "🚀 Event Cast - Cloud Run Deployment" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Check if .env file exists
$envFile = "server\.env"
if (-not (Test-Path $envFile)) {
    Write-Host "❌ Error: $envFile not found!" -ForegroundColor Red
    exit 1
}

# Load environment variables from .env file
Write-Host "📋 Loading environment variables from $envFile..." -ForegroundColor Yellow
Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*([^#][^=]+)=(.+)$') {
        $name = $matches[1].Trim()
        $value = $matches[2].Trim()
        Set-Item -Path "env:$name" -Value $value
        if ($name -notmatch 'SECRET|PASSWORD') {
            Write-Host "  ✓ $name = $value" -ForegroundColor Gray
        }
        else {
            Write-Host "  ✓ $name = ****" -ForegroundColor Gray
        }
    }
}

Write-Host ""
Write-Host "📦 Preparing deployment..." -ForegroundColor Yellow

# Configuration
$PROJECT_ID = "collab-inn"
$SERVICE_NAME = "event-cast-server"
$REGION = "asia-southeast1"
$SERVICE_ACCOUNT_FILE = "server\service-account.json"

# Check if service account file exists
if (-not (Test-Path $SERVICE_ACCOUNT_FILE)) {
    Write-Host "❌ Error: Service account file not found at $SERVICE_ACCOUNT_FILE" -ForegroundColor Red
    exit 1
}

# Read and compress service account JSON
Write-Host "🔑 Reading Firebase service account..." -ForegroundColor Yellow
$SERVICE_ACCOUNT_JSON = (Get-Content $SERVICE_ACCOUNT_FILE -Raw) -replace '\s+', ' '

Write-Host ""
Write-Host "🚀 Deploying to Google Cloud Run..." -ForegroundColor Cyan
Write-Host "  Project: $PROJECT_ID" -ForegroundColor Gray
Write-Host "  Service: $SERVICE_NAME" -ForegroundColor Gray
Write-Host "  Region: $REGION" -ForegroundColor Gray
Write-Host ""

# Deploy to Cloud Run
gcloud run deploy $SERVICE_NAME `
    --source ./server `
    --project $PROJECT_ID `
    --region $REGION `
    --platform managed `
    --allow-unauthenticated `
    --set-env-vars="FIREBASE_SERVICE_ACCOUNT=$SERVICE_ACCOUNT_JSON,AWS_ACCESS_KEY_ID=$($env:AWS_ACCESS_KEY_ID),AWS_SECRET_ACCESS_KEY=$($env:AWS_SECRET_ACCESS_KEY),AWS_REGION=$($env:AWS_REGION),S3_BUCKET_NAME=$($env:S3_BUCKET_NAME)" `
    --timeout=300 `
    --memory=512Mi `
    --cpu=1

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Deployment successful!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📊 Next steps:" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "1. Get your service URL:" -ForegroundColor White
    Write-Host "   gcloud run services describe $SERVICE_NAME --project $PROJECT_ID --region $REGION --format='value(status.url)'" -ForegroundColor Gray
    Write-Host ""
    Write-Host "2. Test the health endpoint:" -ForegroundColor White
    Write-Host "   `$url = gcloud run services describe $SERVICE_NAME --project $PROJECT_ID --region $REGION --format='value(status.url)'" -ForegroundColor Gray
    Write-Host "   curl `$url" -ForegroundColor Gray
    Write-Host ""
    Write-Host "3. View logs (if needed):" -ForegroundColor White
    Write-Host "   gcloud run services logs read $SERVICE_NAME --project $PROJECT_ID --region $REGION --limit 50" -ForegroundColor Gray
    Write-Host ""
}
else {
    Write-Host ""
    Write-Host "❌ Deployment failed!" -ForegroundColor Red
    Write-Host ""
    Write-Host "💡 Troubleshooting steps:" -ForegroundColor Yellow
    Write-Host "1. Check the error messages above" -ForegroundColor Gray
    Write-Host "2. Verify your gcloud authentication: gcloud auth list" -ForegroundColor Gray
    Write-Host "3. Verify your project access: gcloud projects describe $PROJECT_ID" -ForegroundColor Gray
    Write-Host "4. Check Cloud Run logs for details" -ForegroundColor Gray
    Write-Host ""
    exit 1
}
