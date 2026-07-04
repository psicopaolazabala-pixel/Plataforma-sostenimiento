import { supabaseAdmin } from '../config/supabase.js';
import { enviarNotificacionPorCorreo } from '../services/email.service.js';

// 1. LISTAR POSTULACIONES (Línea 3 de tu archivo)
export async function listApplications(req, res) {
  try {
    // CORRECCIÓN: Agregamos explicitamente 'ultima_observacion_por' a la selección
    const { data, error } = await supabaseAdmin
      .from('solicitudes')
      .select(`
        id, estado, observaciones_generales, ultima_observacion_por, actualizado_at,
        perfiles (id, nombre_completo, documento_identidad, ficha_caracterizacion, programa_formacion)
      `).order('actualizado_at', { ascending: false });

    if (error) return res.status(400).json({ error: error.message });
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Error al listar las postulaciones.' });
  }
}

// 2. DICTAMEN GLOBAL (Línea 66 de tu archivo)
// 2. DICTAMEN GLOBAL CORREGIDO (Línea 23 de tu archivo original)
export async function updateApplicationStatus(req, res) {
  const { solicitudId, estado, observaciones, aprendizId } = req.body;
  const nombreAdmin = req.user?.nombre_completo || 'Administrador de Bienestar';

  try {
    console.log(`\n========== [DEBUG CORREO] INICIANDO DICTAMEN GLOBAL ==========`);
    
    // Actualizar estado general de la postulación
    const { error } = await supabaseAdmin.from('solicitudes')
      .update({ 
        estado, 
        observaciones_generales: observaciones, 
        ultima_observacion_por: nombreAdmin, 
        actualizado_at: new Date() 
      })
      .eq('id', solicitudId);

    if (error) return res.status(400).json({ error: error.message });

    const mensajeGlobal = `El estado actual de su solicitud de apoyo es: ${estado}. Detalle: ${observaciones}. Revisor: ${nombreAdmin}`;

    // Notificación del cambio de estado global de su trámite
    await supabaseAdmin.from('notificaciones').insert([{
      usuario_id: aprendizId,
      titulo: `Cambio de Estado de Postulación`,
      mensaje: mensajeGlobal
    }]);

    // 🚀 CORRECCIÓN CRÍTICA: Usamos await para asegurar que se procese antes de responder
    console.log(`[DEBUG CORREO] Despachando e-mail de Dictamen a UUID: ${aprendizId}...`);
    await enviarNotificacionPorCorreo(aprendizId, 'Cambio de Estado de Postulación', mensajeGlobal);

    console.log(`========== [DEBUG CORREO] FIN DICTAMEN GLOBAL ==========\n`);
    return res.status(200).json({ message: 'Estado de postulación actualizado con éxito.' });
  } catch (err) {
    console.error("💥 Error en updateApplicationStatus:", err);
    return res.status(500).json({ error: 'Error al cambiar el estado de la solicitud.' });
  }
}

// 3. REVISAR DOCUMENTO INDIVIDUAL CORREGIDO (Línea 52 de tu archivo original)
export async function reviewDocument(req, res) {
  const { documentoId, estado, observacion, aprendizId } = req.body;
  const nombreAdmin = req.user?.nombre_completo || 'Administrador de Bienestar'; 

  try {
    console.log(`\n========== [DEBUG CORREO] INICIANDO DISQUERA DOC ==========`);
    
    // 1. Actualizar el documento individual con la firma del evaluador
    const { error: docError } = await supabaseAdmin
      .from('documentos')
      .update({ 
        estado, 
        observacion_especifica: observacion,
        evaluado_por: nombreAdmin, 
        actualizado_at: new Date() 
      })
      .eq('id', documentoId);

    if (docError) {
      console.error("❌ Error en update de documento:", docError.message);
      return res.status(400).json({ error: docError.message });
    }

    // Actualizar la última observación por en la solicitud contenedora
    const { data: docData } = await supabaseAdmin
      .from('documentos')
      .select('solicitud_id')
      .eq('id', documentoId)
      .single();

    if (docData?.solicitud_id) {
      await supabaseAdmin.from('solicitudes')
        .update({ ultima_observacion_por: nombreAdmin, actualizado_at: new Date() })
        .eq('id', docData.solicitud_id);
    }

    const mensajeNotificacion = `Tu documento fue evaluado como [${estado}] por ${nombreAdmin}. Obs: ${observacion || 'Ninguna'}`;
    
    // 2. Insertar notificación para el aprendiz
    const { error: notiError } = await supabaseAdmin
      .from('notificaciones')
      .insert([{
        usuario_id: aprendizId, 
        titulo: 'Actualización de Documento',
        mensaje: mensajeNotificacion
      }]);

    if (notiError) console.error("⚠️ Alerta: No se pudo guardar la notificación interna:", notiError.message);

    // 🚀 CORRECCIÓN CRÍTICA: Usamos await para asegurar la persistencia del envío SMTP
    console.log(`[DEBUG CORREO] Despachando e-mail de Disquera a UUID: ${aprendizId}...`);
    await enviarNotificacionPorCorreo(aprendizId, 'Actualización de Documento', mensajeNotificacion);

    console.log(`========== [DEBUG CORREO] FIN DISQUERA DOC ==========\n`);
    return res.status(200).json({ message: 'Documento calificado con éxito y notificado.' });

  } catch (err) {
    console.error("💥 Error crítico en reviewDocument:", err);
    return res.status(500).json({ error: err.message });
  }
}

