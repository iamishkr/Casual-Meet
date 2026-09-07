import mongoose, { Schema, Document } from 'mongoose';

export type ReportStatus = 'pending' | 'actioned' | 'dismissed';
export type ReportOutcome = 'user_suspended' | 'warning_issued' | 'false_report';

export interface IUserReport extends Document {
  reporterId: mongoose.Types.ObjectId;
  reportedUserId: mongoose.Types.ObjectId;
  reason: string;
  details: string;
  status: ReportStatus;
  actionNote?: string;
  outcome?: ReportOutcome;
  resolvedBy?: mongoose.Types.ObjectId;
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserReportSchema = new Schema<IUserReport>(
  {
    reporterId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reportedUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reason: { type: String, required: true },
    details: { type: String, default: '' },
    status: { type: String, enum: ['pending', 'actioned', 'dismissed'], default: 'pending' },
    actionNote: { type: String },
    outcome: { type: String, enum: ['user_suspended', 'warning_issued', 'false_report'] },
    resolvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    resolvedAt: { type: Date },
  },
  { timestamps: true }
);

UserReportSchema.index({ status: 1, createdAt: -1 });

export const UserReport = mongoose.model<IUserReport>('UserReport', UserReportSchema);
