-- Adicionar campo para controle de notificações WhatsApp no perfil do usuário
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS whatsapp_notifications_enabled BOOLEAN DEFAULT true;

COMMENT ON COLUMN public.profiles.whatsapp_notifications_enabled IS 'Controla se o usuário deseja receber notificações via WhatsApp';