// export async function updateApplicationStatus(req, res) {
//   const { solicitudId, estado, observaciones, aprendizId } = req.body;
//   try {
//     // Actualizar estado general de la postulación
//     const { error } = await supabaseAdmin.from('solicitudes')
//       .update({ estado, observaciones_generales: observaciones, actualizado_at: new Date() })
//       .eq('id', solicitudId);

//     if (error) return res.status(400).json({ error: error.message });

//     // Notificación del cambio de estado global de su trámite
//     await supabaseAdmin.from('notificaciones').insert([{
//       usuario_id: aprendizId,
//       titulo: `Cambio de Estado de Postulación`,
//       mensaje: `El estado actual de su solicitud de apoyo es: ${estado}. Detalle: ${observaciones}`
//     }]);

//     res.status(200).json({ message: 'Estado de postulación actualizado.' });
//   } catch (err) {
//     res.status(500).json({ error: 'Error al cambiar el estado de la solicitud.' });
//   }
// }

export async function getAuditHistory(req, res) {
  const { id } = req.params;
  try {
    const { data } = await supabaseAdmin.from('historial_estados')
      .select('*')
      .eq('solicitud_id', id)
      .order('creado_at', { ascending: true });
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Error al recuperar el historial de auditoría.' });
  }
}

export async function getApplicationDocuments(req, res) {
  const { solicitudId } = req.params;

  try {
    // 1. Obtener los metadatos de los documentos desde PostgreSQL
    const { data: documentos, error: docError } = await supabaseAdmin
      .from('documentos')
      .select('*')
      .eq('solicitud_id', solicitudId);

    if (docError) return res.status(400).json({ error: docError.message });

    // 2. Para cada documento, generar una URL firmada de Supabase Storage (Vence en 5 min)
    const documentosConUrl = await Promise.all(documentos.map(async (doc) => {
      const { data: signData, error: signError } = await supabaseAdmin.storage
        .from('documentos-sostenimiento')
        .createSignedUrl(doc.storage_path, 300); // 300 segundos = 5 minutos

      return {
        ...doc,
        url_visualizacion: signError ? null : signData.signedUrl
      };
    }));

    return res.status(200).json(documentosConUrl);
  } catch (err) {
    console.error("[Backend] Error al recuperar expedientes:", err);
    return res.status(500).json({ error: 'Error interno al generar enlaces de visualización.' });
  }
}

export async function getDashboardStats(req, res) {
  try {
    // 1. Obtener conteo total de perfiles con rol APRENDIZ
    const { count: totalAprendices, error: err1 } = await supabaseAdmin
      .from('perfiles')
      .select('*', { count: 'exact', head: true })
      .eq('rol', 'APRENDIZ');

    // 2. Obtener agrupación por estados directamente desde la tabla solicitudes
    const { data: solicitudes, error: err2 } = await supabaseAdmin
      .from('solicitudes')
      .select('estado');

    if (err1 || err2) {
      return res.status(400).json({ error: err1?.message || err2?.message });
    }

    // Inicializamos el objeto de conteo de estados
    const estadosCounter = {
      BORRADOR: 0,
      DOCUMENTOS_CARGADOS: 0,
      PENDIENTE_REVISION: 0,
      REQUIERE_CORRECCION: 0,
      APROBADA: 0,
      RECHAZADA: 0
    };

    // Totalizamos dinámicamente cada estado presente en la base de datos
    solicitudes.forEach(sol => {
      if (estadosCounter[sol.estado] !== undefined) {
        estadosCounter[sol.estado]++;
      }
    });

    // 3. Responder con el consolidado estructurado para el frontend
    return res.status(200).json({
      totalInscritos: totalAprendices || 0,
      porRevisar: estadosCounter.DOCUMENTOS_CARGADOS + estadosCounter.PENDIENTE_REVISION,
      requiereCorreccion: estadosCounter.REQUIERE_CORRECCION,
      aprobadas: estadosCounter.APROBADA,
      rechazadas: estadosCounter.RECHAZADA
    });

  } catch (err) {
    console.error("[Backend] Error en analítica:", err);
    return res.status(500).json({ error: 'Fallo interno al compilar estadísticas.' });
  }
}

