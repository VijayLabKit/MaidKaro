import { Router } from 'express';
import { authenticate, requireRole } from '../../common/middleware/authenticate';
import { validate } from '../../common/middleware/validate';
import { asyncHandler } from '../../common/middleware/errorHandler';
import { createReviewSchema } from './reviews.schema';
import * as reviewsService from './reviews.service';

const router = Router();

router.get(
  '/workers/:workerId',
  asyncHandler(async (req, res) => {
    res.json({ data: await reviewsService.listWorkerReviews(req.params.workerId) });
  }),
);

router.post(
  '/',
  authenticate,
  requireRole('CUSTOMER'),
  validate(createReviewSchema),
  asyncHandler(async (req, res) => {
    const { bookingId, rating, comment } = req.body;
    const review = await reviewsService.createReview(req.auth!.userId, bookingId, rating, comment);
    res.status(201).json({ data: review });
  }),
);

export default router;
