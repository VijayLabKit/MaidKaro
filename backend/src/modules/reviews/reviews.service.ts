import { prisma } from '../../config/prisma';
import { AppError } from '../../common/errors/AppError';

export async function createReview(customerUserId: string, bookingId: string, rating: number, comment?: string) {
  const customer = await prisma.customerProfile.findUniqueOrThrow({ where: { userId: customerUserId } });

  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking || booking.customerId !== customer.id) throw AppError.notFound('Booking not found');
  if (booking.status !== 'COMPLETED') throw AppError.conflict('You can only review a completed booking');
  if (!booking.workerId) throw AppError.conflict('This booking has no assigned worker');

  const existing = await prisma.review.findUnique({ where: { bookingId } });
  if (existing) throw AppError.conflict('This booking has already been reviewed');

  const review = await prisma.$transaction(async (tx: typeof prisma) => {
    const created = await tx.review.create({
      data: { bookingId, customerId: customer.id, workerId: booking.workerId!, rating, comment },
    });

    // Recompute the worker's running average rating.
    const agg = await tx.review.aggregate({ where: { workerId: booking.workerId! }, _avg: { rating: true }, _count: true });
    await tx.workerProfile.update({
      where: { id: booking.workerId! },
      data: { ratingAvg: agg._avg.rating ?? 0, ratingCount: agg._count },
    });

    return created;
  });

  return review;
}

export async function listWorkerReviews(workerId: string) {
  return prisma.review.findMany({
    where: { workerId },
    include: { customer: { select: { fullName: true } } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}
