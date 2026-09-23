import mongoose, { Schema, Document } from 'mongoose';

export interface IDeviceToken extends Document {
  userId: mongoose.Types.ObjectId;
  token: string;
  platform: 'android' | 'ios' | 'web';
  deviceInfo?: string;
  lastActiveAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const DeviceTokenSchema = new Schema<IDeviceToken>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    token: { type: String, required: true, unique: true },
    platform: { type: String, enum: ['android', 'ios', 'web'], default: 'android' },
    deviceInfo: { type: String },
    lastActiveAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

DeviceTokenSchema.index({ userId: 1, platform: 1 });

export const DeviceToken = mongoose.model<IDeviceToken>('DeviceToken', DeviceTokenSchema);
