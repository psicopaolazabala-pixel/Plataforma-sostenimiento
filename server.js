import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import authRoutes from './src/routes/auth.routes.js';
import apprenticeRoutes from './src/routes/apprentice.routes.js';
import adminRoutes from './src/routes/admin.routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(cors());
app.use(express.json());

// Servir archivos estáticos del Frontend
app.use(express.static(path.join(__dirname, 'src/views')));

// Registro de endpoints de la API
app.use('/api/auth', authRoutes);
app.use('/api/apprentice', apprenticeRoutes);
app.use('/api/admin', adminRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor de Arquitectura del Portal ejecutándose en puerto ${PORT}`));