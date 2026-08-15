import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../common/middleware/authenticate';
import { validate } from '../../common/middleware/validate';
import { asyncHandler } from '../../common/middleware/errorHandler';
import * as notificationsService from './notifications.service';

const router = Router();

const registerDeviceSchema = z.object({
  token: z.string().min(10),
  platform: z.enum(['android', 'ios']),
});

router.use(authenticate);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json({ data: await notificationsService.listMyNotifications(req.auth!.userId) });
  }),
);

router.post(
  '/devices',
  validate(registerDeviceSchema),
  asyncHandler(async (req, res) => {
    const { token, platform } = req.body;
    res.status(201).json({ data: await notificationsService.registerDeviceToken(req.auth!.userId, token, platform) });
  }),
);

router.patch(
  '/:id/read',
  asyncHandler(async (req, res) => {
    await notificationsService.markRead(req.auth!.userId, req.params.id);
    res.status(204).send();
  }),
);

export default router;
