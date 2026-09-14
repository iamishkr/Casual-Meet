import mongoose, { Schema, Document } from 'mongoose';

export interface IStoryView extends Document {
  storyId: mongoose.Types.ObjectId;
  viewerId: mongoose.Types.ObjectId;
  createdAt: Date;
}

const StoryViewSchema = new Schema<IStoryView>(
  {
    storyId: { type: Schema.Types.ObjectId, ref: 'Story', required: true, index: true },
    viewerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

StoryViewSchema.index({ storyId: 1, viewerId: 1 }, { unique: true });
StoryViewSchema.index({ storyId: 1, createdAt: -1 });

export const StoryView = mongoose.model<IStoryView>('StoryView', StoryViewSchema);
