DROP POLICY IF EXISTS "Notice files public read" ON storage.objects;
CREATE POLICY "Admins read notice files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'notices' AND public.has_role(auth.uid(), 'admin'));