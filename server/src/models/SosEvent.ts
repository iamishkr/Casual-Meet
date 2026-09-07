import mongoose, { Schema, Document } from 'mongoose';

export type SosStatus = 'active' | 'resolved' | 'false_alarm';
export type SosSource = 'manual' | 'timer_expired';

export interface ISosEvent extends Document {
  userId: mongoose.Types.ObjectId;
  source: SosSource;
  location?: {
    type: 'Point';
    coordinates: [number, number];
  };
  locationName: string;
  status: SosStatus;
  smsSent: boolean;
  adminNotified: boolean;
  contactsNotified: number;
  triggeredTimerId?: mongoose.Types.ObjectId;
  resolvedAt?: Date;
  resolvedBy?: mongoose.Types.ObjectId;
  resolvedByRole?: string;
  lastDispatchAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SosEventSchema = new Schema<ISosEvent>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    source: { type: String, enum: ['manual', 'timer_expired'], default: 'manual' },
    location: {
      type: {
        type: String,
        enum: ['Point'],
      },
      coordinates: [Number],
    },
    locationName: { type: String, default: 'Unknown location' },
    status: { type: String, enum: ['active', 'resolved', 'false_alarm'], default: 'active' },
    smsSent: { type: Boolean, default: false },
    adminNotified: { type: Boolean, default: true },
    contactsNotified: { type: Number, default: 0 },
    triggeredTimerId: { type: Schema.Types.ObjectId, ref: 'MeetingTimer' },
    resolvedAt: { type: Date },
    resolvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    resolvedByRole: { type: String },
    lastDispatchAt: { type: Date },
  },
  { timestamps: true }
);

SosEventSchema.index({ status: 1, createdAt: -1 });
SosEventSchema.index({ userId: 1, status: 1 });

export const SosEvent = mongoose.model<ISosEvent>('SosEvent', SosEventSchema);
