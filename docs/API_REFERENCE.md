# CasualMeet Backend API Reference — Phase 1 Hardened Specification

**Base URL**: `http://localhost:5000/api` (Web) / `http://<LAN_IP>:5000/api` (Mobile)  
**Security Model**: Stateless JWT Bearer tokens with server-side authorization enforcement.  
**Authoritative Rule**: The backend is the single source of truth. The frontend is never trusted for ownership, role, timestamps, location privacy, or emergency escalation.

---

## Table of Contents
1. [Emergency Contacts API (`/api/contacts`)](#1-emergency-contacts-api-apicontacts)
2. [Location Update API (`/api/location`)](#2-location-update-api-apilocation)
3. [Geospatial Discovery API (`/api/discover`)](#3-geospatial-discovery-api-apidiscover)
4. [Public Safe Zones API (`/api/safe-zones`)](#4-public-safe-zones-api-apisafe-zones)
5. [User Reporting API (`/api/reports`)](#5-user-reporting-api-apireports)
6. [User Verification API (`/api/verification`)](#6-user-verification-api-apiverification)
7. [Meeting Safety Timers API (`/api/timers`)](#7-meeting-safety-timers-api-apitimers)
8. [Emergency SOS Incident API (`/api/sos`)](#8-emergency-sos-incident-api-apisos)
9. [Conversations & Chats API (`/api/chats`)](#9-conversations--chats-api-apichats)

---

## 1. Emergency Contacts API (`/api/contacts`)

Manages personal trusted contacts alerted during SOS escalation. Ownership is strictly derived from the authenticated JWT token.

### `GET /api/contacts`
- **Auth**: Bearer JWT
- **Role**: `user` | `moderator` | `super_admin`
- **Response `200 OK`**:
  ```json
  [
    {
      "_id": "673c...",
      "userId": "673b...",
      "name": "Farida Khan (Mom)",
      "phone": "+919812004571",
      "relationship": "family",
      "notifyOnSos": true,
      "createdAt": "2026-09-07T08:00:00.000Z"
    }
  ]
  ```

### `POST /api/contacts`
- **Auth**: Bearer JWT
- **Role**: `user` | `moderator` | `super_admin`
- **Body**:
  ```json
  {
    "name": "Farida Khan (Mom)",
    "phone": "+919812004571",
    "relationship": "family",
    "notifyOnSos": true
  }
  ```
- **Validation**:
  - `name`: Required, non-empty string.
  - `phone`: Valid format (10-15 digits, normalized with optional `+91`).
  - `relationship`: `family` | `friend` | `colleague` | `partner` | `other`.
  - Max contacts per user: 5.
- **Response `201 Created`**: Returns created contact object.
- **Errors**: `400 Bad Request` (invalid phone/name or limit reached), `401 Unauthorized`.

### `PUT /api/contacts/:id`
- **Auth**: Bearer JWT
- **Role**: Contact Owner (enforced: `userId === req.user._id`)
- **Body**: Partial update (`name`, `phone`, `relationship`, `notifyOnSos`).
- **Response `200 OK`**: Returns updated contact.
- **Errors**: `404 Not Found` (if contact does not exist or belongs to another user).

### `DELETE /api/contacts/:id`
- **Auth**: Bearer JWT
- **Role**: Contact Owner
- **Response `200 OK`**: `{ "success": true, "message": "Emergency contact removed." }`
- **Errors**: `404 Not Found` (cross-user access denied).

---

## 2. Location Update API (`/api/location`)

Updates the authenticated user's current GPS position with strict geographical bounds. Sanitized response prevents leaking raw coordinates back to consumer clients.

### `PUT /api/location`
- **Auth**: Bearer JWT
- **Role**: Authenticated User
- **Body**:
  ```json
  {
    "latitude": 12.9719,
    "longitude": 77.6412,
    "city": "Indiranagar, Bengaluru"
  }
  ```
- **Validation**:
  - `latitude`: `-90.0` to `90.0`
  - `longitude`: `-180.0` to `180.0`
  - GeoJSON Point: `[longitude, latitude]` indexed on `2dsphere`.
- **Response `200 OK`** (Safe Privacy DTO):
  ```json
  {
    "success": true,
    "updatedAt": "2026-09-07T08:15:30.000Z",
    "city": "Indiranagar, Bengaluru"
  }
  ```
  *(Note: Raw coordinates are strictly withheld from response payload).*
- **Errors**: `400 Bad Request` (out-of-bounds coordinates).

---

## 3. Geospatial Discovery API (`/api/discover`)

Authoritative server-side proximity discovery powered by MongoDB's native `$geoNear` aggregation pipeline on `Location.2dsphere`.

### `GET /api/discover?lat=12.9719&lng=77.6412&radiusKm=20`
- **Auth**: Bearer JWT
- **Query Params**:
  - `lat`: User's latitude (default fallback: user's last recorded location).
  - `lng`: User's longitude.
  - `radiusKm`: Search radius in kilometers (default: 20, max: 100).
- **Server Filtering Pipeline**:
  1. `$geoNear` geospatial distance calculation.
  2. Blocklist & active suspension filtering (`$nin`).
  3. Privacy setting verification (`showLocation: true`).
  4. Active user verification (`role: 'user'`).
- **Response `200 OK`**:
  ```json
  [
    {
      "user": {
        "id": "673a...",
        "name": "Rohan Mehta",
        "username": "rohan.m",
        "bio": "Run at 6, code at 9...",
        "city": "Koramangala, Bengaluru",
        "occupation": "Backend Engineer",
        "interests": ["Running", "Coffee"],
        "avatarHue": 205,
        "isVerified": false,
        "trustScore": 104
      },
      "distanceKm": 4.5,
      "coordinatesRedacted": "••.••••, ••.••••",
      "conn": null
    }
  ]
  ```
  *(Raw coordinates, phone numbers, email addresses, and emergency contacts are strictly excluded).*

---

## 4. Public Safe Zones API (`/api/safe-zones`)

Public safe meeting venues (police stations, cafes, hospitals, metro stations) accessible to consumers.

### `GET /api/safe-zones`
- **Auth**: Bearer JWT
- **Role**: `user` | `moderator` | `super_admin`
- **Response `200 OK`**:
  ```json
  [
    {
      "id": "673c...",
      "name": "Indiranagar Metro Station",
      "category": "public_transit",
      "area": "100 Feet Road",
      "verificationLevel": "verified",
      "amenities": ["Well-lit", "CCTV monitored", "Public transit accessible"],
      "venueCoordinates": [77.6403, 12.9712],
      "isPublicVenue": true
    }
  ]
  ```
  *(Public venue coordinates are explicitly labeled `venueCoordinates` and differentiated from private user GPS).*

---

## 5. User Reporting API (`/api/reports`)

Empowers users to file safety, harassment, or scam reports against abusive accounts.

### `POST /api/reports`
- **Auth**: Bearer JWT
- **Body**:
  ```json
  {
    "reportedUserId": "673b...",
    "category": "harassment",
    "reason": "Harassing messages during meetup",
    "details": "Additional context or message IDs"
  }
  ```
- **Validation**:
  - `reportedUserId`: Valid ObjectId, cannot report oneself.
  - `category`: `harassment` | `spam` | `scam` | `threat` | `fake_identity` | `safety_concern` | `inappropriate_content` | `other`.
  - Rate limiting: max 10 active pending reports per user.
- **Response `201 Created`**:
  ```json
  {
    "success": true,
    "message": "Report submitted successfully. Our safety team will review it.",
    "reportId": "673d..."
  }
  ```

### `GET /api/reports/mine`
- **Auth**: Bearer JWT
- **Response `200 OK`**: Returns reports filed by the authenticated user only.

---

## 6. User Verification API (`/api/verification`)

Selfie verification submission for manual review by Safety Operators.

### `POST /api/verification/submit`
- **Auth**: Bearer JWT
- **Body**:
  ```json
  {
    "selfieUrl": "data:image/jpeg;base64,...",
    "idType": "government_id"
  }
  ```
- **Validation**:
  - Rejects if account is already verified.
  - Rejects if a pending verification request already exists.
  - Enforces payload size limit (< 5MB) and format (`data:image/*` or `https://*`).
- **Response `201 Created`**:
  ```json
  {
    "success": true,
    "verificationId": "673e...",
    "status": "pending"
  }
  ```

### `GET /api/verification/mine`
- **Auth**: Bearer JWT
- **Response `200 OK`**:
  ```json
  {
    "isVerified": false,
    "trustScore": 104,
    "latestRequest": {
      "_id": "673e...",
      "status": "pending",
      "createdAt": "2026-09-07T08:30:00.000Z"
    }
  }
  ```

---

## 7. Meeting Safety Timers API (`/api/timers`)

Authoritative state machine governing safety countdown timers with automated server-side expiration worker.

### Valid State Transitions:
- `active` → `extended`
- `active` → `safe`
- `active` → `cancelled`
- `active` → `expired` (Triggered authoritatively by server worker)
- `extended` → `safe` | `cancelled` | `expired`
- Terminal States: `safe`, `cancelled`, `expired` (cannot be manipulated).

### `POST /api/timers` or `POST /api/timers/start`
- **Auth**: Bearer JWT
- **Body**:
  ```json
  {
    "locationName": "Starbucks Indiranagar",
    "durationMinutes": 60,
    "meetWithUserId": "673b...",
    "meetupLocation": {
      "type": "Point",
      "coordinates": [77.6433, 12.9716]
    }
  }
  ```
- **Response `201 Created`**: Returns timer document with status `'active'`.
- **Errors**: `400 Bad Request` if an active timer is already running for the user.

### `PUT /api/timers/:id/extend`
- **Body**: `{ "extraMinutes": 15 }` (or `addMinutes`).
- **Response `200 OK`**: Returns updated timer with status `'extended'`.

### `PUT /api/timers/:id/safe`
- **Response `200 OK`**: Returns updated timer with status `'safe'`.

### `PUT /api/timers/:id/cancel`
- **Response `200 OK`**: Returns updated timer with status `'cancelled'`.

---

## 8. Emergency SOS Incident API (`/api/sos`)

Handles emergency triggers, SMS dispatches, and role-based incident resolution.

### `POST /api/sos/trigger`
- **Auth**: Bearer JWT
- **Body**:
  ```json
  {
    "locationName": "Indiranagar 100ft Road",
    "includeLocation": true
  }
  ```
- **Idempotency**: Rejects with `400 Bad Request` if an active SOS incident already exists for the user.
- **Dispatch**: Uses `dispatchService` provider adapter (Production Twilio/Fast2SMS, or explicitly marked development simulation).
- **Realtime**: Emits `sos_triggered` to `room:admins` and `user:<id>`.
- **Response `201 Created`**:
  ```json
  {
    "sos": {
      "_id": "673f...",
      "status": "active",
      "source": "manual",
      "locationName": "Indiranagar 100ft Road",
      "smsSent": true,
      "contactsNotified": 2
    },
    "contactsAlerted": 2,
    "dispatchDetails": [...]
  }
  ```

### `PUT /api/sos/:id/resolve` (or `POST /api/sos/:id/resolve`)
- **Auth**: Bearer JWT
- **Authorization**:
  - Incident Owner (`userId === sos.userId`)
  - Safety Moderator (`role === 'moderator'`)
  - Super Admin (`role === 'super_admin'`)
- **Body**:
  ```json
  {
    "status": "resolved",
    "resolutionNotes": "Verified safe by safety team"
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "_id": "673f...",
    "status": "resolved",
    "resolvedByRole": "moderator",
    "resolvedAt": "2026-09-07T08:35:00.000Z"
  }
  ```
- **Errors**: `403 Forbidden` if user is not owner, moderator, or super admin.

---

## 9. Conversations & Chats API (`/api/chats`)

Private encrypted messaging with IDOR protection and real-time Socket.io integration.

### `PUT /api/chats/messages/:id/reveal`
- **Auth**: Bearer JWT
- **Security Check**: Verifies that `chat.participants.includes(req.user._id)`.
- **Response `200 OK`**:
  ```json
  {
    "_id": "673g...",
    "chatId": "673h...",
    "revealedBy": ["673a...", "673b..."],
    "containsSensitive": true
  }
  ```
- **Errors**: `403 Forbidden` if caller is not a participant in the conversation.
