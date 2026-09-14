import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.js';

interface RateLimitRecord {
  timestamps: number[];
}

/**
 * PRODUCTION REALISM NOTICE:
 * This in-memory sliding window rate limiter protects single-instance / development deployments.
 * Multi-instance or cluster deployments MUST replace this with a centralized, distributed store
 * such as Redis or Valkey to prevent per-instance limit evasion.
 */
export function createRateLimiter(options: {
  windowMs: number;
  max: number;
  message?: string;
}) {
  const store = new Map<string, RateLimitRecord>();

  // Periodically clean stale entries every 5 minutes
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of store.entries()) {
      record.timestamps = record.timestamps.filter((ts) => now - ts < options.windowMs);
      if (record.timestamps.length === 0) {
        store.delete(key);
      }
    }
  }, 300000);

  return function rateLimiterMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
    // Generate key based on authenticated user ID or client IP
    const identifier = req.user ? req.user._id.toString() : (req.ip || 'anonymous');
    const now = Date.now();

    let record = store.get(identifier);
    if (!record) {
      record = { timestamps: [] };
      store.set(identifier, record);
    }

    // Filter timestamps within current sliding window
    record.timestamps = record.timestamps.filter((ts) => now - ts < options.windowMs);

    if (record.timestamps.length >= options.max) {
      const retryAfterSeconds = Math.ceil((options.windowMs - (now - record.timestamps[0])) / 1000);
      res.setHeader('Retry-After', retryAfterSeconds);
      res.status(429).json({
        error: options.message || 'Too many requests. Please slow down and try again later.',
        retryAfterSeconds,
      });
      return;
    }

    record.timestamps.push(now);
    next();
  };
}

// Pre-configured limiters for sensitive social endpoints
export const postCreationLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 20,
  message: 'Post creation limit reached. Please wait a few minutes before posting again.',
});

export const storyCreationLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 20,
  message: 'Story creation limit reached. Please wait a few minutes before sharing another story.',
});

export const commentLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 30,
  message: 'You are commenting too fast. Please wait a moment.',
});

export const likeLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 60,
  message: 'Too many reactions submitted. Please slow down.',
});

export const followLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 30,
  message: 'Follow action limit reached. Please wait a minute.',
});

export const mediaUploadLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 25,
  message: 'Media upload frequency limit reached. Please wait a few minutes.',
});

export const searchLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 60,
  message: 'Search query rate limit exceeded. Please wait a moment before searching again.',
});

export const connectionRequestLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 20,
  message: 'Connection request limit reached. Please wait a few minutes before sending more requests.',
});

export const messageLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 60,
  message: 'Message sending rate limit reached. Please wait a moment before sending more messages.',
});

export const communityCreationLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Community creation rate limit reached. Please wait a while before creating another community.',
});

export const communityActionLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 30,
  message: 'Too many community actions submitted. Please slow down and try again later.',
});


