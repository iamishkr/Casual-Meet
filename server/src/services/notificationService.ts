import mongoose from 'mongoose';
import { Notification, NotificationType } from '../models/Notification.js';
import { emitToUser } from '../socket.js';
import { IUser } from '../models/User.js';

export interface CreateNotificationParams {
  recipientId: mongoose.Types.ObjectId | string;
  actor: IUser | { _id: mongoose.Types.ObjectId | string; name: string; username: string };
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
 * Prevents self-notifications.
 */
export async function sendNotification(params: CreateNotificationParams): Promise<void> {
  const recipientStr = params.recipientId.toString();
  const actorIdStr = params.actor._id.toString();

  // Never notify oneself
  if (recipientStr === actorIdStr) {
    return;
  }

  try {
    const notification = await Notification.create({
      recipientId: new mongoose.Types.ObjectId(recipientStr),
      actorId: new mongoose.Types.ObjectId(actorIdStr),
      type: params.type,
      title: params.title,
      message: params.message,
      targetType: params.targetType,
      targetId: params.targetId ? new mongoose.Types.ObjectId(params.targetId.toString()) : undefined,
    });

    // Real-time delivery via socket
    emitToUser(recipientStr, 'notification', {
      id: notification._id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      targetType: notification.targetType,
      targetId: notification.targetId,
      actor: {
        id: params.actor._id,
        name: params.actor.name,
        username: params.actor.username,
      },
      createdAt: notification.createdAt,
    });
  } catch (err) {
    console.error('Failed to create or emit notification:', err);
  }
}
