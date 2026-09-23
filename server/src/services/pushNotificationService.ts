import mongoose from 'mongoose';
import { DeviceToken } from '../models/DeviceToken.js';

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  priority?: 'high' | 'normal';
  sound?: string;
}

export interface PushDispatchResult {
  tokensTargeted: number;
  successCount: number;
  failureCount: number;
  simulated: boolean;
}

/**
 * Dispatches background push notifications to all registered devices for one or more users.
 * Supports production FCM (Firebase Cloud Messaging) via REST API,
 * and falls back to a clean simulation logger when FCM_SERVER_KEY is unconfigured.
 */
export async function sendPushNotification(
  userIds: (mongoose.Types.ObjectId | string)[] | mongoose.Types.ObjectId | string,
  payload: PushPayload
): Promise<PushDispatchResult> {
  const rawIds = Array.isArray(userIds) ? userIds : [userIds];
  const validIds: mongoose.Types.ObjectId[] = [];

  for (const id of rawIds) {
    if (id && mongoose.Types.ObjectId.isValid(id.toString())) {
      validIds.push(new mongoose.Types.ObjectId(id.toString()));
    }
  }

  if (validIds.length === 0) {
    return { tokensTargeted: 0, successCount: 0, failureCount: 0, simulated: false };
  }

  // Find all active device tokens for target users
  const deviceRecords = await DeviceToken.find({ userId: { $in: validIds } });
  if (deviceRecords.length === 0) {
    return { tokensTargeted: 0, successCount: 0, failureCount: 0, simulated: false };
  }

  const tokens = deviceRecords.map((d) => d.token);
  const fcmKey = process.env.FCM_SERVER_KEY || process.env.FIREBASE_SERVER_KEY;

  // 1. Live FCM Cloud Messaging (when credentials provided in production)
  if (fcmKey) {
    try {
      const fcmUrl = 'https://fcm.googleapis.com/fcm/send';
      let successCount = 0;
      let failureCount = 0;
      const invalidTokens: string[] = [];

      // Batch in chunks of 500 (FCM registration_ids limit)
      const chunkSize = 500;
      for (let i = 0; i < tokens.length; i += chunkSize) {
        const chunk = tokens.slice(i, i + chunkSize);
        const res = await fetch(fcmUrl, {
          method: 'POST',
          headers: {
            Authorization: `key=${fcmKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            registration_ids: chunk,
            notification: {
              title: payload.title,
              body: payload.body,
              sound: payload.sound || 'default',
            },
            data: payload.data || {},
            priority: payload.priority === 'high' ? 'high' : 'normal',
          }),
        });

        if (res.ok) {
          const result: any = await res.json();
          successCount += result.success || 0;
          failureCount += result.failure || 0;

          // Collect dead tokens for auto-cleanup
          if (Array.isArray(result.results)) {
            result.results.forEach((r: any, idx: number) => {
              if (r.error === 'NotRegistered' || r.error === 'InvalidRegistration') {
                invalidTokens.push(chunk[idx]);
              }
            });
          }
        } else {
          failureCount += chunk.length;
          console.warn(`[PushNotification] FCM response error (${res.status}):`, await res.text());
        }
      }

      // Auto-prune stale/invalidated tokens
      if (invalidTokens.length > 0) {
        await DeviceToken.deleteMany({ token: { $in: invalidTokens } });
      }

      return {
        tokensTargeted: tokens.length,
        successCount,
        failureCount,
        simulated: false,
      };
    } catch (err) {
      console.error('[PushNotification] Error sending FCM push notification:', err);
      return {
        tokensTargeted: tokens.length,
        successCount: 0,
        failureCount: tokens.length,
        simulated: false,
      };
    }
  }

  // 2. Development Simulation Mode (zero-crash fallback)
  console.log(
    `[PushNotification] (Simulated) "${payload.title}": "${payload.body}" -> dispatched to ${tokens.length} device token(s).`
  );

  return {
    tokensTargeted: tokens.length,
    successCount: tokens.length,
    failureCount: 0,
    simulated: true,
  };
}
