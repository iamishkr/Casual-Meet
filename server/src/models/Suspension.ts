import mongoose, { Schema, Document } from 'mongoose';

export type SuspendType = 'temporary' | 'permanent' | 'shadow_ban';

export interface ISuspension extends Document {
  userId: mongoose.Types.ObjectId;
  suspendedBy: mongoose.Types.ObjectId;
  type: SuspendType;
  reason: string;
  isActive: boolean;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SuspensionSchema = new Schema<ISuspension>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    suspendedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['temporary', 'permanent', 'shadow_ban'], default: 'temporary' },
    reason: { type: String, required: true },
    isActive: { type: Boolean, default: true },
    expiresAt: { type: Date },
  },
  { timestamps: true }
);

SuspensionSchema.index({ userId: 1, isActive: 1 });

export const Suspension = mongoose.model<ISuspension>('Suspension', SuspensionSchema);
