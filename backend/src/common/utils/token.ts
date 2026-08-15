import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { Role } from '@prisma/client';
import { env } from '../../config/env';

export function signAccessToken(payload: { userId: string; role: Role; phone: string }) {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
  } as jwt.SignOptions);
}

export function signRefreshToken(payload: { userId: string }) {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
  } as jwt.SignOptions);
}

export function verifyRefreshToken(token: string) {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as { userId: string };
}

/** We never store raw refresh tokens — only a SHA-256 hash, so a DB leak
 * doesn't hand out usable tokens. */
export function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function generateOtp(): string {
  // 6-digit numeric OTP. crypto.randomInt avoids Math.random's predictability.
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
}
