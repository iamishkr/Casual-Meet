import mongoose, { Schema, Document } from 'mongoose';

export type MediaType = 'image' | 'video';

export interface IMediaAsset extends Document {
  uploaderId: mongoose.Types.ObjectId;
  storageKey: string;
  originalFilename: string;
  mimeType: string;
  mediaType: MediaType;
  sizeBytes: number;
  width?: number;
  height?: number;
  duration?: number;
  isAttached: boolean;
  attachedToType?: 'post' | 'story' | 'community';
  attachedToId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const MediaAssetSchema = new Schema<IMediaAsset>(
  {
    uploaderId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    storageKey: { type: String, required: true, unique: true, index: true },
    originalFilename: { type: String, required: true },
    mimeType: { type: String, required: true },
    mediaType: { type: String, enum: ['image', 'video'], required: true },
    sizeBytes: { type: Number, required: true },
    width: { type: Number },
    height: { type: Number },
    duration: { type: Number },
    isAttached: { type: Boolean, default: false, index: true },
    attachedToType: { type: String, enum: ['post', 'story', 'community'] },
    attachedToId: { type: Schema.Types.ObjectId, index: true },
  },
  { timestamps: true }
);

MediaAssetSchema.index({ uploaderId: 1, isAttached: 1 });
// TTL index: strictly clean up unattached orphan media after 3 days; never delete attached post/story assets
MediaAssetSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 86400 * 3, partialFilterExpression: { isAttached: false } }
);

export const MediaAsset = mongoose.model<IMediaAsset>('MediaAsset', MediaAssetSchema);

