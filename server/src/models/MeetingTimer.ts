import mongoose, { Schema, Document } from 'mongoose';

export type TimerStatus = 'active' | 'safe' | 'extended' | 'expired' | 'cancelled';

export interface IMeetingTimer extends Document {
  userId: mongoose.Types.ObjectId;
  meetWithUserId?: mongoose.Types.ObjectId;
  locationName: string;
  meetupLocation?: {
    type: 'Point';
    coordinates: [number, number];
  };
  durationMinutes: number;
  startedAt: Date;
  expiresAt: Date;
  checkSentAt?: Date;
  resolvedAt?: Date;
  status: TimerStatus;
  createdAt: Date;
  updatedAt: Date;
}

const MeetingTimerSchema = new Schema<IMeetingTimer>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    meetWithUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    locationName: { type: String, required: true, default: 'Public meetup' },
    meetupLocation: {
      type: {
        type: String,
        enum: ['Point'],
      },
      coordinates: [Number],
    },
    durationMinutes: { type: Number, required: true, min: 15, max: 480 },
    startedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
    checkSentAt: { type: Date },
    resolvedAt: { type: Date },
    status: {
      type: String,
      enum: ['active', 'safe', 'extended', 'expired', 'cancelled'],
      default: 'active',
    },
  },
  { timestamps: true }
);

MeetingTimerSchema.index({ userId: 1, status: 1 });
MeetingTimerSchema.index({ expiresAt: 1, status: 1 });

export const MeetingTimer = mongoose.model<IMeetingTimer>('MeetingTimer', MeetingTimerSchema);
