# Event Cast

A real-time event management and message display application with AWS S3 integration and Firebase backend.

## Features

- Real-time message display with Socket.IO
- Image upload to AWS S3 with pre-signed URLs
- Firebase Firestore for data persistence
- Multiple view modes: Attendee, Moderator, Stage, and Recap
- Admin panel for customer management
- Emoji reactions with real-time broadcasting

## Project Structure

```
event-cast_2/
├── server/              # Backend Node.js server
│   ├── index.js        # Main server file
│   ├── Dockerfile      # Container configuration
│   └── package.json    # Server dependencies
├── src/                # Frontend React application
│   ├── views/          # Different view components
│   ├── services/       # API and Firebase services
│   └── App.jsx         # Main application
└── deploy-cloud-run.ps1  # Deployment script
```

## Quick Start - Development

### Prerequisites
- Node.js 18+
- AWS account with S3 bucket
- Firebase project with Firestore
- Google Cloud account (for deployment)

### Local Development

1. **Install dependencies:**
```bash
npm install
cd server && npm install
```

2. **Configure environment variables:**
Create `server/.env` with:
```env
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=ap-southeast-1
S3_BUCKET_NAME=your_bucket_name
```

3. **Run the server:**
```bash
cd server
npm run dev
```

4. **Run the client:**
```bash
npm run dev
```

## Deployment to Google Cloud Run

See [DEPLOY.md](./DEPLOY.md) for detailed deployment instructions.

### Quick Deploy:

1. Set AWS credentials:
```powershell
$env:AWS_ACCESS_KEY_ID = "your_key"
$env:AWS_SECRET_ACCESS_KEY = "your_secret"
$env:S3_BUCKET_NAME = "your_bucket"
```

2. Deploy:
```powershell
.\deploy-cloud-run.ps1
```

## Architecture

- **Frontend**: React + Vite
- **Backend**: Express.js + Socket.IO
- **Database**: Firebase Firestore
- **Storage**: AWS S3
- **Hosting**: Google Cloud Run (backend), Firebase Hosting (frontend)

## License

MIT
