REVOKE EXECUTE ON FUNCTION public.storage_usage_bytes() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.storage_usage_bytes() TO service_role;