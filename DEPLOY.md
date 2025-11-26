# Quick Start - Deploy to Google Cloud Run

## Prerequisites
- Google Cloud SDK installed and authenticated
- AWS credentials available
- Firebase service account file at `server/service-account.json`

## Step-by-Step Deployment

### 1. Set AWS Credentials (PowerShell)

Open PowerShell in the project root and run:

```powershell
# Replace with your actual AWS credentials
$env:AWS_ACCESS_KEY_ID = "YOUR_AWS_ACCESS_KEY_HERE"
$env:AWS_SECRET_ACCESS_KEY = "YOUR_AWS_SECRET_KEY_HERE"
$env:S3_BUCKET_NAME = "YOUR_BUCKET_NAME_HERE"
$env:AWS_REGION = "ap-southeast-1"
```

### 2. Run Deployment Script

```powershell
.\deploy-cloud-run.ps1
```

That's it! The script will:
- ✅ Read Firebase credentials
- ✅ Deploy to Cloud Run
- ✅ Configure all environment variables
- ✅ Set memory, CPU, and timeout

### 3. Verify Deployment

Check if the deployment was successful:

```powershell
# Get service URL
$url = gcloud run services describe event-cast-server --project collab-inn --region asia-southeast1 --format='value(status.url)'
Write-Host "Service URL: $url"

# Test health endpoint
curl "$url/"
# Expected output: "Event Cast Server Running"
```

### 4. View Logs (if needed)

```powershell
gcloud run services logs read event-cast-server --project collab-inn --region asia-southeast1 --limit 50
```

## Troubleshooting

### Error: "Missing environment variables"
Make sure you set all AWS credentials in step 1.

### Error: "service-account.json not found"
Ensure the file exists at `server/service-account.json`

### Deployment takes too long
This is normal for first-time deployments. Cloud Run is building the container image.

### Container fails to start
Check the logs using the command in step 4 above.

## Update Client Configuration

After successful deployment, update your client app to use the new Cloud Run URL:

1. Get your service URL:
```powershell
gcloud run services describe event-cast-server --project collab-inn --region asia-southeast1 --format='value(status.url)'
```

2. Update your client-side API configuration to point to this URL

## Need Help?

Review the full walkthrough at `walkthrough.md` for detailed explanations and manual deployment options.
