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

### 3. Run Automated Tests
```bash
# Run API & Database Integration tests
npm run test:api

# Run Security Hardening test suite
npm run test:security
```
