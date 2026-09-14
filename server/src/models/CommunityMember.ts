import mongoose, { Schema, Document } from 'mongoose';

export type CommunityRole = 'owner' | 'admin' | 'member';
export type MembershipStatus = 'active' | 'pending';

export interface ICommunityMember extends Document {
  _id: mongoose.Types.ObjectId;
  communityId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  role: CommunityRole;
  status: MembershipStatus;
  joinedAt: Date;
  updatedAt: Date;
}

const CommunityMemberSchema = new Schema<ICommunityMember>(
  {
    communityId: { type: Schema.Types.ObjectId, ref: 'Community', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    role: {
      type: String,
      enum: ['owner', 'admin', 'member'],
      default: 'member',
    },
    status: {
      type: String,
      enum: ['active', 'pending'],
      default: 'active',
      index: true,
    },
    joinedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Unique compound index to prevent duplicate memberships
CommunityMemberSchema.index({ communityId: 1, userId: 1 }, { unique: true });
CommunityMemberSchema.index({ communityId: 1, status: 1, role: 1 });
CommunityMemberSchema.index({ userId: 1, status: 1 });

export const CommunityMember = mongoose.model<ICommunityMember>('CommunityMember', CommunityMemberSchema);
