-- 1) Scope document reads
DROP POLICY IF EXISTS "Documents readable by authenticated" ON public.documents;

CREATE POLICY "Documents readable by approved members"
ON public.documents
FOR SELECT
TO authenticated
USING (
  auth.uid() = uploaded_by
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.status = 'active'
  )
);

-- 2) Lock down SECURITY DEFINER functions exposed via the API
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prevent_profile_privilege_escalation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_super_admin_profile() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_super_admin_role() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_role_change(uuid, uuid, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC, anon, authenticated;

-- has_role is required by RLS policies evaluated as the signed-in user
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;