import { Router } from 'express';
import { authenticate, requireRole } from '../../common/middleware/authenticate';
import { validate } from '../../common/middleware/validate';
import { asyncHandler } from '../../common/middleware/errorHandler';
import * as schema from './users.schema';
import * as usersService from './users.service';

const router = Router();
router.use(authenticate, requireRole('CUSTOMER'));

router.get('/me/profile', asyncHandler(async (req, res) => {
  res.json({ data: await usersService.getMyProfile(req.auth!.userId) });
}));

router.patch('/me/profile', validate(schema.updateCustomerProfileSchema), asyncHandler(async (req, res) => {
  res.json({ data: await usersService.updateMyProfile(req.auth!.userId, req.body) });
}));

router.get('/me/addresses', asyncHandler(async (req, res) => {
  res.json({ data: await usersService.listAddresses(req.auth!.userId) });
}));

router.post('/me/addresses', validate(schema.createAddressSchema), asyncHandler(async (req, res) => {
  res.status(201).json({ data: await usersService.addAddress(req.auth!.userId, req.body) });
}));

router.patch('/me/addresses/:id', validate(schema.updateAddressSchema), asyncHandler(async (req, res) => {
  res.json({ data: await usersService.updateAddress(req.auth!.userId, req.params.id, req.body) });
}));

router.delete('/me/addresses/:id', asyncHandler(async (req, res) => {
  await usersService.deleteAddress(req.auth!.userId, req.params.id);
  res.status(204).send();
}));

export default router;
