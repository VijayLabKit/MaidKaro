import { Request, Response } from 'express';
import { asyncHandler } from '../../common/middleware/errorHandler';
import * as adminService from './admin.service';

export const listPendingWorkers = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ data: await adminService.listPendingWorkers() });
});

export const getWorkerForReview = asyncHandler(async (req: Request, res: Response) => {
  res.json({ data: await adminService.getWorkerForReview(req.params.workerId) });
});

export const reviewWorker = asyncHandler(async (req: Request, res: Response) => {
  const { action, note } = req.body;
  res.json({ data: await adminService.reviewWorker(req.auth!.userId, req.params.workerId, action, note) });
});

export const reviewDocument = asyncHandler(async (req: Request, res: Response) => {
  const { action, rejectReason } = req.body;
  res.json({ data: await adminService.reviewDocument(req.params.documentId, req.auth!.userId, action, rejectReason) });
});

export const listCustomers = asyncHandler(async (req: Request, res: Response) => {
  const page = Number(req.query.page ?? 1);
  const pageSize = Number(req.query.pageSize ?? 20);
  res.json({ data: await adminService.listCustomers(page, pageSize) });
});

export const listBookings = asyncHandler(async (req: Request, res: Response) => {
  const page = Number(req.query.page ?? 1);
  const pageSize = Number(req.query.pageSize ?? 20);
  res.json({ data: await adminService.listBookings(req.query.status as string | undefined, page, pageSize) });
});

export const listComplaints = asyncHandler(async (req: Request, res: Response) => {
  res.json({ data: await adminService.listComplaints(req.query.status as string | undefined) });
});

export const resolveComplaint = asyncHandler(async (req: Request, res: Response) => {
  const { status, resolutionNote, refundAmount } = req.body;
  res.json({ data: await adminService.resolveComplaint(req.params.complaintId, status, resolutionNote, refundAmount) });
});

export const getAnalyticsOverview = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ data: await adminService.getAnalyticsOverview() });
});

export const updateCategoryCommission = asyncHandler(async (req: Request, res: Response) => {
  res.json({ data: await adminService.updateCategoryCommission(req.params.categoryId, req.body.commissionPct) });
});
