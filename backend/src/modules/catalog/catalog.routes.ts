import { Router } from 'express';
import { authenticate, requireRole } from '../../common/middleware/authenticate';
import { validate } from '../../common/middleware/validate';
import * as schema from './catalog.schema';
import * as controller from './catalog.controller';

const router = Router();

// Public read endpoints — customer & worker apps browse the catalog freely.
router.get('/categories', controller.listCategories);
router.get('/cities', controller.listCities);
router.get('/cities/:cityId/zones', controller.listZonesForCity);
router.get('/cities/:cityId/categories', controller.listCategoriesForCity);
router.get('/pincodes/:code', controller.resolvePincode);

// Admin-only writes — catalog changes go live instantly, no app release needed.
router.use(authenticate, requireRole('ADMIN', 'SUPER_ADMIN'));
router.post('/categories', validate(schema.createCategorySchema), controller.createCategory);
router.patch('/categories/:id', validate(schema.updateCategorySchema), controller.updateCategory);
router.post('/cities', validate(schema.createCitySchema), controller.createCity);
router.patch('/cities/:id/active', controller.setCityActive);
router.post('/zones', validate(schema.createZoneSchema), controller.createZone);
router.post('/pincodes', validate(schema.createPincodeSchema), controller.createPincode);
router.post('/city-categories', validate(schema.toggleCityCategorySchema), controller.setCityCategoryActive);

export default router;
