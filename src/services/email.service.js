import nodemailer from 'nodemailer';
import { supabaseAdmin } from '../config/supabase.js';

// Configuración del transportador de salida (SMTP)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'psicopaola.zabala@gmail.com', // <-- Reemplaza con tu correo
    pass: 'boud ntzr rtgi bihs'  // <-- Reemplaza con tu contraseña de aplicación de Google
  }
});

/**
 * Función encargada de buscar el correo del aprendiz y despachar la notificación
 */
export async function enviarNotificacionPorCorreo(usuarioId, titulo, mensaje) {
  try {
    // 1. Consultar el correo electrónico del aprendiz directo desde Supabase Auth usando su ID
    const { data: { user }, error: authError } = await supabaseAdmin.auth.admin.getUserById(usuarioId);

    if (authError || !user || !user.email) {
      console.error(`❌ [Email Service] No se pudo obtener el correo para el UUID: ${usuarioId}`);
      return false;
    }

    const correoAprendiz = user.email;

    // 2. Estructurar el diseño del correo electrónico con estilo tecnológico e institucional
    const mailOptions = {
      from: '"Portal de Apoyo de Sostenimiento SENA" <psicopaola.zabala@gmail.com>',
      to: correoAprendiz,
      subject: `📢 Portal SENA: ${titulo}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
          <div style="background-color: #0076A8; color: white; padding: 1.5rem; text-align: center;">
            <h2>Portal de Apoyo de Sostenimiento</h2>
          </div>
          <div style="padding: 2rem; color: #333; line-height: 1.6;">
            <p style="font-size: 1.1rem;">Estimado(a) Aprendiz,</p>
            <p>Se ha generado una nueva actualización en el estado de tu trámite dentro de la plataforma:</p>
            <blockquote style="background-color: #f9f9f9; border-left: 4px solid #0076A8; padding: 1rem; margin: 1.5rem 0; font-style: italic;">
              <strong>${titulo}</strong><br>${mensaje}
            </blockquote>
            <p>Por favor, ingresa al aplicativo para revisar los detalles del expediente o realizar las correcciones solicitadas si es necesario.</p>
            <div style="text-align: center; margin-top: 2rem;">
              <a href="https://plataforma-sostenimiento.vercel.app/" style="background-color: #23893E; color: white; padding: 0.75rem 1.5rem; text-align: center; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">Ir al Portal</a>
            </div>
          </div>
          <div style="background-color: #f4f4f4; color: #777; padding: 1rem; text-align: center; font-size: 0.8rem; border-top: 1px solid #e0e0e0;">
            Este es un correo automático. Por favor no respondas a este mensaje.<br>
            © 2026 Servicio Nacional de Aprendizaje - SENA.
          </div>
        </div>
      `
    };

    // 3. Despachar el correo electrónico
    const info = await transporter.sendMail(mailOptions);
    console.log(`✉️ [Email Service] Correo enviado con éxito a [${correoAprendiz}]:`, info.messageId);
    return true;

  } catch (error) {
    console.error("💥 [Email Service Error] Fallo al enviar el correo:", error);
    return false;
  }
}
