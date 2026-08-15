import { Request, Response } from 'express';
import { asyncHandler } from '../../common/middleware/errorHandler';
import { AppError } from '../../common/errors/AppError';
import * as workersService from './workers.service';

export const getMyProfile = asyncHandler(async (req: Request, res: Response) => {
  const profile = await workersService.getMyProfile(req.auth!.userId);
  res.json({ data: profile });
});

export const updateMyProfile = asyncHandler(async (req: Request, res: Response) => {
  const profile = await workersService.updateMyProfile(req.auth!.userId, req.body);
  res.json({ data: profile });
});

export const addSkill = asyncHandler(async (req: Request, res: Response) => {
  const skill = await workersService.addSkill(req.auth!.userId, req.body.categoryId, req.body.hourlyRate);
  res.status(201).json({ data: skill });
});

export const removeSkill = asyncHandler(async (req: Request, res: Response) => {
  if (!req.params.categoryId) throw AppError.badRequest('categoryId is required');
  await workersService.removeSkill(req.auth!.userId, req.params.categoryId);
  res.status(204).send();
});

export const setAvailability = asyncHandler(async (req: Request, res: Response) => {
  await workersService.setAvailability(req.auth!.userId, req.body.slots);
  res.json({ message: 'Availability updated' });
});

export const requestKycUploadUrl = asyncHandler(async (req: Request, res: Response) => {
  const result = await workersService.requestKycUploadUrl(req.auth!.userId, req.body.type, req.body.contentType);
  res.json({ data: result });
});

export const confirmKycDocument = asyncHandler(async (req: Request, res: Response) => {
  const doc = await workersService.confirmKycDocument(req.auth!.userId, req.body.type, req.body.key);
  res.status(201).json({ data: doc });
});

export const searchWorkers = asyncHandler(async (req: Request, res: Response) => {
  const result = await workersService.searchWorkers(req.query as never);
  res.json({ data: result });
});

export const getWorkerPublicProfile = asyncHandler(async (req: Request, res: Response) => {
  const worker = await workersService.getWorkerPublicProfile(req.params.workerId);
  res.json({ data: worker });
});

export const listFavorites = asyncHandler(async (req: Request, res: Response) => {
  res.json({ data: await workersService.listFavorites(req.auth!.userId) });
});

export const addFavorite = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json({ data: await workersService.addFavorite(req.auth!.userId, req.params.workerId) });
});

export const removeFavorite = asyncHandler(async (req: Request, res: Response) => {
  await workersService.removeFavorite(req.auth!.userId, req.params.workerId);
  res.status(204).send();
});
