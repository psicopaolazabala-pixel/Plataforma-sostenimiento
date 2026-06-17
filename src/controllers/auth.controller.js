import { supabaseClient, supabaseAdmin } from '../config/supabase.js';

export async function signup(req, res) {
  const { email, password, nombreCompleto, documentoIdentidad, celular, ficha, programa } = req.body;

  try {
    // 1. Registro en Supabase Auth
    const { data: authData, error: authError } = await supabaseClient.auth.signUp({ email, password });
    if (authError) return res.status(400).json({ error: authError.message });

    if (authData.user) {
      // 2. Creación del registro en la tabla transaccional perfiles usando cliente administrador
      const { error: profileError } = await supabaseAdmin.from('perfiles').insert([{
        id: authData.user.id,
        nombre_completo: nombreCompleto,
        documento_identidad: documentoIdentidad,
        celular,
        ficha_caracterizacion: ficha,
        programa_formacion: programa,
        rol: 'APRENDIZ'
      }]);

      if (profileError) return res.status(400).json({ error: profileError.message });
    }

    res.status(201).json({ message: 'Usuario registrado con éxito.' });
  } catch (err) {
    res.status(500).json({ error: 'Error crítico en el servidor durante el registro.' });
  }
}

export async function login(req, res) {
  const { email, password } = req.body;
  
  console.log(`[Backend] Iniciando túnel directo REST para: ${email}`);

  if (!email || !password) {
    return res.status(400).json({ error: 'El correo y la contraseña son obligatorios.' });
  }

  try {
    const urlLimpia = process.env.SUPABASE_URL.replace(/['"\r\n]/g, '').trim();
    const apiKeyLimpia = process.env.SUPABASE_ANON_KEY.replace(/['"\r\n]/g, '').trim();

    // 1. Conexión directa al API Gateway de Supabase Auth por HTTP REST nativo
    const respuestaSupabase = await fetch(`${urlLimpia}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKeyLimpia
      },
      body: JSON.stringify({ email, password })
    });

    const dataAuth = await respuestaSupabase.json();

    // Si Supabase devuelve un error de credenciales (Ej: Cuenta no existe o clave errónea)
    if (!respuestaSupabase.ok) {
      console.log("[Backend] Supabase REST rechazó las credenciales:", dataAuth.error_description || dataAuth.error);
      return res.status(respuestaSupabase.status).json({ 
        error: `Acceso denegado: ${dataAuth.error_description || 'Correo o contraseña incorrectos en Supabase.'}` 
      });
    }

    console.log(`[Backend] Autenticación REST exitosa. ID de Usuario: ${dataAuth.user.id}. Verificando rol...`);

    // 2. Volvemos al flujo administrador para validar el rol en tu base de datos PostgreSQL
    // Importamos dinámicamente para asegurar compatibilidad
    const { supabaseAdmin } = await import('../config/supabase.js');
    
    const { data: perfil, error: perfilError } = await supabaseAdmin
      .from('perfiles')
      .select('rol')
      .eq('id', dataAuth.user.id)
      .single();

    if (perfilError || !perfil) {
      console.error("[Backend] Error al buscar perfil en PostgreSQL:", perfilError?.message);
      return res.status(403).json({ 
        error: 'Usuario autenticado correctamente, pero no existe un perfil asociado en la tabla "perfiles" de PostgreSQL.' 
      });
    }

    console.log(`[Backend] Login completado. Rol: ${perfil.rol}`);

    // 3. Responder al frontend con la estructura exacta esperada
    return res.status(200).json({ 
      token: dataAuth.access_token, 
      user: dataAuth.user, 
      rol: perfil.rol 
    });

  } catch (err) {
    console.error("[Backend] Error crítico en el túnel REST:", err);
    return res.status(500).json({ error: `Error de conexión interna: ${err.message}` });
  }
}