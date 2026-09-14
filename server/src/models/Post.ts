import mongoose, { Schema, Document } from 'mongoose';

export type PostVisibility = 'public' | 'followers' | 'connections' | 'private';
export type ModerationStatus = 'visible' | 'flagged' | 'hidden';

export interface IPostMediaItem {
  url: string;
  storageKey: string;
  mediaType: 'image' | 'video';
  width?: number;
  height?: number;
  duration?: number;
  thumbnail?: string;
}

export interface IPost extends Document {
  authorId: mongoose.Types.ObjectId;
  communityId?: mongoose.Types.ObjectId;
  caption: string;
  media: IPostMediaItem[];
  visibility: PostVisibility;
  locationName?: string;
  likeCount: number;
  commentCount: number;
  isEdited: boolean;
  editedAt?: Date;
  isDeleted: boolean;
  deletedAt?: Date;
  moderationStatus: ModerationStatus;
  moderationReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PostMediaSchema = new Schema<IPostMediaItem>(
  {
    url: { type: String, required: true },
    storageKey: { type: String, required: true },
    mediaType: { type: String, enum: ['image', 'video'], required: true },
    width: { type: Number },
    height: { type: Number },
    duration: { type: Number },
    thumbnail: { type: String },
  },
  { _id: false }
);

const PostSchema = new Schema<IPost>(
  {
    authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    communityId: { type: Schema.Types.ObjectId, ref: 'Community', index: true },
    caption: { type: String, default: '', maxlength: 2200 },
    media: { type: [PostMediaSchema], default: [] },
    visibility: {
      type: String,
      enum: ['public', 'followers', 'connections', 'private'],
      default: 'public',
      index: true,
    },
    locationName: { type: String, maxlength: 100 },
    likeCount: { type: Number, default: 0, min: 0 },
    commentCount: { type: Number, default: 0, min: 0 },
    isEdited: { type: Boolean, default: false },
    editedAt: { type: Date },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date },
    moderationStatus: {
      type: String,
      enum: ['visible', 'flagged', 'hidden'],
      default: 'visible',
      index: true,
    },
    moderationReason: { type: String },
  },
  { timestamps: true }
);

PostSchema.index({ authorId: 1, createdAt: -1 });
PostSchema.index({ visibility: 1, createdAt: -1 });
PostSchema.index({ isDeleted: 1, moderationStatus: 1, visibility: 1, createdAt: -1 });
PostSchema.index({ communityId: 1, isDeleted: 1, moderationStatus: 1, createdAt: -1 });

export const Post = mongoose.model<IPost>('Post', PostSchema);
