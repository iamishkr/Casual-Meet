import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User, IUser } from '../models/User.js';
import { Suspension } from '../models/Suspension.js';

import { getJwtSecret } from '../config/jwt.js';

export interface AuthRequest extends Request {
  user?: IUser;
}

export async function authenticate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required. Missing Bearer token.' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, getJwtSecret()) as { userId: string };
    const user = await User.findById(payload.userId);

    if (!user) {
      res.status(401).json({ error: 'User associated with this token was not found.' });
      return;
    }

    // Check if account is suspended
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

    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired session token.' });
  }
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  if (!req.user || (req.user.role !== 'super_admin' && req.user.role !== 'moderator')) {
    res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
    return;
  }
  next();
}
