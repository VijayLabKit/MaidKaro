import { z } from 'zod';

export const createBookingSchema = z
  .object({
    categoryId: z.string().uuid(),
    addressId: z.string().uuid(),
    type: z.enum(['INSTANT', 'SCHEDULED']),
    workerId: z.string().uuid().optional(), // required for SCHEDULED (customer picks worker)
    scheduledFor: z.string().datetime().optional(), // required for SCHEDULED
    durationHours: z.number().min(0.5).max(12),
    notes: z.string().max(500).optional(),
  })
  .refine((v) => v.type === 'INSTANT' || (v.workerId && v.scheduledFor), {
    message: 'workerId and scheduledFor are required for SCHEDULED bookings',
  });

export const cancelBookingSchema = z.object({
  reason: z.string().min(3).max(300),
});

export const workerRespondSchema = z.object({
  action: z.enum(['ACCEPT', 'REJECT']),
  reason: z.string().max(300).optional(),
});

export const listBookingsQuerySchema = z.object({
  status: z
    .enum(['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'REJECTED', 'EXPIRED'])
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});
