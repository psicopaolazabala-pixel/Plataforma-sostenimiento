-- =========================================================================
-- 1. TIPOS ENUMERADOS (ENUMS)
-- =========================================================================
CREATE TYPE tipo_rol AS ENUM ('APRENDIZ', 'ADMINISTRADOR');

CREATE TYPE estado_solicitud AS ENUM (
    'BORRADOR', 
    'DOCUMENTOS_CARGADOS', 
    'PENDIENTE_REVISION', 
    'REQUIERE_CORRECCION', 
    'APROBADA', 
    'RECHAZADA'
);

CREATE TYPE estado_documento AS ENUM (
    'PENDIENTE', 
    'EN_REVISION', 
    'APROBADO', 
    'CORREGIR'
);

-- =========================================================================
-- 2. TABLAS PRINCIPALES
-- =========================================================================

-- Perfiles de usuario (Extensión de auth.users de Supabase)
CREATE TABLE perfiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    nombre_completo VARCHAR(255) NOT NULL,
    documento_identidad VARCHAR(50) UNIQUE NOT NULL,
    celular VARCHAR(20),
    ficha_caracterizacion VARCHAR(50),
    programa_formacion VARCHAR(150),
    rol tipo_rol DEFAULT 'APRENDIZ' NOT NULL,
    creado_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Solicitudes de Apoyo de Sostenimiento
CREATE TABLE solicitudes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    aprendiz_id UUID REFERENCES perfiles(id) ON DELETE CASCADE UNIQUE NOT NULL,
    estado estado_solicitud DEFAULT 'BORRADOR' NOT NULL,
    observaciones_generales TEXT,
    actualizado_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    creado_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Documentos probatorios asociados a la solicitud
CREATE TABLE documentos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    solicitud_id UUID REFERENCES solicitudes(id) ON DELETE CASCADE NOT NULL,
    nombre_tipo VARCHAR(100) NOT NULL, -- Ej: 'Cedula', 'Sisben', 'Certificado Ficha'
    storage_path TEXT NOT NULL,         -- Ruta dentro del bucket privado
    estado estado_documento DEFAULT 'PENDIENTE' NOT NULL,
    observacion_especifica TEXT,
    actualizado_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Sistema Interno de Notificaciones
CREATE TABLE notificaciones (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    usuario_id UUID REFERENCES perfiles(id) ON DELETE CASCADE NOT NULL,
    titulo VARCHAR(150) NOT NULL,
    mensaje TEXT NOT NULL,
    leido BOOLEAN DEFAULT FALSE NOT NULL,
    creado_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Historial de Cambios de Estado (Auditoría)
CREATE TABLE historial_estados (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    solicitud_id UUID REFERENCES solicitudes(id) ON DELETE CASCADE NOT NULL,
    estado_anterior estado_solicitud,
    estado_nuevo estado_solicitud NOT NULL,
    responsable_id UUID REFERENCES perfiles(id),
    motivo TEXT,
    creado_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- =========================================================================
-- 3. TRRIGERS PARA HISTORIAL Y CONFIGURACIONES AUTOMÁTICAS
-- =========================================================================

-- Trigger para registrar cambios de estado en las solicitudes
CREATE OR REPLACE FUNCTION registrar_historial_solicitud()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'UPDATE' AND OLD.estado IS DISTINCT FROM NEW.estado) THEN
        INSERT INTO historial_estados (solicitud_id, estado_anterior, estado_nuevo, responsable_id, motivo)
        VALUES (NEW.id, OLD.estado, NEW.estado, auth.uid(), NEW.observaciones_generales);
    ELSIF (TG_OP = 'INSERT') THEN
        INSERT INTO historial_estados (solicitud_id, estado_anterior, estado_nuevo, responsable_id, motivo)
        VALUES (NEW.id, NULL, NEW.estado, NEW.aprendiz_id, 'Creación inicial de la solicitud.');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_historial_solicitud
AFTER INSERT OR UPDATE ON solicitudes
FOR EACH ROW EXECUTE FUNCTION registrar_historial_solicitud();

-- =========================================================================
-- 4. POLÍTICAS DE SEGURIDAD A NIVEL DE FILA (RLS)
-- =========================================================================

ALTER TABLE perfiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE solicitudes ENABLE ROW LEVEL SECURITY;
ALTER TABLE documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE registros_notificaciones ENABLE ROW LEVEL SECURITY; -- Refiriéndose a notificaciones
ALTER TABLE notificaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE historial_estados ENABLE ROW LEVEL SECURITY;

-- Políticas para Perfiles
CREATE POLICY "Usuarios pueden ver su propio perfil" 
ON perfiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Administradores pueden ver todos los perfiles" 
ON perfiles FOR SELECT USING (
    EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'ADMINISTRADOR')
);

CREATE POLICY "Permitir inserción de perfil propio" 
ON perfiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Políticas para Solicitudes
CREATE POLICY "Aprendiz ve su propia solicitud" 
ON solicitudes FOR SELECT USING (auth.uid() = aprendiz_id);

CREATE POLICY "Aprendiz modifica su propia solicitud en estados iniciales" 
ON solicitudes FOR UPDATE USING (auth.uid() = aprendiz_id)
WITH CHECK (estado IN ('BORRADOR', 'DOCUMENTOS_CARGADOS', 'REQUIERE_CORRECCION'));

CREATE POLICY "Admin ve y modifica todas las solicitudes" 
ON solicitudes FOR ALL USING (
    EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'ADMINISTRADOR')
);

-- Políticas para Documentos
CREATE POLICY "Aprendiz maneja sus propios documentos" 
ON documentos FOR ALL USING (
    EXISTS (SELECT 1 FROM solicitudes WHERE solicitudes.id = documentos.solicitud_id AND solicitudes.aprendiz_id = auth.uid())
);

CREATE POLICY "Admin ve y actualiza documentos" 
ON documentos FOR ALL USING (
    EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'ADMINISTRADOR')
);

-- Políticas para Notificaciones
CREATE POLICY "Usuarios manejan sus notificaciones"
ON notificaciones FOR ALL USING (auth.uid() = usuario_id);

-- Asegurar que solo el dueño del documento o el administrador puedan leer del bucket
CREATE POLICY "Acceso restringido a documentos de soporte"
ON storage.objects FOR SELECT USING (
    bucket_id = 'documentos-sostenimiento' AND (
        auth.uid()::text = (storage.foldername(name))[1] OR 
        EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND rol = 'ADMINISTRADOR')
    )
);