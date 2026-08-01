CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Trusted server-side (service_role) calls and admin/super_admin users may edit approval fields.
  IF current_setting('request.jwt.claims', true) IS NULL
     OR auth.uid() IS NULL
     OR public.has_role(auth.uid(), 'admin')
     OR public.is_super_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
     OR NEW.approved_at IS DISTINCT FROM OLD.approved_at THEN
    RAISE EXCEPTION 'Not allowed to modify approval fields';
  END IF;

  RETURN NEW;
END; $function$;