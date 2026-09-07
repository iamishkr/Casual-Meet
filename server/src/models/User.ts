import mongoose, { Schema, Document } from 'mongoose';

export type Role = 'user' | 'moderator' | 'super_admin';
export type AllowMessages = 'everyone' | 'connections' | 'none';

export interface IUser extends Document {
  username: string;
  email: string;
  passwordHash: string;
  name: string;
  phone: string;
  age: number;
  bio: string;
  occupation: string;
  city: string;
  interests: string[];
  lookingFor: string;
  role: Role;
  isVerified: boolean;
  trustScore: number;
  showLocation: boolean;
  allowMessages: AllowMessages;
  avatarHue: number;
  onboardingComplete: boolean;
  expoPushToken?: string;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    age: { type: Number, default: 25 },
    bio: { type: String, default: 'CasualMeet explorer' },
    occupation: { type: String, default: 'Member' },
    city: { type: String, default: 'Bengaluru' },
    interests: { type: [String], default: ['Coffee', 'Meetups'] },
    lookingFor: { type: String, default: 'Friendship' },
    role: { type: String, enum: ['user', 'moderator', 'super_admin'], default: 'user' },
    isVerified: { type: Boolean, default: false },
    trustScore: { type: Number, default: 100 },
    showLocation: { type: Boolean, default: true },
    allowMessages: { type: String, enum: ['everyone', 'connections', 'none'], default: 'connections' },
    avatarHue: { type: Number, default: 36 },
    onboardingComplete: { type: Boolean, default: true },
    expoPushToken: { type: String },
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>('User', UserSchema);
