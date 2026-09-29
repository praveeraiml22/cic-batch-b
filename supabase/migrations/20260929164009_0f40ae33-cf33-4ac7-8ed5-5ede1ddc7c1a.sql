CREATE TABLE public.achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  student_name text,
  achieved_on date,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.achievements TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.achievements TO authenticated;
GRANT ALL ON public.achievements TO service_role;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Achievements public read" ON public.achievements FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage achievements" ON public.achievements FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER achievements_touch BEFORE UPDATE ON public.achievements FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text,
  category text NOT NULL DEFAULT 'general',
  file_path text,
  file_name text,
  file_size bigint,
  notice_date date NOT NULL DEFAULT current_date,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.notices TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notices TO authenticated;
GRANT ALL ON public.notices TO service_role;
ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Notices public read" ON public.notices FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage notices" ON public.notices FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER notices_touch BEFORE UPDATE ON public.notices FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE POLICY "Notice files public read" ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'notices');
CREATE POLICY "Admins upload notice files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'notices' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update notice files" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'notices' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete notice files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'notices' AND public.has_role(auth.uid(), 'admin'));