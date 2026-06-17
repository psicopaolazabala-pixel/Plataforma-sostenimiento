import { Router } from 'express';
import multer from 'multer';
import { checkAuth } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';
import { getDashboard, updateProfile, uploadDocument, getNotifications } from '../controllers/apprentice.controller.js';

const router = Router();
const upload = multer({ limits: { fileSize: 5 * 1024 * 1024 } }); // Límite de 5MB por archivo

router.use(checkAuth);
router.use(requireRole('APRENDIZ'));

router.get('/dashboard', getDashboard);
router.put('/profile', updateProfile);
router.post('/document/upload', upload.single('archivo'), uploadDocument);
router.get('/notifications', getNotifications);

export default router;