import mongoose, { Schema, Document } from 'mongoose';

export type Relationship = 'family' | 'friend' | 'partner' | 'colleague' | 'other';

export interface IEmergencyContact extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  phone: string;
  relationship: Relationship;
  notifyOnSos: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const EmergencyContactSchema = new Schema<IEmergencyContact>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    relationship: {
      type: String,
      enum: ['family', 'friend', 'partner', 'colleague', 'other'],
      default: 'family',
    },
    notifyOnSos: { type: Boolean, default: true },
  },
  { timestamps: true }
);

EmergencyContactSchema.index({ userId: 1 });

export const EmergencyContact = mongoose.model<IEmergencyContact>('EmergencyContact', EmergencyContactSchema);
