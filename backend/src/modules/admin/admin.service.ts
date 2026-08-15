import { prisma } from '../../config/prisma';
import { AppError } from '../../common/errors/AppError';
import { createViewUrl } from '../../common/utils/storage';
import { refundPayment } from '../payments/payments.service';
import { notifyUser } from '../notifications/notifications.service';

// ── Worker verification queue ──────────────────────────
export async function listPendingWorkers() {
  return prisma.workerProfile.findMany({
    where: { verificationStatus: 'PENDING_REVIEW' },
    include: { documents: true, city: true, skills: { include: { category: true } } },
    orderBy: { createdAt: 'asc' },
  });
}

export async function getWorkerForReview(workerId: string) {
  const worker = await prisma.workerProfile.findUnique({
    where: { id: workerId },
    include: { documents: true, city: true, skills: { include: { category: true } }, user: true },
  });
  if (!worker) throw AppError.notFound('Worker not found');

  const documentsWithUrls = await Promise.all(
    worker.documents.map(async (d: { fileUrl: string }) => ({ ...d, viewUrl: await createViewUrl(d.fileUrl) })),
  );

  return { ...worker, documents: documentsWithUrls };
}

export async function reviewWorker(adminUserId: string, workerId: string, action: string, note?: string) {
  const worker = await prisma.workerProfile.findUnique({ where: { id: workerId }, include: { user: true } });
  if (!worker) throw AppError.notFound('Worker not found');

  const statusMap: Record<string, 'APPROVED' | 'REJECTED' | 'NEEDS_RESUBMISSION'> = {
    APPROVE: 'APPROVED',
    REJECT: 'REJECTED',
    REQUEST_RESUBMISSION: 'NEEDS_RESUBMISSION',
  };
  const newStatus = statusMap[action];

  const updated = await prisma.workerProfile.update({
    where: { id: workerId },
    data: { verificationStatus: newStatus, verificationNote: note },
  });

  await notifyUser(worker.userId, {
    title: newStatus === 'APPROVED' ? 'You are verified!' : 'Update on your verification',
    body:
      newStatus === 'APPROVED'
        ? 'Your MaidKaro profile is verified. You can now accept jobs.'
        : note ?? 'Please review your submitted documents and resubmit.',
  });

  return updated;
}

export async function reviewDocument(documentId: string, adminUserId: string, action: 'APPROVE' | 'REJECT', rejectReason?: string) {
  const doc = await prisma.kycDocument.findUnique({ where: { id: documentId } });
  if (!doc) throw AppError.notFound('Document not found');

  return prisma.kycDocument.update({
    where: { id: documentId },
    data: {
      status: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
      reviewedById: adminUserId,
      reviewedAt: new Date(),
      rejectReason: action === 'REJECT' ? rejectReason : null,
    },
  });
}

// ── Customers & bookings oversight ─────────────────────
export async function listCustomers(page: number, pageSize: number) {
  const [items, total] = await prisma.$transaction([
    prisma.customerProfile.findMany({ skip: (page - 1) * pageSize, take: pageSize, orderBy: { createdAt: 'desc' } }),
    prisma.customerProfile.count(),
  ]);
  return { items, total, page, pageSize };
}

export async function listBookings(status: string | undefined, page: number, pageSize: number) {
  const where = status ? { status: status as never } : {};
  const [items, total] = await prisma.$transaction([
    prisma.booking.findMany({
      where,
      include: { category: true, customer: true, worker: true },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.booking.count({ where }),
  ]);
  return { items, total, page, pageSize };
}

// ── Complaints / disputes ──────────────────────────────
export async function listComplaints(status?: string) {
  return prisma.complaint.findMany({
    where: status ? { status: status as never } : undefined,
    include: { booking: { include: { category: true, customer: true, worker: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

export async function resolveComplaint(
  complaintId: string,
  status: 'IN_REVIEW' | 'RESOLVED' | 'DISMISSED',
  resolutionNote?: string,
  refundAmount?: number,
) {
  const complaint = await prisma.complaint.findUnique({ where: { id: complaintId }, include: { booking: true } });
  if (!complaint) throw AppError.notFound('Complaint not found');

  if (refundAmount && refundAmount > 0) {
    await refundPayment(complaint.bookingId, refundAmount);
  }

  return prisma.complaint.update({
    where: { id: complaintId },
    data: {
      status,
      resolutionNote,
      refundIssued: refundAmount,
      resolvedAt: status === 'RESOLVED' || status === 'DISMISSED' ? new Date() : undefined,
    },
  });
}

// ── Analytics ───────────────────────────────────────────
export async function getAnalyticsOverview() {
  const [totalCustomers, totalWorkers, pendingWorkers, bookingsByStatus, revenueAgg] = await Promise.all([
    prisma.customerProfile.count(),
    prisma.workerProfile.count({ where: { verificationStatus: 'APPROVED' } }),
    prisma.workerProfile.count({ where: { verificationStatus: 'PENDING_REVIEW' } }),
    prisma.booking.groupBy({ by: ['status'], _count: true }),
    prisma.payment.aggregate({ where: { status: 'CAPTURED' }, _sum: { amount: true } }),
  ]);

  return {
    totalCustomers,
    totalWorkers,
    pendingWorkers,
    bookingsByStatus: Object.fromEntries(bookingsByStatus.map((b: { status: string; _count: number }) => [b.status, b._count])),
    grossRevenue: Number(revenueAgg._sum.amount ?? 0),
  };
}

export async function updateCategoryCommission(categoryId: string, commissionPct: number) {
  const category = await prisma.serviceCategory.findUnique({ where: { id: categoryId } });
  if (!category) throw AppError.notFound('Category not found');
  return prisma.serviceCategory.update({ where: { id: categoryId }, data: { commissionPct } });
}
