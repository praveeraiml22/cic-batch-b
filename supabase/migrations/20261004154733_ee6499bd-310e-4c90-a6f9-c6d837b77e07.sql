ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;
CREATE POLICY "Members view public assignments" ON public.assignments FOR SELECT TO authenticated USING (is_public = true);
CREATE POLICY "Members read public assignment files" ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id = 'cic-files' AND EXISTS (SELECT 1 FROM public.assignments a WHERE a.is_public = true AND a.file_url = objects.name)
);