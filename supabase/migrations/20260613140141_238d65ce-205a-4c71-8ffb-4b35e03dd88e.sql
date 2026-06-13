CREATE POLICY "Authenticated read documents library"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'cic-files'
  AND EXISTS (
    SELECT 1 FROM public.documents d WHERE d.file_url = storage.objects.name
  )
);