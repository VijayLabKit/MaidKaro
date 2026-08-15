import { BookingStatus, Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError } from '../../common/errors/AppError';
import { createRazorpayOrder } from '../payments/payments.service';
import { notifyUser } from '../notifications/notifications.service';

interface CreateBookingInput {
  categoryId: string;
  addressId: string;
  type: 'INSTANT' | 'SCHEDULED';
  workerId?: string;
  scheduledFor?: string;
  durationHours: number;
  notes?: string;
}

async function recordStatusEvent(
  tx: Prisma.TransactionClient,
  bookingId: string,
  fromStatus: BookingStatus | null,
  toStatus: BookingStatus,
  actor: string,
  note?: string,
) {
  await tx.bookingStatusEvent.create({ data: { bookingId, fromStatus, toStatus, actor, note } });
}

/** Finds the best available, verified worker for INSTANT bookings:
 * same city + zone, has the skill, marked available now, highest rated. */
async function findInstantMatch(categoryId: string, cityId: string, addressPincodeZoneId: string | null) {
  return prisma.workerProfile.findFirst({
    where: {
      cityId,
      verificationStatus: 'APPROVED',
      isAvailableNow: true,
      skills: { some: { categoryId } },
      ...(addressPincodeZoneId ? { serviceZoneId: addressPincodeZoneId } : {}),
    },
    orderBy: [{ ratingAvg: 'desc' }, { ratingCount: 'desc' }],
  });
}

export async function createBooking(customerUserId: string, input: CreateBookingInput) {
  const customer = await prisma.customerProfile.findUniqueOrThrow({ where: { userId: customerUserId } });

  const address = await prisma.customerAddress.findUnique({
    where: { id: input.addressId },
    include: { pincode: { include: { serviceZone: true } } },
  });
  if (!address || address.customerId !== customer.id) throw AppError.badRequest('Invalid address');

  const category = await prisma.serviceCategory.findUnique({ where: { id: input.categoryId } });
  if (!category || !category.isActive) throw AppError.badRequest('Invalid or inactive service category');

  const cityId = address.pincode.serviceZone.cityId;

  let workerId: string | undefined = input.workerId;

  if (input.type === 'INSTANT') {
    const match = await findInstantMatch(input.categoryId, cityId, address.pincode.serviceZoneId);
    if (!match) {
      throw AppError.conflict('No verified workers are available right now. Try scheduling instead.');
    }
    workerId = match.id;
  } else {
    const worker = await prisma.workerProfile.findUnique({ where: { id: input.workerId } });
    if (!worker || worker.verificationStatus !== 'APPROVED') throw AppError.badRequest('Selected worker is not available');
  }

  const skill = await prisma.workerSkill.findUnique({
    where: { workerId_categoryId: { workerId: workerId!, categoryId: input.categoryId } },
  });
  const hourlyRate = skill?.hourlyRate ?? category.baseHourlyRate;
  const priceQuoted = Number(hourlyRate) * input.durationHours;

  const booking = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const created = await tx.booking.create({
      data: {
        customerId: customer.id,
        workerId,
        categoryId: input.categoryId,
        addressId: input.addressId,
        type: input.type,
        status: 'PENDING',
        scheduledFor: input.scheduledFor ? new Date(input.scheduledFor) : null,
        durationHours: input.durationHours,
        priceQuoted,
        notes: input.notes,
      },
    });
    await recordStatusEvent(tx, created.id, null, 'PENDING', customerUserId);
    return created;
  });

  const worker = await prisma.workerProfile.findUnique({ where: { id: workerId! }, include: { user: true } });
  if (worker) {
    await notifyUser(worker.userId, {
      title: input.type === 'INSTANT' ? 'New instant job request' : 'New booking request',
      body: `${category.name} • ${input.durationHours}h • ₹${priceQuoted.toFixed(0)}`,
      data: { bookingId: booking.id },
    });
  }

  return booking;
}

export async function respondToBooking(workerUserId: string, bookingId: string, action: 'ACCEPT' | 'REJECT', reason?: string) {
  const worker = await prisma.workerProfile.findUniqueOrThrow({ where: { userId: workerUserId } });
  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, include: { customer: { include: { user: true } }, category: true } });

  if (!booking || booking.workerId !== worker.id) throw AppError.notFound('Booking not found');
  if (booking.status !== 'PENDING') throw AppError.conflict(`Booking is already ${booking.status.toLowerCase()}`);

  const newStatus: BookingStatus = action === 'ACCEPT' ? 'CONFIRMED' : 'REJECTED';

  const updated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const b = await tx.booking.update({
      where: { id: bookingId },
      data: { status: newStatus, confirmedAt: action === 'ACCEPT' ? new Date() : undefined, cancelReason: action === 'REJECT' ? reason : undefined },
    });
    await recordStatusEvent(tx, bookingId, 'PENDING', newStatus, workerUserId, reason);
    return b;
  });

  if (action === 'ACCEPT') {
    // Create the Razorpay order now so the customer app can open Checkout immediately.
    await createRazorpayOrder(booking.id, Number(booking.priceQuoted));
  }

  await notifyUser(booking.customer.userId, {
    title: action === 'ACCEPT' ? 'Booking confirmed' : 'Booking declined',
    body:
      action === 'ACCEPT'
        ? `Your ${booking.category.name} booking has been confirmed.`
        : `Your ${booking.category.name} booking was declined${reason ? `: ${reason}` : '.'}`,
    data: { bookingId: booking.id },
  });

  return updated;
}

