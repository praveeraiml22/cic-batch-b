-- Fix: profiles SELECT should be self-only (admins can view all)
DROP POLICY IF EXISTS "Profiles readable by authenticated" ON public.profiles;

CREATE POLICY "Users read own profile"
ON public.profiles FOR SELECT TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Admins read all profiles"
ON public.profiles FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Fix: storage read on cic-files must enforce ownership (or admin)
DROP POLICY IF EXISTS "Authenticated read cic-files" ON storage.objects;

CREATE POLICY "Owners or admins read cic-files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'cic-files'
  AND (
    (auth.uid())::text = (storage.foldername(name))[1]
    OR public.has_role(auth.uid(), 'admin')
  )
);

-- Fix: revoke direct EXECUTE on SECURITY DEFINER has_role from client roles.
-- RLS policies still evaluate it correctly (postgres owner runs policy checks).
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon, authenticated;
