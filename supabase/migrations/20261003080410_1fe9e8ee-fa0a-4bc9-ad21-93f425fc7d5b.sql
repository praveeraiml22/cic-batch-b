CREATE OR REPLACE FUNCTION public.storage_usage_bytes()
RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, storage AS $$
  SELECT COALESCE(sum((metadata->>'size')::bigint), 0)::bigint FROM storage.objects WHERE bucket_id IN ('cic-files','notices');
$$;
REVOKE ALL ON FUNCTION public.storage_usage_bytes() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.storage_usage_bytes() TO authenticated;