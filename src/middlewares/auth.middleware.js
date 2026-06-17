import { supabaseAdmin } from '../config/supabase.js';

export async function checkAuth(req, res, next) {
  try {
    // 1. Extraer el token de la cabecera Authorization
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Sesión inválida o expirada. Falta el token.' });
    }

    // 2. Usar el SDK de Supabase para verificar si el token es real y vigente
    const { data: { user }, error: jwtError } = await supabaseAdmin.auth.getUser(token);

    if (jwtError || !user) {
      console.error("❌ [DEBUG AUTH] Token rechazado por Supabase:", jwtError?.message);
      return res.status(401).json({ error: 'Acceso denegado. Token inválido.' });
    }

    // 3. Ir a la tabla 'perfiles' de PostgreSQL a buscar el nombre completo usando el UUID (user.id)
    const { data: perfil, error: perfilError } = await supabaseAdmin
      .from('perfiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (perfilError || !perfil) {
      console.error("❌ [DEBUG AUTH] No se encontró un perfil para este UUID:", user.id);
      return res.status(403).json({ error: 'No tienes un perfil registrado en la base de datos.' });
    }

    // 4. INYECTAR EL PERFIL REAL EN LA SOLICITUD
    // Ahora req.user tendrá las columnas: id, nombre_completo, rol, etc.
    req.user = perfil; 
    
    console.log(`✅ [DEBUG AUTH] Operación autorizada para el administrador: ${req.user.nombre_completo}`);
    next();

  } catch (err) {
    console.error("💥 Error crítico en checkAuth:", err);
    return res.status(500).json({ error: 'Fallo interno de autenticación.' });
  }
}