import { supabaseAdmin } from '../config/supabase.js';

export async function getDashboard(req, res) {
  try {
    const userId = req.user.id;

    // Obtener información del perfil y su solicitud asociada
    const { data: perfil } = await supabaseAdmin.from('perfiles').select('*').eq('id', userId).single();
    let { data: solicitud } = await supabaseAdmin.from('solicitudes').select('*').eq('aprendiz_id', userId).single();

    if (!solicitud) {
      // Si no existe, se inicializa la solicitud automáticamente en estado BORRADOR
      const { data: nuevaSolicitud } = await supabaseAdmin
        .from('solicitudes')
        .insert([{ aprendiz_id: userId, estado: 'BORRADOR' }])
        .select()
        .single();
      solicitud = nuevaSolicitud;
    }

    // Obtener los documentos anexados a la solicitud
    const { data: documentos } = await supabaseAdmin.from('documentos').select('*').eq('solicitud_id', solicitud.id);

    res.status(200).json({ perfil, solicitud, documentos });
  } catch (err) {
    res.status(500).json({ error: 'Fallo al procesar los datos del Dashboard.' });
  }
}

export async function updateProfile(req, res) {
  const { celular, ficha, programa } = req.body;
  try {
    const { error } = await supabaseAdmin.from('perfiles').update({
      celular,
      ficha_caracterizacion: ficha,
      programa_formacion: programa
    }).eq('id', req.user.id);

    if (error) return res.status(400).json({ error: error.message });
    res.status(200).json({ message: 'Perfil actualizado correctamente.' });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar perfil.' });
  }
}

export async function uploadDocument(req, res) {
  const { tipoDocumento, solicitudId } = req.body;
  const archivo = req.file;

  if (!archivo) return res.status(400).json({ error: 'No se envió ningún archivo físico.' });

  try {
    // 1. FUNCIÓN SENIOR DE SANITIZACIÓN: Elimina acentos, eñes, espacios y símbolos raros
    const limpiarNombreArchivo = (nombreOriginal) => {
      return nombreOriginal
        .normalize("NFD")                    // Separa las tildes de las letras
        .replace(/[\u0300-\u036f]/g, "")     // Elimina los acentos por completo
        .replace(/[cC]ó/g, 'o')              // Parche preventivo para codificaciones corruptas (Ã©, ©)
        .replace(/[^a-zA-Z0-9.\-_]/g, '_')   // Cualquier cosa que NO sea letra, número, punto o guion se vuelve un guion bajo
        .replace(/__+/g, '_');               // Evita guiones bajos repetidos consecutivamente
    };

    const nombreLimpio = limpiarNombreArchivo(archivo.originalname);
    
    // 2. Construir la ruta usando la variable sanitizada
    const storagePath = `${req.user.id}/${Date.now()}_${nombreLimpio}`;
    
    console.log(`[Storage] Intentando cargar archivo con ruta sanitizada: ${storagePath}`);

    // 3. Carga física en el Bucket Privado
    const { data: storageData, error: storageError } = await supabaseAdmin.storage
      .from('documentos-sostenimiento')
      .upload(storagePath, archivo.buffer, { 
        contentType: archivo.mimetype,
        upsert: true 
      });

    if (storageError) {
      console.error("[Storage Error]:", storageError.message);
      return res.status(400).json({ error: `Error en Storage: ${storageError.message}` });
    }

    // 4. Comprobar si el documento del mismo tipo ya existía en PostgreSQL para actualizarlo
    const { data: docExistente } = await supabaseAdmin
      .from('documentos')
      .select('id')
      .eq('solicitud_id', solicitudId)
      .eq('nombre_tipo', tipoDocumento)
      .single();

    if (docExistente) {
      await supabaseAdmin.from('documentos').update({
        storage_path: storagePath,
        estado: 'PENDIENTE',
        actualizado_at: new Date()
      }).eq('id', docExistente.id);
    } else {
      await supabaseAdmin.from('documentos').insert([{
        solicitud_id: solicitudId,
        nombre_tipo: tipoDocumento,
        storage_path: storagePath,
        estado: 'PENDIENTE'
      }]);
    }

    // 5. Cambiar el estado de la solicitud global automáticamente
    await supabaseAdmin.from('solicitudes')
      .update({ estado: 'DOCUMENTOS_CARGADOS', actualizado_at: new Date() })
      .eq('id', solicitudId);

    return res.status(200).json({ message: 'Documento procesado y cargado con éxito.' });

  } catch (err) {
    console.error("[Backend] Error crítico en subida:", err);
    return res.status(500).json({ error: `Error interno en el servidor: ${err.message}` });
  }
}

export async function getNotifications(req, res) {
  try {
    const { data } = await supabaseAdmin.from('notificaciones')
      .select('*')
      .eq('usuario_id', req.user.id)
      .order('creado_at', { ascending: false });
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener notificaciones.' });
  }
}