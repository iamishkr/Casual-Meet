import mongoose, { Schema, Document } from 'mongoose';
import { ModerationStatus } from './Post.js';

export type StoryVisibility = 'public' | 'followers' | 'connections';

export interface IStoryMedia {
  url: string;
  storageKey: string;
  mediaType: 'image' | 'video';
  duration?: number;
}

export interface IStory extends Document {
  authorId: mongoose.Types.ObjectId;
  media: IStoryMedia;
  caption?: string;
  visibility: StoryVisibility;
  expiresAt: Date;
  isDeleted: boolean;
  deletedAt?: Date;
  moderationStatus: ModerationStatus;
  createdAt: Date;
  updatedAt: Date;
}

const StoryMediaSchema = new Schema<IStoryMedia>(
  {
    url: { type: String, required: true },
    storageKey: { type: String, required: true },
    mediaType: { type: String, enum: ['image', 'video'], required: true },
    duration: { type: Number },
  },
  { _id: false }
);

const StorySchema = new Schema<IStory>(
  {
    authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    media: { type: StoryMediaSchema, required: true },
    caption: { type: String, maxlength: 500 },
    visibility: {
      type: String,
      enum: ['public', 'followers', 'connections'],
      default: 'followers',
      index: true,
    },
    expiresAt: { type: Date, required: true },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date },
    moderationStatus: {
      type: String,
      enum: ['visible', 'flagged', 'hidden'],
      default: 'visible',
      index: true,
    },
  },
  { timestamps: true }
);

// MongoDB TTL index for automatic physical cleanup (application queries also filter expiresAt > now)
StorySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
StorySchema.index({ authorId: 1, expiresAt: -1 });

export const Story = mongoose.model<IStory>('Story', StorySchema);