export async function createNewAdmin(req, res) {
  // 1. Log de entrada para verificar que Express sí atrapó la petición
  console.log("===> [DEBUG BACKEND] ¡Petición /create-admin recibida con éxito!");
  console.log("[DEBUG PAYLOAD]:", req.body);

  const { email, password, nombreCompleto, documentoIdentidad, celular } = req.body;

  // Validación preventiva
  if (!email || !password || !nombreCompleto || !documentoIdentidad) {
    console.error("❌ [DEBUG ERROR]: Faltan campos obligatorios en el body.");
    return res.status(400).json({ error: 'Todos los campos son obligatorios, excepto el celular.' });
  }

  try {
    console.log(`[DEBUG AUTH]: Intentando registrar en Supabase Auth a: ${email}`);
    
    // 2. Intentar crear el usuario en Supabase Auth
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true 
    });

    if (authError) {
      console.error("❌ [DEBUG ERROR SUPABASE AUTH]:", authError.message);
      return res.status(400).json({ error: `Error en la nube (Auth): ${authError.message}` });
    }

    console.log(`✅ [DEBUG AUTH EXITOSO]: UUID generado: ${authUser.user.id}. Creando perfil transaccional...`);

    // 3. Insertar datos en PostgreSQL
    const { error: perfilError } = await supabaseAdmin
      .from('perfiles')
      .insert([{
        id: authUser.user.id,
        nombre_completo: nombreCompleto,
        documento_identidad: documentoIdentidad,
        celular: celular,
        rol: 'ADMINISTRADOR'
      }]);

    if (perfilError) {
      console.error("❌ [DEBUG ERROR POSTGRES PERFIL]:", perfilError.message);
      // Tip Senior: Si falló la tabla, borramos el usuario de Auth para evitar inconsistencias
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
      return res.status(400).json({ error: `Error en la base de datos (PostgreSQL): ${perfilError.message}` });
    }

    console.log(`🎉 [DEBUG COMPLETO]: Administrador ${nombreCompleto} creado e indexado con éxito.`);
    return res.status(200).json({ message: 'Nuevo Administrador registrado correctamente.' });

  } catch (err) {
    console.error("💥 [DEBUG CRÍTICO EXCEPCIÓN]:", err);
    return res.status(500).json({ error: `Fallo interno del servidor: ${err.message}` });
  }
}

// 4. ELIMINAR UN DOCUMENTO INDIVIDUAL DEL EXPEDIENTE
export async function deleteDocument(req, res) {
  const { id } = req.params;

  try {
    console.log(`\n==================================================`);
    console.log(`🗑️ [DEBUG ELIMINACIÓN] Solicitud para borrar documento ID: ${id}`);

    // 1. Buscar la ruta del Storage antes de borrar para no dejar huérfano el archivo físico
    const { data: doc, error: fetchError } = await supabaseAdmin
      .from('documentos')
      .select('storage_path, nombre_tipo')
      .eq('id', id)
      .maybeSingle();

    if (fetchError || !doc) {
      console.error("❌ No se encontró el documento especificado.");
      return res.status(404).json({ error: 'El documento no existe en el expediente.' });
    }

    // 2. Remover archivo físico de Supabase Storage
    if (doc.storage_path) {
      const { error: storageError } = await supabaseAdmin.storage
        .from('documentos-sostenimiento') // Mismo bucket de visualización
        .remove([doc.storage_path]);

      if (storageError) {
        console.warn("⚠️ Alerta en Storage (Posiblemente el archivo físico no existía):", storageError.message);
      } else {
        console.log(`✅ Archivo eliminado del Storage: ${doc.storage_path}`);
      }
    }

    // 3. Eliminar el registro en PostgreSQL
    const { error: dbError } = await supabaseAdmin
      .from('documentos')
      .delete()
      .eq('id', id);

    if (dbError) {
      console.error("❌ Error al eliminar registro en Postgres:", dbError.message);
      return res.status(400).json({ error: dbError.message });
    }

    console.log(`🎉 [ÉXITO] Documento "${doc.nombre_tipo}" purgado completamente.`);
    console.log(`==================================================\n`);

    return res.status(200).json({ message: 'Documento eliminado exitosamente del expediente.' });

  } catch (err) {
    console.error("💥 Error crítico en deleteDocument:", err);
    return res.status(500).json({ error: 'Fallo interno al procesar la eliminación.' });
  }
}

// obtener el estado de la convocatoria
export async function getConvocatoriaEstado(req, res) {
  try {
    const { data, error } = await supabaseAdmin
      .from('configuracion_sistema')
      .select('convocatoria_activa')
      .eq('id', 1)
      .single();

    if (error) return res.status(400).json({ error: error.message });
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Error al consultar estado del sistema.' });
  }
}

// Alternar el estado (Habilitar/Deshabilitar)
export async function toggleConvocatoria(req, res) {
  const { activa } = req.body;
  try {
    const { data, error } = await supabaseAdmin
      .from('configuracion_sistema')
      .update({ convocatoria_activa: activa, actualizado_at: new Date() })
      .eq('id', 1)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    return res.status(200).json({ 
      message: activa ? 'Convocatoria habilitada con éxito.' : 'Convocatoria congelada. Los aprendices no podrán subir más archivos.',
      convocatoria_activa: data.convocatoria_activa 
    });
  } catch (err) {
    return res.status(500).json({ error: 'Error al cambiar la configuración.' });
  }
}
