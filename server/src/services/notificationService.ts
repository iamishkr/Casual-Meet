import mongoose from 'mongoose';
import { Notification, NotificationType } from '../models/Notification.js';
import { emitToUser } from '../socket.js';
import { IUser } from '../models/User.js';
import { sendPushNotification } from './pushNotificationService.js';

export interface CreateNotificationParams {
  recipientId: mongoose.Types.ObjectId | string;
  actor?: IUser | { _id: mongoose.Types.ObjectId | string; name: string; username: string };
  type: NotificationType;
  title: string;
  message: string;
  targetType?: 'post' | 'comment' | 'story' | 'user' | 'chat' | 'community';
  targetId?: mongoose.Types.ObjectId | string;
}

/**
 * Authoritative notification helper:
 * 1. Persists notification record in MongoDB.
 * 2. Emits real-time event to recipient's personal socket room ('notification').
 * 3. Dispatches background push notifications (FCM/APNS) to all recipient's active devices.
 * Prevents user-to-user self-notifications while allowing system/safety alerts.
 */
export async function sendNotification(params: CreateNotificationParams): Promise<void> {
  const recipientStr = params.recipientId.toString();
  const actorIdStr = params.actor?._id ? params.actor._id.toString() : null;

  const isSystemAlert = ['safety_timer', 'sos_alert', 'system'].includes(params.type);

  // Never notify oneself on user-to-user interactions
  if (!isSystemAlert && actorIdStr && recipientStr === actorIdStr) {
    return;
  }

  try {
    const notification = await Notification.create({
      recipientId: new mongoose.Types.ObjectId(recipientStr),
      actorId: !isSystemAlert && actorIdStr && mongoose.Types.ObjectId.isValid(actorIdStr)
        ? new mongoose.Types.ObjectId(actorIdStr)
        : undefined,
      type: params.type,
      title: params.title,
      message: params.message,
      targetType: params.targetType,
      targetId: params.targetId ? new mongoose.Types.ObjectId(params.targetId.toString()) : undefined,
    });

    // 1. Real-time delivery via socket
    emitToUser(recipientStr, 'notification', {
      id: notification._id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      targetType: notification.targetType,
      targetId: notification.targetId,
      actor: params.actor
        ? {
            id: params.actor._id,
            name: params.actor.name,
            username: params.actor.username,
          }
        : undefined,
      createdAt: notification.createdAt,
    });

    // 2. Background Push Notification delivery to registered devices (FCM / APNs)
    const isHighPriority = params.type === 'sos_alert' || params.type === 'safety_timer';
    sendPushNotification(recipientStr, {
      title: params.title,
      body: params.message,
      data: {
        notificationId: notification._id.toString(),
        type: params.type,
        targetType: params.targetType || '',
        targetId: params.targetId ? params.targetId.toString() : '',
      },
      priority: isHighPriority ? 'high' : 'normal',
      sound: isHighPriority ? 'emergency' : 'default',
    }).catch((pushErr) => {
      console.warn('[NotificationService] Push notification dispatch error:', pushErr?.message || pushErr);
    });
  } catch (err) {
    console.error('Failed to create or emit notification:', err);
  }
}

