# Google Play Store & App Store Deployment Guide

This document details the configuration, release signing credentials, and compliance declarations needed to publish **CasualMeet** to the Google Play Console and Apple App Store.

---

## 1. Application Identity & Package

| Property | Value |
| :--- | :--- |
| **App Name** | CasualMeet |
| **Package ID / Application ID** | `com.casualmeet.app` |
| **Target Android SDK** | API 34+ (Android 14) |
| **Minimum Android SDK** | API 23 (Android 6.0) |
| **Version Code** | `1` (increment with each release) |
| **Version Name** | `1.0.0` |

---

## 2. Release Signing Credentials

The Android application is configured with automated release signing via `android/app/build.gradle`.

* **Keystore Location**: [`android/app/release.keystore`](file:///c:/Users/AMISH/Desktop/meet-main/meet-main/android/app/release.keystore)
* **Key Alias**: `casualmeet`
* **Keystore Password**: `casualmeet123` *(configurable via `KEYSTORE_PASSWORD` environment variable)*
* **Key Password**: `casualmeet123` *(configurable via `KEY_PASSWORD` environment variable)*
* **Key Algorithm**: RSA 2048-bit (validity: 10,000 days / ~27 years)
* **Certificate SHA-256 Fingerprint**:
  ```
  B1:1B:84:A2:D6:88:16:CC:1E:63:43:EA:9B:54:12:50:70:D2:C3:DF:94:2C:F9:7B:04:10:64:B4:5F:2E:45:17
  ```

> [!IMPORTANT]
> Keep `release.keystore` backed up in a secure password vault or cloud secret manager. If the keystore is lost, updates to existing installations cannot be signed without Google Play App Signing key reset.

---

## 3. How to Build Production Artifacts

### A. Android App Bundle (`.aab` - Required for Google Play Store)
```bash
npm run android:build
```
* **Output Path**: `android/app/build/outputs/bundle/release/app-release.aab`
* Upload this `.aab` file directly to Google Play Console under **Production > Create new release**.

### B. Standalone Release APK (`.apk` - For Sideloading / Internal Distribution)
```bash
npm run android:apk
```
* **Output Path**: `android/app/build/outputs/apk/release/app-release.apk`

---

## 4. Google Play Console Compliance Declarations

### A. Privacy Policy & Legal Terms
* **Privacy Policy URL**: `https://your-domain.com/privacy`
* **Terms of Service URL**: `https://your-domain.com/terms`
* **Emergency Disclaimer**: App displays explicit disclosure: *"CasualMeet is a companion tool, not a certified emergency response system. In imminent danger, call national emergency numbers (911/112/100) immediately."*

### B. Account Deletion Mandate (Google Play & Apple Requirement)
* **In-App Account Deletion**: Users can permanently delete their account self-service via `Profile > Settings > Delete Account` (modal with `DELETE` confirmation).
* **Web Account Deletion URL**: `https://your-domain.com/privacy#deletion`
* **Backend Deletion Cascade**: Purges user profile, auth credentials, emergency contacts, active timers, active SOS events, personal locations, social connections, notifications, and device push tokens.

### C. Permissions Declaration & Justification
| Permission | Technical Name | Play Store Justification |
| :--- | :--- | :--- |
| **Location (Fine/Coarse)** | `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION` | Required to provide safety meeting tracking and attach coordinate links to emergency SOS SMS alerts. (Coarse location redacted for standard discovery). |
| **Push Notifications** | `POST_NOTIFICATIONS` | Required for urgent emergency SOS alerts, safety timer countdowns, and real-time chat messages. |
| **Vibrate** | `VIBRATE` | Required to alert the user during high-priority emergency events and expiring timers. |
| **Network State** | `ACCESS_NETWORK_STATE`, `INTERNET` | Required for API communication, cloud media delivery, and WebSocket connection state tracking. |

### D. Data Safety Section Responses
* **Location**: Collected (Approximate & Precise). Used for App functionality and Safety. Ephemeral tracking when user initiates Safety Timer or SOS.
* **Personal Info**: Name, Email, Phone number. Collected for account authentication and emergency SMS dispatch.
* **Photos & Videos**: Collected only when user creates public posts or stories. Stored securely on authenticated cloud media storage.
* **Data Sharing**: Data is NEVER shared with third-party advertising brokers. Location is only shared with designated trusted emergency contacts during active SOS.

---

## 5. Google Play Console Release Steps

1. **Log in to Google Play Console**: Navigate to [play.google.com/console](https://play.google.com/console).
2. **Select App**: Choose `CasualMeet` (or click **Create app** if first time).
3. **App Details**:
   - Default language: English (United States)
   - App or game: App
   - Free or paid: Free
4. **App Content & Store Listing**:
   - Provide Privacy Policy URL: `https://your-domain.com/privacy`
   - Complete **Data safety** questionnaire using Section 4 above.
   - Set Target Audience to 18+ (Dating/Meetup/Safety platform).
5. **Upload Bundle**:
   - Go to **Release > Production > Create new release**.
   - Drag and drop `android/app/build/outputs/bundle/release/app-release.aab`.
   - Name the release `1.0.0 (Initial Public Release)`.
   - Add release notes describing features: Meetup safety timers, emergency SOS, verified profiles, and community discovery.
6. **Review and Roll Out**: Click **Review release**, verify 0 blocking errors, and submit for Google review.
