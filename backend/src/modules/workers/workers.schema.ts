import { z } from 'zod';
import { DocumentType, WeekDay } from '@prisma/client';

export const updateWorkerProfileSchema = z.object({
  fullName: z.string().min(2).max(80).optional(),
  bio: z.string().max(500).optional(),
  cityId: z.string().uuid().optional(),
  serviceZoneId: z.string().uuid().optional(),
  languages: z.array(z.string()).max(10).optional(),
  yearsExperience: z.number().int().min(0).max(60).optional(),
  isAvailableNow: z.boolean().optional(),
});

export const addSkillSchema = z.object({
  categoryId: z.string().uuid(),
  hourlyRate: z.number().positive().optional(),
});

export const setAvailabilitySchema = z.object({
  slots: z
    .array(
      z.object({
        day: z.nativeEnum(WeekDay),
        startTime: z.string().regex(/^\d{2}:\d{2}$/),
        endTime: z.string().regex(/^\d{2}:\d{2}$/),
      }),
    )
    .max(21), // up to 3 slots/day * 7 days
});

export const requestUploadUrlSchema = z.object({
  type: z.nativeEnum(DocumentType),
  contentType: z.enum(['image/jpeg', 'image/png', 'application/pdf']),
});

export const confirmDocumentSchema = z.object({
  type: z.nativeEnum(DocumentType),
  key: z.string().min(3),
});

export const searchWorkersSchema = z.object({
  categoryId: z.string().uuid(),
  cityId: z.string().uuid(),
  serviceZoneId: z.string().uuid().optional(),
  availableNow: z.coerce.boolean().optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});
