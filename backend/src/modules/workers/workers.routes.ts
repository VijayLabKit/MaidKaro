import { Router } from 'express';
import { authenticate, requireRole } from '../../common/middleware/authenticate';
import { validate } from '../../common/middleware/validate';
import * as schema from './workers.schema';
import * as controller from './workers.controller';

const router = Router();

// Public / customer-facing search
router.get('/search', validate(schema.searchWorkersSchema, 'query'), controller.searchWorkers);
router.get('/:workerId', controller.getWorkerPublicProfile);

// Worker-only self-service routes
router.use(authenticate);
router.get('/me/profile', requireRole('WORKER'), controller.getMyProfile);
router.patch('/me/profile', requireRole('WORKER'), validate(schema.updateWorkerProfileSchema), controller.updateMyProfile);
router.post('/me/skills', requireRole('WORKER'), validate(schema.addSkillSchema), controller.addSkill);
router.delete('/me/skills/:categoryId', requireRole('WORKER'), controller.removeSkill);
router.put('/me/availability', requireRole('WORKER'), validate(schema.setAvailabilitySchema), controller.setAvailability);
router.post(
  '/me/kyc/upload-url',
  requireRole('WORKER'),
  validate(schema.requestUploadUrlSchema),
  controller.requestKycUploadUrl,
);
router.post('/me/kyc/confirm', requireRole('WORKER'), validate(schema.confirmDocumentSchema), controller.confirmKycDocument);

// Customer favorites
router.get('/favorites/me', requireRole('CUSTOMER'), controller.listFavorites);
router.post('/:workerId/favorite', requireRole('CUSTOMER'), controller.addFavorite);
router.delete('/:workerId/favorite', requireRole('CUSTOMER'), controller.removeFavorite);

export default router;
