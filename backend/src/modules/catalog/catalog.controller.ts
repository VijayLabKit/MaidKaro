import { Request, Response } from 'express';
import { asyncHandler } from '../../common/middleware/errorHandler';
import * as catalogService from './catalog.service';

export const listCategories = asyncHandler(async (req: Request, res: Response) => {
  res.json({ data: await catalogService.listCategories(req.query.all !== 'true') });
});

export const createCategory = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json({ data: await catalogService.createCategory(req.body) });
});

export const updateCategory = asyncHandler(async (req: Request, res: Response) => {
  res.json({ data: await catalogService.updateCategory(req.params.id, req.body) });
});

export const listCities = asyncHandler(async (req: Request, res: Response) => {
  res.json({ data: await catalogService.listCities(req.query.all !== 'true') });
});

export const createCity = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json({ data: await catalogService.createCity(req.body) });
});

export const setCityActive = asyncHandler(async (req: Request, res: Response) => {
  res.json({ data: await catalogService.setCityActive(req.params.id, req.body.isActive) });
});

export const listZonesForCity = asyncHandler(async (req: Request, res: Response) => {
  res.json({ data: await catalogService.listZonesForCity(req.params.cityId) });
});

export const createZone = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json({ data: await catalogService.createZone(req.body) });
});

export const createPincode = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json({ data: await catalogService.createPincode(req.body) });
});

export const resolvePincode = asyncHandler(async (req: Request, res: Response) => {
  const result = await catalogService.resolvePincode(req.params.code);
  if (!result) return res.status(404).json({ error: { code: 'NOT_SERVICEABLE', message: 'MaidKaro is not yet available in this area' } });
  res.json({ data: result });
});

export const setCityCategoryActive = asyncHandler(async (req: Request, res: Response) => {
  const { cityId, categoryId, isActive } = req.body;
  res.json({ data: await catalogService.setCityCategoryActive(cityId, categoryId, isActive) });
});

export const listCategoriesForCity = asyncHandler(async (req: Request, res: Response) => {
  res.json({ data: await catalogService.listCategoriesForCity(req.params.cityId) });
});
