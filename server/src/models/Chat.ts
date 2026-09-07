import mongoose, { Schema, Document } from 'mongoose';

export interface IChat extends Document {
  type: 'direct' | 'group';
  participants: mongoose.Types.ObjectId[];
  lastMessageAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ChatSchema = new Schema<IChat>(
  {
    type: { type: String, enum: ['direct', 'group'], default: 'direct' },
    participants: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    lastMessageAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

ChatSchema.index({ participants: 1 });

export const Chat = mongoose.model<IChat>('Chat', ChatSchema);
