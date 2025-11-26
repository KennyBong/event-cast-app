# Deploy Event Cast Server to Google Cloud Run
# This PowerShell script is for Windows users

# Configuration
$PROJECT_ID = "collab-inn"
$SERVICE_NAME = "event-cast-server"
$REGION = "asia-southeast1"  # Change to your preferred region
$SERVICE_ACCOUNT_FILE = "server\service-account.json"

Write-Host "🚀 Deploying Event Cast Server to Cloud Run..." -ForegroundColor Cyan

# Check if service account file exists
if (-not (Test-Path $SERVICE_ACCOUNT_FILE)) {
    Write-Host "❌ Error: Service account file not found at $SERVICE_ACCOUNT_FILE" -ForegroundColor Red
    exit 1
}

# Read service account JSON and compress it
$SERVICE_ACCOUNT_JSON = (Get-Content $SERVICE_ACCOUNT_FILE -Raw) -replace '\s+', ' '

Write-Host "📦 Building and deploying to Cloud Run..." -ForegroundColor Yellow

# Note: You need to set AWS credentials as environment variables before running this script:
# $env:AWS_ACCESS_KEY_ID = "your-access-key"
# $env:AWS_SECRET_ACCESS_KEY = "your-secret-key"
# $env:S3_BUCKET_NAME = "your-bucket-name"

if (-not $env:AWS_ACCESS_KEY_ID -or -not $env:AWS_SECRET_ACCESS_KEY -or -not $env:S3_BUCKET_NAME) {
    Write-Host "⚠️  Warning: AWS environment variables not set!" -ForegroundColor Yellow
    Write-Host "Please set the following environment variables:" -ForegroundColor Yellow
    Write-Host "  `$env:AWS_ACCESS_KEY_ID = 'your-access-key'" -ForegroundColor Gray
    Write-Host "  `$env:AWS_SECRET_ACCESS_KEY = 'your-secret-key'" -ForegroundColor Gray
    Write-Host "  `$env:S3_BUCKET_NAME = 'your-bucket-name'" -ForegroundColor Gray
    Write-Host "  `$env:AWS_REGION = 'ap-southeast-1'  # Optional" -ForegroundColor Gray
    Write-Host ""
    $continue = Read-Host "Continue anyway? (y/N)"
    if ($continue -ne 'y') {
        exit 1
    }
}

$AWS_REGION = if ($env:AWS_REGION) { $env:AWS_REGION } else { "ap-southeast-1" }

# Deploy to Cloud Run
gcloud run deploy $SERVICE_NAME `
  --source ./server `
  --project $PROJECT_ID `
  --region $REGION `
  --platform managed `
  --allow-unauthenticated `
  --set-env-vars="FIREBASE_SERVICE_ACCOUNT=$SERVICE_ACCOUNT_JSON,AWS_ACCESS_KEY_ID=$($env:AWS_ACCESS_KEY_ID),AWS_SECRET_ACCESS_KEY=$($env:AWS_SECRET_ACCESS_KEY),AWS_REGION=$AWS_REGION,S3_BUCKET_NAME=$($env:S3_BUCKET_NAME)" `
  --timeout=300 `
  --memory=512Mi `
  --cpu=1

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Deployment complete!" -ForegroundColor Green
    Write-Host ""
    Write-Host "To view logs:" -ForegroundColor Cyan
    Write-Host "  gcloud run services logs read $SERVICE_NAME --project $PROJECT_ID --region $REGION" -ForegroundColor Gray
    Write-Host ""
    Write-Host "To get service URL:" -ForegroundColor Cyan
    Write-Host "  gcloud run services describe $SERVICE_NAME --project $PROJECT_ID --region $REGION --format='value(status.url)'" -ForegroundColor Gray
} else {
    Write-Host ""
    Write-Host "❌ Deployment failed!" -ForegroundColor Red
    Write-Host "Check the error messages above for details." -ForegroundColor Yellow
}
