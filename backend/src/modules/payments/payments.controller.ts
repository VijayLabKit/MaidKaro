import { Request, Response } from 'express';
import { asyncHandler } from '../../common/middleware/errorHandler';
import { AppError } from '../../common/errors/AppError';
import { prisma } from '../../config/prisma';
import * as paymentsService from './payments.service';

/** Razorpay webhook — this is the ONLY place Payment.status changes.
 * Client-side checkout callbacks are for UX only (spinners), never trusted
 * to confirm a payment. Route is mounted with the raw body parser so we can
 * verify the HMAC signature over the exact bytes Razorpay sent. */
export const handleWebhook = asyncHandler(async (req: Request, res: Response) => {
  const signature = req.headers['x-razorpay-signature'] as string | undefined;
  if (!signature || !paymentsService.verifyWebhookSignature(req.body.toString(), signature)) {
    throw AppError.unauthorized('Invalid webhook signature');
  }

  const payload = JSON.parse(req.body.toString());
  const event = payload.event as string;

  if (event === 'payment.captured') {
    const p = payload.payload.payment.entity;
    await paymentsService.handlePaymentCaptured(p.order_id, p.id);
  } else if (event === 'payment.failed') {
    const p = payload.payload.payment.entity;
    await paymentsService.handlePaymentFailed(p.order_id);
  }

  res.status(200).json({ received: true });
});

export const getMyPayoutSummary = asyncHandler(async (req: Request, res: Response) => {
  const worker = await prisma.workerProfile.findUniqueOrThrow({ where: { userId: req.auth!.userId } });
  res.json({ data: await paymentsService.getPayoutSummary(worker.id) });
});

export const requestPayout = asyncHandler(async (req: Request, res: Response) => {
  const worker = await prisma.workerProfile.findUniqueOrThrow({ where: { userId: req.auth!.userId } });
  res.status(201).json({ data: await paymentsService.requestPayout(worker.id) });
});

export const listMyPayouts = asyncHandler(async (req: Request, res: Response) => {
  const worker = await prisma.workerProfile.findUniqueOrThrow({ where: { userId: req.auth!.userId } });
  res.json({ data: await paymentsService.listPayouts(worker.id) });
});
