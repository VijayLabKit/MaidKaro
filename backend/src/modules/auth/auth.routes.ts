import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { validate } from '../../common/middleware/validate';
import { requestOtpSchema, verifyOtpSchema, refreshTokenSchema } from './auth.schema';
import { adminLoginSchema } from './admin-auth.schema';
import * as authController from './auth.controller';

const router = Router();

// Tight limiter on OTP request to prevent SMS-bombing / abuse.
const otpRequestLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'TOO_MANY_REQUESTS', message: 'Too many OTP requests. Try again later.' } },
});

// Tight limiter on admin login to slow brute-force attempts against passwords.
const adminLoginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/otp/request', otpRequestLimiter, validate(requestOtpSchema), authController.requestOtp);
router.post('/otp/verify', validate(verifyOtpSchema), authController.verifyOtp);
router.post('/admin/login', adminLoginLimiter, validate(adminLoginSchema), authController.adminLogin);
router.post('/refresh', validate(refreshTokenSchema), authController.refresh);
router.post('/logout', validate(refreshTokenSchema), authController.logout);

export default router;
