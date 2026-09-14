import mongoose, { Schema, Document } from 'mongoose';
import { ModerationStatus } from './Post.js';

export interface IPostComment extends Document {
  postId: mongoose.Types.ObjectId;
  authorId: mongoose.Types.ObjectId;
  text: string;
  isEdited: boolean;
  editedAt?: Date;
  isDeleted: boolean;
  deletedAt?: Date;
  moderationStatus: ModerationStatus;
  createdAt: Date;
  updatedAt: Date;
}

const PostCommentSchema = new Schema<IPostComment>(
  {
    postId: { type: Schema.Types.ObjectId, ref: 'Post', required: true, index: true },
    authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    text: { type: String, required: true, maxlength: 1000 },
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
  },
  { timestamps: true }
);

PostCommentSchema.index({ postId: 1, createdAt: 1 });
PostCommentSchema.index({ authorId: 1, createdAt: -1 });

export const PostComment = mongoose.model<IPostComment>('PostComment', PostCommentSchema);
