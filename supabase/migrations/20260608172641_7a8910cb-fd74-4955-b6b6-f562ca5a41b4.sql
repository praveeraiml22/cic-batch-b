
-- Fix search_path warnings on functions
ALTER FUNCTION public.touch_updated_at() SET search_path = public;

-- Restrict EXECUTE on SECURITY DEFINER functions (these are only called internally)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
-- has_role needs to be callable inside RLS policies for authenticated users, so keep that grant
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
