import { DocumentType } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError } from '../../common/errors/AppError';
import { createUploadUrl } from '../../common/utils/storage';

export async function getMyProfile(userId: string) {
  const profile = await prisma.workerProfile.findUnique({
    where: { userId },
    include: { skills: { include: { category: true } }, documents: true, availability: true, city: true, serviceZone: true },
  });
  if (!profile) throw AppError.notFound('Worker profile not found');
  return profile;
}

export async function updateMyProfile(userId: string, data: Record<string, unknown>) {
  const profile = await prisma.workerProfile.findUnique({ where: { userId } });
  if (!profile) throw AppError.notFound('Worker profile not found');

  return prisma.workerProfile.update({ where: { userId }, data });
}

export async function addSkill(userId: string, categoryId: string, hourlyRate?: number) {
  const profile = await prisma.workerProfile.findUniqueOrThrow({ where: { userId } });
  const category = await prisma.serviceCategory.findUnique({ where: { id: categoryId } });
  if (!category || !category.isActive) throw AppError.badRequest('Invalid or inactive service category');

  return prisma.workerSkill.upsert({
    where: { workerId_categoryId: { workerId: profile.id, categoryId } },
    update: { hourlyRate },
    create: { workerId: profile.id, categoryId, hourlyRate },
  });
}

export async function removeSkill(userId: string, categoryId: string) {
  const profile = await prisma.workerProfile.findUniqueOrThrow({ where: { userId } });
  await prisma.workerSkill.delete({ where: { workerId_categoryId: { workerId: profile.id, categoryId } } });
}

export async function setAvailability(userId: string, slots: { day: string; startTime: string; endTime: string }[]) {
  const profile = await prisma.workerProfile.findUniqueOrThrow({ where: { userId } });

  return prisma.$transaction([
    prisma.availabilitySlot.deleteMany({ where: { workerId: profile.id } }),
    prisma.availabilitySlot.createMany({
      data: slots.map((s: { day: string; startTime: string; endTime: string }) => ({ ...s, workerId: profile.id } as never)),
    }),
  ]);
}

export async function requestKycUploadUrl(userId: string, type: DocumentType, contentType: string) {
  const profile = await prisma.workerProfile.findUniqueOrThrow({ where: { userId } });
  const { uploadUrl, key } = await createUploadUrl(`kyc/${profile.id}/${type.toLowerCase()}`, contentType);
  return { uploadUrl, key };
}

/** Called after the client finishes the direct-to-storage upload, to record
 * the document and (re)set it to PENDING_REVIEW for admin moderation. */
export async function confirmKycDocument(userId: string, type: DocumentType, key: string) {
  const profile = await prisma.workerProfile.findUniqueOrThrow({ where: { userId } });

  const document = await prisma.kycDocument.create({
    data: { workerId: profile.id, type, fileUrl: key, status: 'PENDING_REVIEW' },
  });

  // Overall verification status flips to PENDING_REVIEW once the worker has
  // submitted at least the required document set.
  const requiredTypes: DocumentType[] = ['GOVERNMENT_ID', 'ADDRESS_PROOF', 'PROFILE_PHOTO'];
  const submittedTypes = await prisma.kycDocument.findMany({
    where: { workerId: profile.id },
    distinct: ['type'],
    select: { type: true },
  });
  const hasAll = requiredTypes.every((t) => submittedTypes.some((s: { type: DocumentType }) => s.type === t));

  if (hasAll && profile.verificationStatus === 'NOT_SUBMITTED') {
    await prisma.workerProfile.update({ where: { id: profile.id }, data: { verificationStatus: 'PENDING_REVIEW' } });
  }

  return document;
}

export async function searchWorkers(params: {
  categoryId: string;
  cityId: string;
  serviceZoneId?: string;
  availableNow?: boolean;
  minRating?: number;
  page: number;
  pageSize: number;
}) {
  const where = {
    verificationStatus: 'APPROVED' as const,
    cityId: params.cityId,
    ...(params.serviceZoneId ? { serviceZoneId: params.serviceZoneId } : {}),
    ...(params.availableNow ? { isAvailableNow: true } : {}),
    ...(params.minRating ? { ratingAvg: { gte: params.minRating } } : {}),
    skills: { some: { categoryId: params.categoryId } },
  };

  const [items, total] = await prisma.$transaction([
    prisma.workerProfile.findMany({
      where,
      include: { skills: { where: { categoryId: params.categoryId } }, city: true },
      orderBy: [{ ratingAvg: 'desc' }, { ratingCount: 'desc' }],
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
    }),
    prisma.workerProfile.count({ where }),
  ]);

  return { items, total, page: params.page, pageSize: params.pageSize };
}

export async function getWorkerPublicProfile(workerId: string) {
  const worker = await prisma.workerProfile.findUnique({
    where: { id: workerId },
    include: {
      skills: { include: { category: true } },
      city: true,
      reviews: { take: 20, orderBy: { createdAt: 'desc' }, include: { customer: { select: { fullName: true } } } },
    },
  });
  if (!worker || worker.verificationStatus !== 'APPROVED') throw AppError.notFound('Worker not found');
  return worker;
}

// ── Favorites ───────────────────────────────────────────
export async function listFavorites(customerUserId: string) {
  const customer = await prisma.customerProfile.findUniqueOrThrow({ where: { userId: customerUserId } });
  const favorites = await prisma.favoriteWorker.findMany({
    where: { customerId: customer.id },
    include: { worker: { include: { skills: { include: { category: true } } } } },
    orderBy: { createdAt: 'desc' },
  });
  return favorites.map((f) => f.worker);
}

export async function addFavorite(customerUserId: string, workerId: string) {
  const customer = await prisma.customerProfile.findUniqueOrThrow({ where: { userId: customerUserId } });
  return prisma.favoriteWorker.upsert({
    where: { customerId_workerId: { customerId: customer.id, workerId } },
    update: {},
    create: { customerId: customer.id, workerId },
  });
}

export async function removeFavorite(customerUserId: string, workerId: string) {
  const customer = await prisma.customerProfile.findUniqueOrThrow({ where: { userId: customerUserId } });
  await prisma.favoriteWorker.deleteMany({ where: { customerId: customer.id, workerId } });
}
