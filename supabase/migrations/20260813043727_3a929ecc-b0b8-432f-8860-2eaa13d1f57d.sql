DROP POLICY IF EXISTS "Authenticated read documents library" ON storage.objects;

CREATE POLICY "Approved members read documents library"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'cic-files'
  AND EXISTS (
    SELECT 1 FROM public.documents d
    WHERE d.file_url = storage.objects.name
      AND (
        d.uploaded_by = auth.uid()
        OR public.has_role(auth.uid(), 'admin'::public.app_role)
        OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.status = 'active'
        )
      )
  )
);

CREATE POLICY "Users update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);