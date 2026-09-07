import mongoose, { Schema, Document } from 'mongoose';

export type SafeZoneCategory = 'police_station' | 'cafe' | 'public_transit' | 'mall' | 'hospital';

export interface ISafeZone extends Document {
  name: string;
  category: SafeZoneCategory;
  location: {
    type: 'Point';
    coordinates: [number, number]; // [lng, lat]
  };
  area: string;
  createdAt: Date;
  updatedAt: Date;
}

const SafeZoneSchema = new Schema<ISafeZone>(
  {
    name: { type: String, required: true },
    category: {
      type: String,
      enum: ['police_station', 'cafe', 'public_transit', 'mall', 'hospital'],
      required: true,
    },
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
    area: { type: String, required: true },
  },
  { timestamps: true }
);

SafeZoneSchema.index({ location: '2dsphere' });

export const SafeZone = mongoose.model<ISafeZone>('SafeZone', SafeZoneSchema);
