
-- 2) Profile fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS roll_number text;

-- 3) Re-enable profile editing by the owner (keep id/email immutable via column GRANTS)
GRANT UPDATE (full_name, department, semester, mobile, avatar_url, bio, address, roll_number, updated_at)
  ON public.profiles TO authenticated;

DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Admins update any profile" ON public.profiles;
CREATE POLICY "Admins update any profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 4) Lock assignments after review for students
DROP POLICY IF EXISTS "Students update own assignments" ON public.assignments;
CREATE POLICY "Students update own assignments" ON public.assignments
  FOR UPDATE TO authenticated
  USING (
    (auth.uid() = submitted_by AND status = 'submitted')
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    (auth.uid() = submitted_by AND status = 'submitted')
    OR public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "Students delete own assignments" ON public.assignments;
CREATE POLICY "Students delete own assignments" ON public.assignments
  FOR DELETE TO authenticated
  USING (
    (auth.uid() = submitted_by AND status = 'submitted')
    OR public.has_role(auth.uid(), 'admin')
  );

-- 5) auth_logs table
CREATE TABLE IF NOT EXISTS public.auth_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  action text NOT NULL,
  user_email text,
  error_message text
);

GRANT INSERT ON public.auth_logs TO anon, authenticated;
GRANT SELECT, DELETE ON public.auth_logs TO authenticated;
GRANT ALL ON public.auth_logs TO service_role;

ALTER TABLE public.auth_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can log auth events" ON public.auth_logs;
CREATE POLICY "Anyone can log auth events" ON public.auth_logs
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins read auth logs" ON public.auth_logs;
CREATE POLICY "Admins read auth logs" ON public.auth_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins delete auth logs" ON public.auth_logs;
CREATE POLICY "Admins delete auth logs" ON public.auth_logs
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
