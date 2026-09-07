import mongoose, { Schema, Document } from 'mongoose';

export type MsgType = 'text' | 'image' | 'location';
export type MsgStatus = 'sent' | 'delivered' | 'read';
export type SensitiveKind = 'phone' | 'upi' | 'address' | 'pii';

export interface IMessage extends Document {
  chatId: mongoose.Types.ObjectId;
  senderId: mongoose.Types.ObjectId;
  content: string;
  type: MsgType;
  containsSensitive: boolean;
  sensitiveKinds: SensitiveKind[];
  revealedBy: mongoose.Types.ObjectId[];
  status: MsgStatus;
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema = new Schema<IMessage>(
  {
    chatId: { type: Schema.Types.ObjectId, ref: 'Chat', required: true },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true },
    type: { type: String, enum: ['text', 'image', 'location'], default: 'text' },
    containsSensitive: { type: Boolean, default: false },
    sensitiveKinds: { type: [String], default: [] },
    revealedBy: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    status: { type: String, enum: ['sent', 'delivered', 'read'], default: 'sent' },
  },
  { timestamps: true }
);

MessageSchema.index({ chatId: 1, createdAt: -1 });

export const Message = mongoose.model<IMessage>('Message', MessageSchema);
