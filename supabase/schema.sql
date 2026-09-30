-- ========================================================
-- Schema para Web Push Notifications en Supabase ($0 Coste)
-- ========================================================

-- 1. Tabla para almacenar las suscripciones push de los dispositivos (iPhones, Android, etc.)
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- Opcional: si tienes autenticación en Supabase
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    device_type TEXT DEFAULT 'Desconocido',
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Índices para búsqueda rápida
CREATE INDEX IF NOT EXISTS idx_push_subs_user_id ON public.push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subs_endpoint ON public.push_subscriptions(endpoint);

-- 3. Habilitar Row Level Security (RLS)
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Política: Permitir a usuarios autenticados gestionar sus propias suscripciones
CREATE POLICY "Los usuarios pueden insertar sus suscripciones"
ON public.push_subscriptions
FOR INSERT
TO authenticated, anon
WITH CHECK (true);

CREATE POLICY "Los usuarios pueden ver sus suscripciones"
ON public.push_subscriptions
FOR SELECT
TO authenticated, anon
USING (true);

CREATE POLICY "Los usuarios pueden eliminar sus suscripciones"
ON public.push_subscriptions
FOR DELETE
TO authenticated, anon
USING (true);

-- 4. Trigger para actualizar automáticamente 'updated_at'
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_push_subs_modtime
    BEFORE UPDATE ON public.push_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
