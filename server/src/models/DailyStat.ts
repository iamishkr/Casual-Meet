import mongoose, { Schema, Document } from 'mongoose';

export interface IDailyStat extends Document {
  date: string; // e.g. "24 Aug"
  dateKey: string; // e.g. "2026-08-24"
  registrations: number;
  connections: number;
  messages: number;
  sos: number;
  createdAt: Date;
  updatedAt: Date;
}

const DailyStatSchema = new Schema<IDailyStat>(
  {
    date: { type: String, required: true },
    dateKey: { type: String, required: true, unique: true },
    registrations: { type: Number, default: 0 },
    connections: { type: Number, default: 0 },
    messages: { type: Number, default: 0 },
    sos: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const DailyStat = mongoose.model<IDailyStat>('DailyStat', DailyStatSchema);
