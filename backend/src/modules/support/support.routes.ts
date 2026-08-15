import { Router } from 'express';
import { authenticate, requireRole } from '../../common/middleware/authenticate';
import { validate } from '../../common/middleware/validate';
import { asyncHandler } from '../../common/middleware/errorHandler';
import * as schema from './support.schema';
import * as supportService from './support.service';

const router = Router();
router.use(authenticate);

router.post(
  '/tickets',
  validate(schema.createTicketSchema),
  asyncHandler(async (req, res) => {
    res.status(201).json({ data: await supportService.createTicket(req.auth!.userId, req.body.subject, req.body.message) });
  }),
);

router.get(
  '/tickets',
  asyncHandler(async (req, res) => {
    res.json({ data: await supportService.listMyTickets(req.auth!.userId) });
  }),
);

router.get(
  '/tickets/:id',
  asyncHandler(async (req, res) => {
    const isAdmin = req.auth!.role === 'ADMIN' || req.auth!.role === 'SUPER_ADMIN';
    res.json({ data: await supportService.getTicket(req.auth!.userId, req.params.id, isAdmin) });
  }),
);

router.post(
  '/tickets/:id/messages',
  validate(schema.addMessageSchema),
  asyncHandler(async (req, res) => {
    const isAdmin = req.auth!.role === 'ADMIN' || req.auth!.role === 'SUPER_ADMIN';
    res.status(201).json({ data: await supportService.addMessage(req.auth!.userId, req.params.id, req.body.body, isAdmin) });
  }),
);

router.post(
  '/complaints',
  requireRole('CUSTOMER', 'WORKER'),
  validate(schema.createComplaintSchema),
  asyncHandler(async (req, res) => {
    const role = req.auth!.role === 'WORKER' ? 'WORKER' : 'CUSTOMER';
    const complaint = await supportService.raiseComplaint(req.auth!.userId, role, req.body.bookingId, req.body.description);
    res.status(201).json({ data: complaint });
  }),
);

export default router;
