import { z } from 'zod';

export const reviewWorkerSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT', 'REQUEST_RESUBMISSION']),
  note: z.string().max(500).optional(),
});

export const reviewDocumentSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT']),
  rejectReason: z.string().max(300).optional(),
});

export const resolveComplaintSchema = z.object({
  status: z.enum(['IN_REVIEW', 'RESOLVED', 'DISMISSED']),
  resolutionNote: z.string().max(1000).optional(),
  refundAmount: z.number().positive().optional(),
});

export const updateCommissionSchema = z.object({
  commissionPct: z.number().min(0).max(50),
});
