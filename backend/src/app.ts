import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { env, isProd } from './config/env';
import { errorHandler, notFoundHandler } from './common/middleware/errorHandler';

import authRoutes from './modules/auth/auth.routes';
import usersRoutes from './modules/users/users.routes';
import workersRoutes from './modules/workers/workers.routes';
import catalogRoutes from './modules/catalog/catalog.routes';
import bookingsRoutes from './modules/bookings/bookings.routes';
import paymentsRoutes from './modules/payments/payments.routes';
import reviewsRoutes from './modules/reviews/reviews.routes';
import supportRoutes from './modules/support/support.routes';
import notificationsRoutes from './modules/notifications/notifications.routes';
import adminRoutes from './modules/admin/admin.routes';

export const app = express();

app.use(helmet());
app.use(
  cors({
    origin: isProd ? [env.ADMIN_DASHBOARD_URL] : true,
    credentials: true,
  }),
);
app.use(morgan(isProd ? 'combined' : 'dev'));

// IMPORTANT: the Razorpay webhook route needs the raw request body for HMAC
// verification, so it's mounted (with its own express.raw()) BEFORE the
// global json() parser below. See payments.routes.ts.
app.use('/api/v1/payments', paymentsRoutes);

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// Coarse global rate limit; tighter limits are layered on sensitive routes
// (e.g. OTP request) inside their own route files.
app.use(
  rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    limit: env.RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', usersRoutes);
app.use('/api/v1/workers', workersRoutes);
app.use('/api/v1/catalog', catalogRoutes);
app.use('/api/v1/bookings', bookingsRoutes);
app.use('/api/v1/reviews', reviewsRoutes);
app.use('/api/v1/support', supportRoutes);
app.use('/api/v1/notifications', notificationsRoutes);
app.use('/api/v1/admin', adminRoutes);

app.use(notFoundHandler);
app.use(errorHandler);
