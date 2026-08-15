import { z } from 'zod';
import { Role } from '@prisma/client';

// Indian mobile numbers in E.164 format, e.g. +919876543210
const phoneRegex = /^\+91[6-9]\d{9}$/;

export const requestOtpSchema = z.object({
  phone: z.string().regex(phoneRegex, 'Enter a valid Indian mobile number, e.g. +919876543210'),
  role: z.nativeEnum(Role).refine((r) => r === 'CUSTOMER' || r === 'WORKER', {
    message: 'role must be CUSTOMER or WORKER',
  }),
});

export const verifyOtpSchema = z.object({
  phone: z.string().regex(phoneRegex),
  otp: z.string().length(6),
  role: z.nativeEnum(Role).refine((r) => r === 'CUSTOMER' || r === 'WORKER'),
  // Only needed the first time (signup) — ignored on subsequent logins.
  fullName: z.string().min(2).max(80).optional(),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(10),
});

export type RequestOtpInput = z.infer<typeof requestOtpSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
