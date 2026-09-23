import crypto from 'crypto';
import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { Location } from '../models/Location.js';
import { EmergencyContact } from '../models/EmergencyContact.js';
import { Suspension } from '../models/Suspension.js';
import { MeetingTimer } from '../models/MeetingTimer.js';
import { SosEvent } from '../models/SosEvent.js';
import { Connection } from '../models/Connection.js';
import { Follow } from '../models/Follow.js';
import { Notification } from '../models/Notification.js';
import { DeviceToken } from '../models/DeviceToken.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { getJwtSecret } from '../config/jwt.js';

const router = Router();

// -------------------------------------------------------------
// In-Memory Brute-Force Rate Limiting for Authentication
// -------------------------------------------------------------
interface AttemptRecord {
  count: number;
  firstAttempt: number;
  lockedUntil?: number;
}
const loginAttempts = new Map<string, AttemptRecord>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const LOCKOUT_MS = 5 * 60 * 1000; // 5 minutes lockout

function checkRateLimit(key: string): { allowed: boolean; waitSeconds?: number } {
  const now = Date.now();
  const record = loginAttempts.get(key);
  if (!record) return { allowed: true };

  if (record.lockedUntil && record.lockedUntil > now) {
    const waitSeconds = Math.ceil((record.lockedUntil - now) / 1000);
    return { allowed: false, waitSeconds };
  }

  // If window expired, reset record
  if (now - record.firstAttempt > WINDOW_MS && (!record.lockedUntil || record.lockedUntil <= now)) {
    loginAttempts.delete(key);
    return { allowed: true };
  }

  return { allowed: true };
}

function recordFailedAttempt(key: string): void {
  const now = Date.now();
  const record = loginAttempts.get(key);
  if (!record || now - record.firstAttempt > WINDOW_MS) {
    loginAttempts.set(key, { count: 1, firstAttempt: now });
  } else {
    record.count += 1;
    if (record.count >= MAX_ATTEMPTS) {
      record.lockedUntil = now + LOCKOUT_MS;
    }
  }
}

function resetLoginAttempts(key: string): void {
  loginAttempts.delete(key);
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_REGEX = /^[a-zA-Z0-9._]{3,30}$/;

// -------------------------------------------------------------
// POST /api/auth/register - Register a new user
// -------------------------------------------------------------
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, username, email, password, phone, city, occupation, emergencyContactName, emergencyContactPhone } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      res.status(400).json({ error: 'Full name is required (minimum 2 characters).' });
      return;
    }

    const cleanUsername = username?.toLowerCase().trim();
    if (!cleanUsername || !USERNAME_REGEX.test(cleanUsername)) {
      res.status(400).json({ error: 'Username must be 3-30 characters (letters, numbers, dots, and underscores only).' });
      return;
    }

    const cleanEmail = email?.toLowerCase().trim();
    if (!cleanEmail || !EMAIL_REGEX.test(cleanEmail)) {
      res.status(400).json({ error: 'A valid email address is required.' });
      return;
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      res.status(400).json({ error: 'Password is required and must be at least 6 characters long.' });
      return;
    }

    if (!phone || typeof phone !== 'string' || phone.trim().length < 7) {
      res.status(400).json({ error: 'A valid phone number is required.' });
      return;
    }

    // Check uniqueness
    const existing = await User.findOne({
      $or: [{ username: cleanUsername }, { email: cleanEmail }],
    });

    if (existing) {
      res.status(400).json({ error: 'Username or email already in use.' });
      return;
    }

    // Hash password with bcrypt
    const passwordHash = await bcrypt.hash(password, 10);

    // SECURITY: Public registration is strictly restricted to role: 'user' to prevent privilege escalation
    const user = await User.create({
      name: name.trim(),
      username: cleanUsername,
      email: cleanEmail,
      passwordHash,
      phone: phone.trim(),
      city: city?.trim() || 'Bengaluru',
      occupation: occupation?.trim() || 'Member',
      role: 'user',
      avatarHue: Math.floor(Math.random() * 360),
    });

    // Default location (Bengaluru center + random jitter)
    await Location.create({
      userId: user._id,
      location: {
        type: 'Point',
        coordinates: [77.6245 + (Math.random() - 0.5) * 0.05, 12.9352 + (Math.random() - 0.5) * 0.05],
      },
    });

    // Optional emergency contact
    if (emergencyContactName && emergencyContactPhone) {
      await EmergencyContact.create({
        userId: user._id,
        name: emergencyContactName.trim(),
        phone: emergencyContactPhone.trim(),
        relationship: 'family',
      });
    }

    const token = jwt.sign({ userId: user._id }, getJwtSecret(), { expiresIn: '30d' });
    res.status(201).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        phone: user.phone,
        role: user.role,
        trustScore: user.trustScore,
        isVerified: user.isVerified,
        avatarHue: user.avatarHue,
        city: user.city,
        occupation: user.occupation,
      },
    });
  } catch (err: any) {
    console.error('Registration error:', err);
    res.status(500).json({ error: err.message || 'Registration failed.' });
  }
});

