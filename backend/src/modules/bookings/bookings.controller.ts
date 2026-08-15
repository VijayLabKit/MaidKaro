import { Request, Response } from 'express';
import { asyncHandler } from '../../common/middleware/errorHandler';
import * as bookingsService from './bookings.service';

export const createBooking = asyncHandler(async (req: Request, res: Response) => {
  const booking = await bookingsService.createBooking(req.auth!.userId, req.body);
  res.status(201).json({ data: booking });
});

export const respondToBooking = asyncHandler(async (req: Request, res: Response) => {
  const { action, reason } = req.body;
  const booking = await bookingsService.respondToBooking(req.auth!.userId, req.params.id, action, reason);
  res.json({ data: booking });
});

export const startJob = asyncHandler(async (req: Request, res: Response) => {
  res.json({ data: await bookingsService.startJob(req.auth!.userId, req.params.id) });
});

export const completeJob = asyncHandler(async (req: Request, res: Response) => {
  res.json({ data: await bookingsService.completeJob(req.auth!.userId, req.params.id) });
});

export const cancelBooking = asyncHandler(async (req: Request, res: Response) => {
  const role = req.auth!.role === 'WORKER' ? 'WORKER' : 'CUSTOMER';
  const booking = await bookingsService.cancelBooking(req.auth!.userId, role, req.params.id, req.body.reason);
  res.json({ data: booking });
});

export const listMyBookings = asyncHandler(async (req: Request, res: Response) => {
  const role = req.auth!.role === 'WORKER' ? 'WORKER' : 'CUSTOMER';
  const { status, page, pageSize } = req.query as never as { status?: never; page: number; pageSize: number };
  res.json({ data: await bookingsService.listMyBookings(req.auth!.userId, role, status, page, pageSize) });
});

export const getBookingDetail = asyncHandler(async (req: Request, res: Response) => {
  const role = req.auth!.role === 'WORKER' ? 'WORKER' : 'CUSTOMER';
  res.json({ data: await bookingsService.getBookingDetail(req.auth!.userId, role, req.params.id) });
});
