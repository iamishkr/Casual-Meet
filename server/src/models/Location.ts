import mongoose, { Schema, Document } from 'mongoose';

export interface ILocation extends Document {
  userId: mongoose.Types.ObjectId;
  location: {
    type: 'Point';
    coordinates: [number, number]; // [lng, lat]
  };
  updatedAt: Date;
}

const LocationSchema = new Schema<ILocation>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
        required: true,
      },
      coordinates: {
        type: [Number],
        required: true,
      },
    },
  },
  { timestamps: true }
);

// 2dsphere index for real MongoDB $geoNear queries
LocationSchema.index({ location: '2dsphere' });

export const Location = mongoose.model<ILocation>('Location', LocationSchema);