// -------------------------------------------------------------
// POST /api/auth/login - Authenticate user & issue JWT
// -------------------------------------------------------------
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { identifier, password, targetRole } = req.body;

    // 1. Mandatory Input Validation
    if (!identifier || typeof identifier !== 'string' || !identifier.trim()) {
      res.status(400).json({ error: 'Username or email is required.' });
      return;
    }
    if (!password || typeof password !== 'string') {
      res.status(400).json({ error: 'Password is required.' });
      return;
    }

    const clean = identifier.toLowerCase().trim();
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const rateLimitKey = `${clientIp}_${clean}`;

    // 2. Rate Limiting Check
    const rateLimit = checkRateLimit(rateLimitKey);
    if (!rateLimit.allowed) {
      res.status(429).json({
        error: `Too many failed login attempts. Please wait ${rateLimit.waitSeconds} seconds before trying again.`,
        retryAfter: rateLimit.waitSeconds,
      });
      return;
    }

    // 3. User Lookup
    const user = await User.findOne({
      $or: [{ username: clean }, { email: clean }],
    });

    if (!user) {
      recordFailedAttempt(rateLimitKey);
      res.status(401).json({ error: 'Invalid username or password.' });
      return;
    }

    // 4. Strict Password Verification with bcrypt
    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      recordFailedAttempt(rateLimitKey);
      res.status(401).json({ error: 'Invalid username or password.' });
      return;
    }

    // Reset rate limiter on successful authentication
    resetLoginAttempts(rateLimitKey);

    // 5. Active Suspension Check
    const suspension = await Suspension.findOne({
      userId: user._id,
      isActive: true,
      $or: [{ expiresAt: { $exists: false } }, { expiresAt: { $gt: new Date() } }],
    });

    if (suspension) {
      res.status(403).json({
        error: `Account suspended (${suspension.type}): ${suspension.reason}`,
        suspended: true,
      });
      return;
    }

    // 6. Target Role Verification
    if (targetRole === 'super_admin' || targetRole === 'admin') {
      if (user.role !== 'super_admin' && user.role !== 'moderator') {
        res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
        return;
      }
    }

    // 7. Issue JWT Session Token
    const token = jwt.sign({ userId: user._id }, getJwtSecret(), { expiresIn: '30d' });
    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        phone: user.phone,
        role: user.role,
        trustScore: user.trustScore,
        isVerified: user.isVerified,
        avatarHue: user.avatarHue,
        city: user.city,
        occupation: user.occupation,
      },
    });
  } catch (err: any) {
    console.error('Login error:', err);
    res.status(500).json({ error: err.message || 'Login failed.' });
  }
});

// -------------------------------------------------------------
// POST /api/auth/forgot-password - Request password reset token
// -------------------------------------------------------------
router.post('/forgot-password', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
      res.status(400).json({ error: 'A valid email address is required.' });
      return;
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: cleanEmail });

    if (!user) {
      // Return ambiguous message to prevent email enumeration
      res.json({ message: 'If that email address is registered, a password reset link has been dispatched.' });
      return;
    }

    // Generate secure reset token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour expiration
    await user.save();

    res.json({
      message: 'If that email address is registered, a password reset link has been dispatched.',
      resetToken: rawToken, // Provided directly for immediate testing and client use
    });
  } catch (err: any) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: err.message || 'Failed to process password reset.' });
  }
});

