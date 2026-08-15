import bcrypt from 'bcryptjs';
import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import { AppError } from '../../common/errors/AppError';
import { generateOtp, hashToken, signAccessToken, signRefreshToken, verifyRefreshToken } from '../../common/utils/token';
import { sendOtpSms } from './sms.provider';
import { RequestOtpInput, VerifyOtpInput } from './auth.schema';

const OTP_SALT_ROUNDS = 10;

export async function requestOtp({ phone, role }: RequestOtpInput) {
  const recentAttempts = await prisma.otpCode.count({
    where: { userPhone: phone, createdAt: { gt: new Date(Date.now() - 10 * 60 * 1000) } },
  });
  if (recentAttempts >= 5) {
    throw AppError.tooManyRequests('Too many OTP requests. Please try again in a few minutes.');
  }

  const otp = generateOtp();
  const codeHash = await bcrypt.hash(otp, OTP_SALT_ROUNDS);

  await prisma.otpCode.create({
    data: {
      userPhone: phone,
      codeHash,
      purpose: role === 'WORKER' ? 'WORKER_LOGIN' : 'CUSTOMER_LOGIN',
      expiresAt: new Date(Date.now() + env.OTP_EXPIRY_SECONDS * 1000),
    },
  });

  await sendOtpSms(phone, otp);

  return { expiresInSeconds: env.OTP_EXPIRY_SECONDS };
}

export async function verifyOtp({ phone, otp, role, fullName }: VerifyOtpInput) {
  const record = await prisma.otpCode.findFirst({
    where: { userPhone: phone, consumedAt: null },
    orderBy: { createdAt: 'desc' },
  });

  if (!record) throw AppError.badRequest('No active OTP for this number. Please request a new one.');
  if (record.expiresAt < new Date()) throw AppError.badRequest('OTP expired. Please request a new one.');
  if (record.attempts >= env.OTP_MAX_ATTEMPTS) {
    throw AppError.tooManyRequests('Too many incorrect attempts. Please request a new OTP.');
  }

  const isValid = await bcrypt.compare(otp, record.codeHash);
  if (!isValid) {
    await prisma.otpCode.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
    throw AppError.badRequest('Incorrect OTP');
  }

  await prisma.otpCode.update({ where: { id: record.id }, data: { consumedAt: new Date() } });

  // Find or create the user + role-specific profile (first login = signup).
  let user = await prisma.user.findUnique({ where: { phone } });

  if (!user) {
    if (!fullName) throw AppError.badRequest('fullName is required for first-time signup');

    user = await prisma.user.create({
      data: {
        phone,
        role,
        ...(role === 'CUSTOMER'
          ? { customerProfile: { create: { fullName } } }
          : { workerProfile: { create: { fullName, cityId: await getDefaultCityId() } } }),
      },
    });
  }

  if (!user.isActive) throw AppError.forbidden('This account has been suspended. Contact support.');

  const accessToken = signAccessToken({ userId: user.id, role: user.role, phone: user.phone });
  const refreshToken = signRefreshToken({ userId: user.id });

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  return { accessToken, refreshToken, user: { id: user.id, phone: user.phone, role: user.role } };
}

export async function refreshAccessToken(refreshToken: string) {
  let payload: { userId: string };
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw AppError.unauthorized('Invalid or expired refresh token');
  }

  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(refreshToken) } });
  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
    throw AppError.unauthorized('Refresh token no longer valid. Please log in again.');
  }

  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user || !user.isActive) throw AppError.unauthorized();

  // Rotate: revoke the old refresh token and issue a new pair.
  await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });

  const accessToken = signAccessToken({ userId: user.id, role: user.role, phone: user.phone });
  const newRefreshToken = signRefreshToken({ userId: user.id });
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(newRefreshToken),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  return { accessToken, refreshToken: newRefreshToken };
}

export async function logout(refreshToken: string) {
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashToken(refreshToken) },
    data: { revokedAt: new Date() },
  });
}

/** New workers default to the first active city (Siliguri at launch) until
 * they complete profile setup and pick their real city/zone. */
async function getDefaultCityId(): Promise<string> {
  const city = await prisma.city.findFirst({ where: { isActive: true }, orderBy: { launchedAt: 'asc' } });
  if (!city) throw AppError.internal('No active city configured. Seed at least one City.');
  return city.id;
}

// ── Admin (email/password) auth ────────────────────────
// Admins are internal staff accounts, provisioned by SUPER_ADMIN — no
// public signup, so a normal password login (bcrypt-hashed) is appropriate
// here even though customers/workers use OTP-only auth.
export async function adminLogin(email: string, password: string) {
  const admin = await prisma.adminProfile.findUnique({ where: { email }, include: { user: true } });
  if (!admin) throw AppError.unauthorized('Invalid email or password');

  const valid = await bcrypt.compare(password, admin.passwordHash);
  if (!valid) throw AppError.unauthorized('Invalid email or password');
  if (!admin.user.isActive) throw AppError.forbidden('This admin account has been deactivated');

  const accessToken = signAccessToken({ userId: admin.user.id, role: admin.user.role, phone: admin.user.phone });
  const refreshToken = signRefreshToken({ userId: admin.user.id });

  await prisma.refreshToken.create({
    data: {
      userId: admin.user.id,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  return {
    accessToken,
    refreshToken,
    admin: { id: admin.id, fullName: admin.fullName, email: admin.email, role: admin.user.role },
  };
}
