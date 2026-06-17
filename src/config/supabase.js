import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

// Forzamos la limpieza eliminando espacios, saltos de línea (\r, \n) o comillas accidentales
const limpiarEnv = (val) => {
  if (!val) return '';
  return val.replace(/['"\r\n]/g, '').trim();
};

const supabaseUrl = limpiarEnv(process.env.SUPABASE_URL);
const supabaseAnonKey = limpiarEnv(process.env.SUPABASE_ANON_KEY);
const supabaseServiceKey = limpiarEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);

// Verificación exacta en consola limpia de lo que se va a enviar
console.log("[Sanitización Env] URL limpia destinada a Supabase:", supabaseUrl);

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
  console.error("❌ ERROR CRÍTICO: Una o más variables esenciales no están configuradas.");
}

// Inicialización con URLs e inmunidad a strings corruptos
export const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});