// -------------------------------------------------------------
// POST /api/auth/reset-password - Reset password using valid token
// -------------------------------------------------------------
router.post('/reset-password', async (req: Request, res: Response): Promise<void> => {
  try {
    const { resetToken, newPassword } = req.body;

    if (!resetToken || typeof resetToken !== 'string') {
      res.status(400).json({ error: 'Reset token is required.' });
      return;
    }

    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
      res.status(400).json({ error: 'New password must be at least 6 characters long.' });
      return;
    }

    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!user) {
      res.status(400).json({ error: 'Invalid or expired password reset token.' });
      return;
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ message: 'Password has been reset successfully. You can now log in with your new password.' });
  } catch (err: any) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: err.message || 'Failed to reset password.' });
  }
});

// -------------------------------------------------------------
// POST /api/auth/change-password - Update password when logged in
// -------------------------------------------------------------
router.post('/change-password', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: 'Current password and new password are required.' });
      return;
    }

    if (typeof newPassword !== 'string' || newPassword.length < 6) {
      res.status(400).json({ error: 'New password must be at least 6 characters long.' });
      return;
    }

    const user = await User.findById(req.user!._id);
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    const match = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!match) {
      res.status(400).json({ error: 'Current password does not match.' });
      return;
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({ message: 'Password updated successfully.' });
  } catch (err: any) {
    console.error('Change password error:', err);
    res.status(500).json({ error: err.message || 'Failed to change password.' });
  }
});

// -------------------------------------------------------------
// POST /api/auth/logout - Logout / Invalidate session
// -------------------------------------------------------------
router.post('/logout', (_req: Request, res: Response): void => {
  res.json({ message: 'Successfully logged out.' });
});

// -------------------------------------------------------------
// GET /api/auth/me - Current Authenticated User Profile
// -------------------------------------------------------------
router.get('/me', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const user = req.user!;
  res.json({
    id: user._id,
    name: user.name,
    username: user.username,
    email: user.email,
    phone: user.phone,
    role: user.role,
    trustScore: user.trustScore,
    isVerified: user.isVerified,
    showLocation: user.showLocation,
    allowMessages: user.allowMessages,
    avatarHue: user.avatarHue,
    city: user.city,
    occupation: user.occupation,
    bio: user.bio,
    interests: user.interests,
  });
});

// -------------------------------------------------------------
// DELETE /api/auth/delete-account - Self-Service Account Deletion (App Store / Play Store Mandate)
// -------------------------------------------------------------
router.delete('/delete-account', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const userId = user._id;

    // 1. Cancel active meeting safety timers
    await MeetingTimer.updateMany(
      { userId, status: { $in: ['active', 'extended'] } },
      { $set: { status: 'cancelled' } }
    );

    // 2. Resolve any active SOS emergencies
    await SosEvent.updateMany(
      { userId, status: 'active' },
      { $set: { status: 'resolved', resolvedAt: new Date() } }
    );

    // 3. Purge personal location records
    await Location.deleteMany({ userId });

    // 4. Purge emergency contacts
    await EmergencyContact.deleteMany({ userId });

    // 5. Clean up social relationships (connections, follows)
    await Connection.deleteMany({
      $or: [{ requesterId: userId }, { recipientId: userId }],
    });
    await Follow.deleteMany({
      $or: [{ followerId: userId }, { followingId: userId }],
    });

    // 6. Purge notifications and registered device tokens
    await Notification.deleteMany({ recipientId: userId });
    await DeviceToken.deleteMany({ userId });

    // 7. Delete user account record
    await User.findByIdAndDelete(userId);

    res.json({
      success: true,
      message: 'Your account and all associated personal data have been permanently deleted.',
    });
  } catch (err: any) {
    console.error('Account deletion error:', err);
    res.status(500).json({ error: err.message || 'Failed to delete account.' });
  }
});

export default router;
