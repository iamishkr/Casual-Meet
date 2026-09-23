import mongoose, { Schema, Document } from 'mongoose';

export type DeliveryStatus = 'pending' | 'sending' | 'sent' | 'failed';
export type SmsGateway = 'fast2sms' | 'twilio';

export interface ISosDeliveryLog extends Document {
  sosId: mongoose.Types.ObjectId;
  contactId?: mongoose.Types.ObjectId;
  contactName: string;
  contactPhone: string;
  gateway: SmsGateway;
  status: DeliveryStatus;
  attempts: number;
  gatewayResponse?: {
    sid?: string;
    status?: string;
    cost?: string;
    mode?: string;
    note?: string;
  };
  lastError?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SosDeliveryLogSchema = new Schema<ISosDeliveryLog>(
  {
    sosId: { type: Schema.Types.ObjectId, ref: 'SosEvent', required: true },
    contactId: { type: Schema.Types.ObjectId, ref: 'EmergencyContact' },
    contactName: { type: String, required: true },
    contactPhone: { type: String, required: true },
    gateway: { type: String, enum: ['fast2sms', 'twilio'], required: true },
    status: { type: String, enum: ['pending', 'sending', 'sent', 'failed'], default: 'pending' },
    attempts: { type: Number, default: 1 },
    gatewayResponse: {
      sid: String,
      status: String,
      cost: String,
      mode: String,
      note: String,
    },
    lastError: { type: String },
  },
  { timestamps: true }
);

SosDeliveryLogSchema.index({ sosId: 1 });

export const SosDeliveryLog = mongoose.model<ISosDeliveryLog>('SosDeliveryLog', SosDeliveryLogSchema);
