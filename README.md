# CasualMeet - Safety-First Meetup Platform

## Getting Started

### 1. Start Both Frontend & Backend (Recommended)
Run both the Vite web application and the Express API server concurrently:
```bash
npm run dev
```
- **Frontend Web App**: [http://localhost:3000](http://localhost:3000)
- **Backend REST API**: [http://localhost:5000/api](http://localhost:5000/api)
- **WebSocket Gateway**: `ws://localhost:5000`

### 2. Individual Services
If you prefer running services in separate terminals:
- **Backend Server only**:
  ```bash
  npm run server
  ```
- **Frontend Vite only**:
  ```bash
  npm run dev:frontend
  ```

### 3. Run Automated Verification Test Suites
```bash
# Full Backend API & Database tests
npm run test:api

# Security Hardening & Rate Limiting tests
npm run test:security

# Background Push Notification & Device Registry tests
npm run test:push

# Live SMS Gateway & Carrier Routing tests
npm run test:sms

# Social, Content Moderation & Ephemeral Stories tests
npm run test:phase3b
```

### 4. Build Android Release Artifacts (Google Play Store)
```bash
# Build production Android App Bundle (.aab for Google Play Store submission)
npm run android:build

# Build release APK (.apk for sideloading/direct testing)
npm run android:apk
```

### 5. Deployment & Production Guides
- **Google Play Store & App Store Submission**: [`docs/PLAY_STORE_SUBMISSION.md`](docs/PLAY_STORE_SUBMISSION.md)
- **API Reference**: [`docs/API_REFERENCE.md`](docs/API_REFERENCE.md)
- **Render Production Blueprint**: [`render.yaml`](render.yaml)
- **Production Environment Template**: [`.env.production.example`](.env.production.example)

