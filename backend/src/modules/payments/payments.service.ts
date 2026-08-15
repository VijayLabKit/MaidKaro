import Razorpay from 'razorpay';
import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import { AppError } from '../../common/errors/AppError';
import { notifyUser } from '../notifications/notifications.service';

const razorpay = new Razorpay({ key_id: env.RAZORPAY_KEY_ID, key_secret: env.RAZORPAY_KEY_SECRET });

/** Creates (or returns the existing) Razorpay order for a confirmed booking. */
export async function createRazorpayOrder(bookingId: string, amountRupees: number) {
  const existing = await prisma.payment.findUnique({ where: { bookingId } });
  if (existing) return existing;

  const order = await razorpay.orders.create({
    amount: Math.round(amountRupees * 100), // paise
    currency: 'INR',
    receipt: `booking_${bookingId}`,
    notes: { bookingId },
  });

  return prisma.payment.create({
    data: {
      bookingId,
      razorpayOrderId: order.id,
      amount: amountRupees,
      status: 'CREATED',
    },
  });
}

/** Verifies the HMAC signature Razorpay sends on every webhook call.
 * Never trust a webhook payload without this check. */
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const expected = crypto.createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET).update(rawBody).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export async function handlePaymentCaptured(orderId: string, paymentId: string) {
  const payment = await prisma.payment.update({
    where: { razorpayOrderId: orderId },
    data: { status: 'CAPTURED', razorpayPaymentId: paymentId },
    include: { booking: { include: { customer: true, category: true } } },
  });

  await notifyUser(payment.booking.customer.userId, {
    title: 'Payment received',
    body: `₹${Number(payment.amount).toFixed(0)} paid for your ${payment.booking.category.name} booking.`,
    data: { bookingId: payment.bookingId },
  });

  return payment;
}

export async function handlePaymentFailed(orderId: string) {
  return prisma.payment.update({ where: { razorpayOrderId: orderId }, data: { status: 'FAILED' } });
}

export async function refundPayment(bookingId: string, amountRupees: number) {
  const payment = await prisma.payment.findUnique({ where: { bookingId } });
  if (!payment || !payment.razorpayPaymentId) throw AppError.badRequest('No captured payment to refund');

  await razorpay.payments.refund(payment.razorpayPaymentId, { amount: Math.round(amountRupees * 100) });

  const newRefunded = Number(payment.refundedAmount) + amountRupees;
  const isFull = newRefunded >= Number(payment.amount);

  return prisma.payment.update({
    where: { bookingId },
    data: { refundedAmount: newRefunded, status: isFull ? 'REFUNDED' : 'PARTIALLY_REFUNDED' },
  });
}

// ── Worker payouts ──────────────────────────────────────

export async function getPayoutSummary(workerId: string) {
  const pending = await prisma.payoutLedgerEntry.aggregate({
    where: { workerId, isPaidOut: false },
    _sum: { netAmount: true },
    _count: true,
  });

  const lifetime = await prisma.payoutLedgerEntry.aggregate({ where: { workerId }, _sum: { netAmount: true } });

  return {
    availableBalance: Number(pending._sum.netAmount ?? 0),
    pendingJobs: pending._count,
    lifetimeEarnings: Number(lifetime._sum.netAmount ?? 0),
  };
}

export async function requestPayout(workerId: string) {
  const unpaid = await prisma.payoutLedgerEntry.findMany({ where: { workerId, isPaidOut: false } });
  if (unpaid.length === 0) throw AppError.badRequest('No available balance to withdraw');

  const total = unpaid.reduce((sum: number, e: { netAmount: unknown }) => sum + Number(e.netAmount), 0);

  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const payout = await tx.payout.create({ data: { workerId, amount: total, status: 'REQUESTED' } });
    await tx.payoutLedgerEntry.updateMany({
      where: { id: { in: unpaid.map((e: { id: string }) => e.id) } },
      data: { isPaidOut: true, payoutId: payout.id },
    });
    return payout;
  });
  // NOTE: actual bank transfer via RazorpayX Payouts API is triggered by a
  // scheduled job (see src/worker.ts) that picks up REQUESTED payouts in
  // batch — keeps the payout endpoint fast and lets admin review large payouts.
}

export async function listPayouts(workerId: string) {
  return prisma.payout.findMany({ where: { workerId }, orderBy: { requestedAt: 'desc' } });
}
