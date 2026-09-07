import mongoose, { Schema, Document } from 'mongoose';

export type ConnStatus = 'pending' | 'accepted' | 'rejected' | 'blocked';

export interface IConnection extends Document {
  requesterId: mongoose.Types.ObjectId;
  receiverId: mongoose.Types.ObjectId;
  status: ConnStatus;
  createdAt: Date;
  updatedAt: Date;
}

const ConnectionSchema = new Schema<IConnection>(
  {
    requesterId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    receiverId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected', 'blocked'],
      default: 'pending',
    },
  },
  { timestamps: true }
);

ConnectionSchema.index({ requesterId: 1, receiverId: 1 }, { unique: true });
ConnectionSchema.index({ receiverId: 1, status: 1 });

export const Connection = mongoose.model<IConnection>('Connection', ConnectionSchema);
