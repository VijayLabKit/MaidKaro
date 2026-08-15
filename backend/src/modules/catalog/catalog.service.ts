import { prisma } from '../../config/prisma';
import { AppError } from '../../common/errors/AppError';

// ── Categories ──────────────────────────────────────────
export const listCategories = (activeOnly = true) =>
  prisma.serviceCategory.findMany({
    where: activeOnly ? { isActive: true } : undefined,
    orderBy: { sortOrder: 'asc' },
  });

export const createCategory = (data: Record<string, unknown>) => prisma.serviceCategory.create({ data: data as never });

export const updateCategory = async (id: string, data: Record<string, unknown>) => {
  const existing = await prisma.serviceCategory.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound('Category not found');
  return prisma.serviceCategory.update({ where: { id }, data: data as never });
};

// ── Cities ──────────────────────────────────────────────
export const listCities = (activeOnly = true) =>
  prisma.city.findMany({ where: activeOnly ? { isActive: true } : undefined, orderBy: { name: 'asc' } });

export const createCity = (data: { name: string; state: string }) => prisma.city.create({ data });

export const setCityActive = async (id: string, isActive: boolean) => {
  const city = await prisma.city.findUnique({ where: { id } });
  if (!city) throw AppError.notFound('City not found');
  return prisma.city.update({ where: { id }, data: { isActive } });
};

// ── Zones & pincodes ────────────────────────────────────
export const listZonesForCity = (cityId: string) =>
  prisma.serviceZone.findMany({ where: { cityId }, include: { pincodes: true } });

export const createZone = (data: { cityId: string; name: string }) => prisma.serviceZone.create({ data });

export const createPincode = (data: { code: string; serviceZoneId: string }) => prisma.pincode.create({ data });

/** Resolves a raw 6-digit PIN to its city + zone, or null if MaidKaro
 * doesn't yet serve that PIN — used by the customer app to gate booking. */
export const resolvePincode = (code: string) =>
  prisma.pincode.findUnique({
    where: { code },
    include: { serviceZone: { include: { city: true } } },
  });

// ── City × category availability ───────────────────────
export const setCityCategoryActive = (cityId: string, categoryId: string, isActive: boolean) =>
  prisma.cityCategory.upsert({
    where: { cityId_categoryId: { cityId, categoryId } },
    update: { isActive },
    create: { cityId, categoryId, isActive },
  });

export const listCategoriesForCity = (cityId: string) =>
  prisma.cityCategory.findMany({
    where: { cityId, isActive: true, category: { isActive: true } },
    include: { category: true },
  });
