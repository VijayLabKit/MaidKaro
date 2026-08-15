import { Router } from 'express';
import { authenticate, requireRole } from '../../common/middleware/authenticate';
import { validate } from '../../common/middleware/validate';
import * as schema from './bookings.schema';
import * as controller from './bookings.controller';

const router = Router();

router.use(authenticate);

router.post('/', requireRole('CUSTOMER'), validate(schema.createBookingSchema), controller.createBooking);
router.get('/', validate(schema.listBookingsQuerySchema, 'query'), controller.listMyBookings);
router.get('/:id', controller.getBookingDetail);
router.post('/:id/respond', requireRole('WORKER'), validate(schema.workerRespondSchema), controller.respondToBooking);
router.post('/:id/start', requireRole('WORKER'), controller.startJob);
router.post('/:id/complete', requireRole('WORKER'), controller.completeJob);
router.post('/:id/cancel', validate(schema.cancelBookingSchema), controller.cancelBooking);

export default router;
