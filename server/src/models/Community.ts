import mongoose, { Schema, Document } from 'mongoose';

export type CommunityPrivacy = 'public' | 'private';
export type CommunityStatus = 'active' | 'suspended';

export interface ICommunity extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  slug: string;
  description: string;
  avatar?: string;
  coverImage?: string;
  ownerId: mongoose.Types.ObjectId;
  privacy: CommunityPrivacy;
  status: CommunityStatus;
  memberCount: number;
  postCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const CommunitySchema = new Schema<ICommunity>(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 120 },
    description: { type: String, default: '', trim: true, maxlength: 1000 },
    avatar: { type: String },
    coverImage: { type: String },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    privacy: {
      type: String,
      enum: ['public', 'private'],
      default: 'public',
      index: true,
    },
    status: {
      type: String,
      enum: ['active', 'suspended'],
      default: 'active',
      index: true,
    },
    memberCount: { type: Number, default: 1, min: 0 },
    postCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

CommunitySchema.index({ status: 1, createdAt: -1 });

export const Community = mongoose.model<ICommunity>('Community', CommunitySchema);
