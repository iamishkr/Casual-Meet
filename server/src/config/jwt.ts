/**
 * Centralized JWT Configuration & Startup Validation
 * Enforces production security: fails fast if JWT_SECRET is unset in production.
 */

const DEV_FALLBACK_SECRET = 'casualmeet_insecure_dev_jwt_secret_do_not_use_in_prod';

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  const isProd = process.env.NODE_ENV === 'production';

  if (!secret) {
    if (isProd) {
      throw new Error(
        'FATAL CONFIGURATION ERROR: JWT_SECRET environment variable is missing in production. Server startup aborted.'
      );
    }
    console.warn(
      '⚠️ [SECURITY WARNING] JWT_SECRET is not set. Falling back to development secret. DO NOT USE IN PRODUCTION.'
    );
    return DEV_FALLBACK_SECRET;
  }

  if (isProd && (secret === DEV_FALLBACK_SECRET || secret.includes('dev_secret') || secret.length < 32)) {
    throw new Error(
      'FATAL CONFIGURATION ERROR: Weak or default development JWT_SECRET detected in production. Minimum 32 characters required.'
    );
  }

  return secret;
}

export function validateJwtConfig(): void {
  // Invoking this at startup guarantees fail-fast behavior if misconfigured
  getJwtSecret();
}

export const JWT_SECRET = getJwtSecret();
