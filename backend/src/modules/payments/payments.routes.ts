import { Router, raw } from 'express';
import { authenticate, requireRole } from '../../common/middleware/authenticate';
import * as controller from './payments.controller';

const router = Router();

// Raw body needed for HMAC signature verification — mounted before json() globally, see app.ts
router.post('/webhook', raw({ type: '*/*' }), controller.handleWebhook);

router.use(authenticate, requireRole('WORKER'));
router.get('/payouts/summary', controller.getMyPayoutSummary);
router.post('/payouts/request', controller.requestPayout);
router.get('/payouts', controller.listMyPayouts);

export default router;
