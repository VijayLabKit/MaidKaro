import { z } from 'zod';

export const createCategorySchema = z.object({
  name: z.string().min(2).max(80),
  slug: z
    .string()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9-]+$/, 'slug must be lowercase-kebab-case'),
  description: z.string().min(5).max(500),
  iconUrl: z.string().url().optional(),
  baseHourlyRate: z.number().positive(),
  commissionPct: z.number().min(0).max(50).optional(),
  sortOrder: z.number().int().optional(),
});

export const updateCategorySchema = createCategorySchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const createCitySchema = z.object({
  name: z.string().min(2).max(80),
  state: z.string().min(2).max(80),
});

export const createZoneSchema = z.object({
  cityId: z.string().uuid(),
  name: z.string().min(2).max(120),
});

export const createPincodeSchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'Indian PIN codes are 6 digits'),
  serviceZoneId: z.string().uuid(),
});

export const toggleCityCategorySchema = z.object({
  cityId: z.string().uuid(),
  categoryId: z.string().uuid(),
  isActive: z.boolean(),
});
