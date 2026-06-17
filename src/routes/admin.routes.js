import { Router } from 'express';
import { checkAuth } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';
import { listApplications, reviewDocument, updateApplicationStatus, getAuditHistory, getApplicationDocuments, getDashboardStats, createNewAdmin,} from '../controllers/admin.controller.js';

const router = Router();

router.use(checkAuth);
router.use(requireRole('ADMINISTRADOR'));

router.get('/applications', listApplications);
router.post('/document/review', reviewDocument);
router.put('/application/status', updateApplicationStatus);
router.get('/application/:id/history', getAuditHistory);
router.get('/application/:solicitudId/documents', getApplicationDocuments);
router.get('/dashboard/stats', getDashboardStats);
router.post('/create-admin', createNewAdmin);

export default router;