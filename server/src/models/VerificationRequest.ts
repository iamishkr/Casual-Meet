import mongoose, { Schema, Document } from 'mongoose';

export type VerifStatus = 'pending' | 'approved' | 'rejected';

export interface IVerificationRequest extends Document {
  userId: mongoose.Types.ObjectId;
  selfieUrl: string;
  status: VerifStatus;
  reviewNote?: string;
  reviewedBy?: mongoose.Types.ObjectId;
  reviewedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const VerificationRequestSchema = new Schema<IVerificationRequest>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    selfieUrl: { type: String, required: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    reviewNote: { type: String },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
  },
  { timestamps: true }
);

VerificationRequestSchema.index({ status: 1, createdAt: -1 });
VerificationRequestSchema.index({ userId: 1 });

export const VerificationRequest = mongoose.model<IVerificationRequest>('VerificationRequest', VerificationRequestSchema);
