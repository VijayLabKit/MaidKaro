import { Router } from 'express';
import { authenticate, requireRole } from '../../common/middleware/authenticate';
import { validate } from '../../common/middleware/validate';
import * as schema from './admin.schema';
import * as controller from './admin.controller';

const router = Router();

// Every admin route requires an authenticated ADMIN or SUPER_ADMIN.
router.use(authenticate, requireRole('ADMIN', 'SUPER_ADMIN'));

router.get('/workers/pending', controller.listPendingWorkers);
router.get('/workers/:workerId', controller.getWorkerForReview);
router.post('/workers/:workerId/review', validate(schema.reviewWorkerSchema), controller.reviewWorker);
router.post('/documents/:documentId/review', validate(schema.reviewDocumentSchema), controller.reviewDocument);

router.get('/customers', controller.listCustomers);
router.get('/bookings', controller.listBookings);

router.get('/complaints', controller.listComplaints);
router.post('/complaints/:complaintId/resolve', validate(schema.resolveComplaintSchema), controller.resolveComplaint);

router.get('/analytics/overview', controller.getAnalyticsOverview);
router.patch('/categories/:categoryId/commission', validate(schema.updateCommissionSchema), controller.updateCategoryCommission);

export default router;
