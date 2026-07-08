
-- 1) Add new enum value (must be visible in later transactions to be used as literal).
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';

-- 2) Audit log for role changes and blocked super-admin attempts.
CREATE TABLE IF NOT EXISTS public.role_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  target_user_id uuid,
  action text NOT NULL,
  old_role text,
  new_role text,
  status text NOT NULL DEFAULT 'success',
  reason text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.role_audit_logs TO authenticated;
GRANT ALL ON public.role_audit_logs TO service_role;

ALTER TABLE public.role_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view role audit logs" ON public.role_audit_logs;
CREATE POLICY "Admins can view role audit logs"
  ON public.role_audit_logs
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- No INSERT/UPDATE/DELETE policies: only service_role can write (via server functions / triggers).

-- 3) Super admin helpers (text-compare avoids referencing the new enum literal in the same tx).
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role::text = 'super_admin'
  )
$$;

-- Super admin implicitly satisfies has_role(_, 'admin') so all existing admin gates work.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND (
        role = _role
        OR (_role = 'admin'::public.app_role AND role::text = 'super_admin')
      )
  )
$$;

-- 4) Guard trigger on user_roles: block any change touching super_admin rows unless
-- the current transaction explicitly opts in via SET LOCAL app.allow_super_admin_change='on'.
CREATE OR REPLACE FUNCTION public.protect_super_admin_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  allow text := current_setting('app.allow_super_admin_change', true);
  involves_super boolean := false;
BEGIN
  IF TG_OP = 'INSERT' THEN
    involves_super := NEW.role::text = 'super_admin';
  ELSIF TG_OP = 'UPDATE' THEN
    involves_super := OLD.role::text = 'super_admin' OR NEW.role::text = 'super_admin';
  ELSIF TG_OP = 'DELETE' THEN
    involves_super := OLD.role::text = 'super_admin';
  END IF;

  IF involves_super AND (allow IS DISTINCT FROM 'on') THEN
    INSERT INTO public.role_audit_logs (actor_id, target_user_id, action, old_role, new_role, status, reason)
    VALUES (
      auth.uid(),
      COALESCE(
        CASE WHEN TG_OP = 'DELETE' THEN OLD.user_id ELSE NEW.user_id END,
        NULL
      ),
      'user_roles.' || lower(TG_OP),
      CASE WHEN TG_OP <> 'INSERT' THEN OLD.role::text END,
      CASE WHEN TG_OP <> 'DELETE' THEN NEW.role::text END,
      'blocked',
      'This account is the Permanent Super Admin and cannot be modified.'
    );
    RAISE EXCEPTION 'This account is the Permanent Super Admin and cannot be modified.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_super_admin_role ON public.user_roles;
CREATE TRIGGER trg_protect_super_admin_role
BEFORE INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.protect_super_admin_role();

-- 5) Guard trigger on profiles: prevent status changes or deletion of a super admin.
CREATE OR REPLACE FUNCTION public.protect_super_admin_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  allow text := current_setting('app.allow_super_admin_change', true);
  target uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END;
BEGIN
  IF NOT public.is_super_admin(target) THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  IF allow = 'on' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.role_audit_logs (actor_id, target_user_id, action, status, reason)
    VALUES (auth.uid(), OLD.id, 'profiles.delete', 'blocked',
            'This account is the Permanent Super Admin and cannot be modified.');
    RAISE EXCEPTION 'This account is the Permanent Super Admin and cannot be modified.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- UPDATE path: only certain fields are locked; regular profile edits (name/avatar/etc.) still allowed.
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.role_audit_logs (actor_id, target_user_id, action, status, reason, metadata)
    VALUES (auth.uid(), OLD.id, 'profiles.status_change', 'blocked',
            'This account is the Permanent Super Admin and cannot be modified.',
            jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status));
    RAISE EXCEPTION 'This account is the Permanent Super Admin and cannot be modified.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_super_admin_profile ON public.profiles;
CREATE TRIGGER trg_protect_super_admin_profile
BEFORE UPDATE OR DELETE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_super_admin_profile();

-- 6) Helper for server functions to record successful role changes.
CREATE OR REPLACE FUNCTION public.log_role_change(
  _actor uuid,
  _target uuid,
  _old text,
  _new text,
  _action text
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.role_audit_logs (actor_id, target_user_id, action, old_role, new_role, status)
  VALUES (_actor, _target, _action, _old, _new, 'success');
$$;
