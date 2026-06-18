import { supabaseClient, supabaseAdmin } from '../config/supabase.js';
import { enviarNotificacionPorCorreo } from '../services/email.service.js';
import crypto from 'crypto'; // Librería nativa de Node.js para generar strings seguros

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

// 1. SOLICITAR RECUPERACIÓN (CORREO PERSONALIZADO Y CONTROLADO)
// 1. SOLICITAR RECUPERACIÓN (MÉTODO REST NATIVO SIN MAPEO DE ESQUEMAS)
// 1. SOLICITAR RECUPERACIÓN (SOLO NODEMAILER PERSONALIZADO)
export async function recoverPassword(req, res) {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'El correo electrónico es obligatorio.' });
  }

  try {
    const correoLimpio = email.trim().toLowerCase();
    console.log(`\n==================================================`);
    console.log(`🔍 [DEBUG RECUPERACIÓN] Generando link seguro para: "${correoLimpio}"`);

    // 🚀 CORRECCIÓN CRÍTICA: Eliminamos el 'fetch' a /auth/v1/recover para que Supabase NO envíe nada.
    // Usamos directamente generateLink, que crea el token en la nube de forma silenciosa.
    const { data: { user }, error: adminError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: correoLimpio,
      options: { redirectTo: 'http://localhost:3000/restablecer-password.html' }
    });

    if (adminError || !user) {
      console.warn(`❌ [FALLO] Supabase Admin no encontró el correo: ${correoLimpio}`);
      console.log(`==================================================\n`);
      return res.status(404).json({ error: 'No se encontró ninguna cuenta asociada a este correo electrónico.' });
    }

    console.log(`✅ [ÉXITO] Link único generado en Supabase para UUID: ${user.id}`);

    // Generar el token único de control para tu tabla en PostgreSQL
    const tokenUnico = crypto.randomBytes(32).toString('hex');
    const fechaExpiracion = new Date();
    fechaExpiracion.setDate(fechaExpiracion.getDate() + 7); // Vence en 7 días

    // Registrar en tu tabla transaccional tokens_recuperacion
    const { error: dbError } = await supabaseAdmin
      .from('tokens_recuperacion')
      .insert([{
        usuario_id: user.id,
        token_seguro: tokenUnico,
        expiracion: fechaExpiracion,
        usado: false
      }]);

    if (dbError) {
      console.error("❌ Error al guardar token en PostgreSQL:", dbError.message);
      return res.status(400).json({ error: 'Error interno al registrar el token de seguridad.' });
    }

    // Despachar únicamente el correo electrónico con tu Nodemailer personalizado
    const enlaceRecuperacion = `http://localhost:3000/restablecer-password.html?token=${tokenUnico}`;
    const mensajeHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #0076A8; color: white; padding: 1.5rem; text-align: center;">
          <h2>Portal de Sostenimiento SENA</h2>
        </div>
        <div style="padding: 2rem; color: #333; line-height: 1.6;">
          <p>Estimado Aprendiz,</p>
          <p>Has solicitado restablecer tu contraseña de acceso para el sistema.</p>
          <p>Este enlace es válido por <strong>7 días</strong> y se puede utilizar <strong>una sola vez</strong>:</p>
          <div style="text-align: center; margin: 2rem 0;">
            <a href="${enlaceRecuperacion}" style="background-color: #23893E; color: white; padding: 0.75rem 1.5rem; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">Restablecer mi Contraseña</a>
          </div>
          <p style="font-size: 0.9rem; color: #666;">Si no realizaste esta solicitud, puedes ignorar este mensaje.</p>
        </div>
      </div>
    `;
    
    await enviarNotificacionPorCorreo(user.id, 'Enlace de Recuperación de Contraseña', mensajeHtml);

    console.log(`📧 [SISTEMA] Correo único de Nodemailer enviado correctamente.`);
    console.log(`==================================================\n`);
    
    return res.status(200).json({ message: 'Se ha enviado un correo personalizado con el enlace único.' });

  } catch (err) {
    console.error("💥 Error crítico en recoverPassword:", err);
    return res.status(500).json({ error: 'Error interno en el servidor.' });
  }
}

// 2. ACTUALIZAR CLAVE (VALIDACIÓN DE UN SOLO USO Y TIEMPO LÍMITE)
// 2. ACTUALIZAR CLAVE (CON DEBUG EXTREMO EN TERMINAL)
export async function updatePassword(req, res) {
  console.log(`\n==================================================`);
  console.log(`📥 [DEBUG BACKEND] Petición /update-password recibida!`);
  console.log(`📦 [DEBUG PAYLOAD]:`, req.body);

  const { token, password } = req.body;

  // Validación preventiva inicial
  if (!token) {
    console.error("❌ [DEBUG BACKEND ERROR]: El token llegó vacío desde el cliente.");
    return res.status(400).json({ error: 'El token de seguridad es requerido.' });
  }

  if (!password || password.length < 6) {
    console.error(`❌ [DEBUG BACKEND ERROR]: Contraseña inválida o muy corta. Longitud: ${password?.length}`);
    return res.status(400).json({ error: 'La contraseña debe tener mínimo 6 caracteres.' });
  }

  try {
    console.log(`🔍 [DEBUG BACKEND] Buscando token "${token}" en PostgreSQL...`);
    
    // Buscar el token en tu tabla de control
    const { data: tokenReg, error: tokenError } = await supabaseAdmin
      .from('tokens_recuperacion')
      .select('*')
      .eq('token_seguro', token)
      .maybeSingle(); // Cambiado a maybeSingle para evitar excepciones destructivas

    if (tokenError) {
      console.error("❌ [DEBUG SUPABASE SQL ERROR]:", tokenError.message);
      return res.status(400).json({ error: `Fallo en la base de datos: ${tokenError.message}` });
    }

    if (!tokenReg) {
      console.warn("❌ [DEBUG BACKEND WARN]: El token no existe en la tabla tokens_recuperacion.");
      return res.status(400).json({ error: 'El enlace de recuperación es inválido o ya caducó.' });
    }

    console.log(`✅ [DEBUG BACKEND] Token encontrado. Usado: ${tokenReg.usado}, Expiración: ${tokenReg.expiracion}`);

    // VALIDACIÓN 1: ¿Ya fue usado?
    if (tokenReg.usado) {
      console.warn("❌ [DEBUG BACKEND WARN]: Intento de reutilizar un token ya quemado.");
      return res.status(400).json({ error: 'Este enlace ya fue utilizado previamente. Solicita uno nuevo.' });
    }

    // VALIDACIÓN 2: ¿Ya expiró?
    const ahora = new Date();
    const tiempoExpiracion = new Date(tokenReg.expiracion);
    if (ahora > tiempoExpiracion) {
      console.warn(`❌ [DEBUG BACKEND WARN]: Token caducado. Expired: ${tiempoExpiracion} | Now: ${ahora}`);
      return res.status(400).json({ error: 'El enlace de recuperación ha caducado (Límite superado).' });
    }

    console.log(`🚀 [DEBUG BACKEND] Validaciones correctas. Actualizando credenciales en Supabase Auth para el usuario ID: ${tokenReg.usuario_id}...`);

    // Actualizar contraseña en el proveedor de Auth mediante la API Admin
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.updateUserById(tokenReg.usuario_id, {
      password: password
    });

    if (authError) {
      console.error("❌ [DEBUG SUPABASE AUTH ADMIN ERROR]:", authError.message);
      return res.status(400).json({ error: `Error de autenticación en la nube: ${authError.message}` });
    }

    console.log(`🔥 [DEBUG BACKEND] Contraseña cambiada con éxito en Auth para: ${authData.user?.email}. Quemando token...`);

    // Marcar el token como usado para que quede inhabilitado
    const { error: burnError } = await supabaseAdmin
      .from('tokens_recuperacion')
      .update({ usado: true })
      .eq('id', tokenReg.id);

    if (burnError) {
      console.error("⚠️ [DEBUG BACKEND ALERT]: La clave se cambió pero no se pudo quemar el token en la BD:", burnError.message);
    }

    console.log(`🎉 [DEBUG BACKEND COMPLETADO]: Todo el flujo salió al 100%. Respondiendo éxito.`);
    console.log(`==================================================\n`);
    
    return res.status(200).json({ message: 'Tu contraseña ha sido actualizada exitosamente.' });

  } catch (err) {
    console.error("💥 [DEBUG BACKEND EXCEPCIÓN CRÍTICA]:", err);
    return res.status(500).json({ error: `Fallo crítico interno: ${err.message}` });
  }
}
