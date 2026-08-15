import { z } from 'zod';

export const createTicketSchema = z.object({
  subject: z.string().min(3).max(150),
  message: z.string().min(3).max(2000),
});

export const addMessageSchema = z.object({
  body: z.string().min(1).max(2000),
});

export const createComplaintSchema = z.object({
  bookingId: z.string().uuid(),
  description: z.string().min(5).max(1000),
});
