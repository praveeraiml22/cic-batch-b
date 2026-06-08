
-- Storage policies for cic-files bucket
CREATE POLICY "Authenticated read cic-files" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'cic-files');

CREATE POLICY "Authenticated upload cic-files" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'cic-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Owners delete cic-files" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'cic-files' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(), 'admin')));

CREATE POLICY "Owners update cic-files" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'cic-files' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(), 'admin')));