export async function startJob(workerUserId: string, bookingId: string) {
  const worker = await prisma.workerProfile.findUniqueOrThrow({ where: { userId: workerUserId } });
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking || booking.workerId !== worker.id) throw AppError.notFound('Booking not found');
  if (booking.status !== 'CONFIRMED') throw AppError.conflict('Booking must be CONFIRMED to start');

  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const b = await tx.booking.update({ where: { id: bookingId }, data: { status: 'IN_PROGRESS', startedAt: new Date() } });
    await recordStatusEvent(tx, bookingId, 'CONFIRMED', 'IN_PROGRESS', workerUserId);
    return b;
  });
}

export async function completeJob(workerUserId: string, bookingId: string) {
  const worker = await prisma.workerProfile.findUniqueOrThrow({ where: { userId: workerUserId } });
  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, include: { category: true, customer: { include: { user: true } } } });
  if (!booking || booking.workerId !== worker.id) throw AppError.notFound('Booking not found');
  if (booking.status !== 'IN_PROGRESS') throw AppError.conflict('Booking must be IN_PROGRESS to complete');

  const updated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const b = await tx.booking.update({ where: { id: bookingId }, data: { status: 'COMPLETED', completedAt: new Date() } });
    await recordStatusEvent(tx, bookingId, 'IN_PROGRESS', 'COMPLETED', workerUserId);

    // Compute commission split and post to the worker's payout ledger.
    const commissionPct = Number(booking.category.commissionPct);
    const gross = Number(booking.priceQuoted);
    const commissionAmount = +(gross * (commissionPct / 100)).toFixed(2);
    const netAmount = +(gross - commissionAmount).toFixed(2);

    await tx.payoutLedgerEntry.create({
      data: { workerId: worker.id, bookingId, grossAmount: gross, commissionAmount, netAmount },
    });

    return b;
  });

  await notifyUser(booking.customer.userId, {
    title: 'Job completed',
    body: `Your ${booking.category.name} booking is complete. Please rate your experience.`,
    data: { bookingId: booking.id },
  });

  return updated;
}

export async function cancelBooking(userId: string, role: 'CUSTOMER' | 'WORKER', bookingId: string, reason: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { customer: true, worker: true },
  });
  if (!booking) throw AppError.notFound('Booking not found');

  const isOwner =
    (role === 'CUSTOMER' && booking.customer.userId === userId) ||
    (role === 'WORKER' && booking.worker?.userId === userId);
  if (!isOwner) throw AppError.forbidden();

  if (!['PENDING', 'CONFIRMED'].includes(booking.status)) {
    throw AppError.conflict('Only pending or confirmed bookings can be cancelled');
  }

  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const b = await tx.booking.update({ where: { id: bookingId }, data: { status: 'CANCELLED', cancelReason: reason } });
    await recordStatusEvent(tx, bookingId, booking.status, 'CANCELLED', userId, reason);
    return b;
  });
}

export async function listMyBookings(userId: string, role: 'CUSTOMER' | 'WORKER', status: BookingStatus | undefined, page: number, pageSize: number) {
  const ownerFilter =
    role === 'CUSTOMER'
      ? { customer: { userId } }
      : { worker: { userId } };

  const where = { ...ownerFilter, ...(status ? { status } : {}) };

  const [items, total] = await prisma.$transaction([
    prisma.booking.findMany({
      where,
      include: { category: true, worker: { select: { fullName: true, photoUrl: true, ratingAvg: true } }, customer: { select: { fullName: true } }, address: true },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.booking.count({ where }),
  ]);

  return { items, total, page, pageSize };
}

export async function getBookingDetail(userId: string, role: 'CUSTOMER' | 'WORKER', bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      category: true,
      address: true,
      worker: true,
      customer: true,
      payment: true,
      statusEvents: { orderBy: { createdAt: 'asc' } },
    },
  });
  if (!booking) throw AppError.notFound('Booking not found');

  const isOwner =
    (role === 'CUSTOMER' && booking.customer.userId === userId) || (role === 'WORKER' && booking.worker?.userId === userId);
  if (!isOwner) throw AppError.forbidden();

  return booking;
}
