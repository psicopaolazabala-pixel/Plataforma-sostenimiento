import { Router } from 'express';
import { signup, login, recoverPassword, updatePassword,  } from '../controllers/auth.controller.js';

const router = Router();
router.post('/signup', signup);
router.post('/login', login);
// Añade esta ruta a tus endpoints públicos de Auth
router.post('/recover-password', recoverPassword);
router.post('/update-password', updatePassword);

export default router;
