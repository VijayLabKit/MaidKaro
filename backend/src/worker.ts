/**
 * Background worker process — runs separately from the API server (see
 * `npm run worker`) so scheduled jobs never compete with request latency.
 * Deploy as its own Render "Background Worker" service pointed at this file.
 */
import cron from 'node-cron';
import Razorpay from 'razorpay';
import { prisma } from './config/prisma';
import { env } from './config/env';

const razorpay = new Razorpay({ key_id: env.RAZORPAY_KEY_ID, key_secret: env.RAZORPAY_KEY_SECRET });

/** Every 15 minutes: push any REQUESTED payouts to RazorpayX Payouts. */
cron.schedule('*/15 * * * *', async () => {
  const requested = await prisma.payout.findMany({ where: { status: 'REQUESTED' }, include: { worker: true } });

  for (const payout of requested) {
    try {
      await prisma.payout.update({ where: { id: payout.id }, data: { status: 'PROCESSING' } });

      // NOTE: RazorpayX Payouts requires the worker's bank/UPI fund account
      // to already be registered (collected during KYC). This call is
      // illustrative — wire in the worker's real fund_account_id.
      const result = await (razorpay as unknown as { payouts: { create: (args: unknown) => Promise<{ id: string }> } }).payouts.create({
        account_number: env.RAZORPAYX_ACCOUNT_NUMBER,
        fund_account_id: (payout.worker as unknown as { fundAccountId?: string }).fundAccountId ?? '',
        amount: Math.round(Number(payout.amount) * 100),
        currency: 'INR',
        mode: 'UPI',
        purpose: 'payout',
        queue_if_low_balance: true,
        reference_id: payout.id,
      } as never);

      await prisma.payout.update({
        where: { id: payout.id },
        data: { status: 'PROCESSED', razorpayPayoutId: (result as { id: string }).id, processedAt: new Date() },
      });
    } catch (err) {
      await prisma.payout.update({
        where: { id: payout.id },
        data: { status: 'FAILED', failureReason: err instanceof Error ? err.message : 'Unknown error' },
      });
    }
  }
});

/** Daily at 2am: expire PENDING instant/scheduled bookings nobody responded to in time. */
cron.schedule('0 2 * * *', async () => {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  await prisma.booking.updateMany({
    where: { status: 'PENDING', createdAt: { lt: cutoff } },
    data: { status: 'EXPIRED' },
  });
});

// eslint-disable-next-line no-console
console.log('🕒 MaidKaro background worker started');
