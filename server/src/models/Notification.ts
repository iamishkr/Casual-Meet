import mongoose, { Schema, Document } from 'mongoose';

export type NotificationType =
  | 'new_follower'
  | 'post_liked'
  | 'post_commented'
  | 'new_message'
  | 'connection_accepted'
  | 'connection_requested'
  | 'community_join_request'
  | 'community_joined'
  | 'community_approved'
  | 'community_rejected'
  | 'community_role_updated'
  | 'community_post'
  | 'safety_timer'
  | 'sos_alert'
  | 'system';

export interface INotification extends Document {
  recipientId: mongoose.Types.ObjectId;
  actorId?: mongoose.Types.ObjectId;
  type: NotificationType;
  targetType?: 'post' | 'comment' | 'story' | 'user' | 'chat' | 'community';
  targetId?: mongoose.Types.ObjectId;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    recipientId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    actorId: { type: Schema.Types.ObjectId, ref: 'User' },
    type: {
      type: String,
      enum: [
        'new_follower',
        'post_liked',
        'post_commented',
        'new_message',
        'connection_accepted',
        'connection_requested',
        'community_join_request',
        'community_joined',
        'community_approved',
        'community_rejected',
        'community_role_updated',
        'community_post',
        'safety_timer',
        'sos_alert',
        'system',
      ],
      required: true,
    },
    targetType: { type: String, enum: ['post', 'comment', 'story', 'user', 'chat', 'community'] },
    targetId: { type: Schema.Types.ObjectId },
    title: { type: String, required: true },
    message: { type: String, required: true },
    isRead: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

NotificationSchema.index({ recipientId: 1, createdAt: -1 });
NotificationSchema.index({ recipientId: 1, isRead: 1 });

export const Notification = mongoose.model<INotification>('Notification', NotificationSchema);
