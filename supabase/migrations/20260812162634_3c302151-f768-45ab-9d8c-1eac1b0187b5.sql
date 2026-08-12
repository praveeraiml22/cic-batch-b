REVOKE ALL ON FUNCTION public.push_on_assignment_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.push_on_announcement() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enqueue_push(text, text, uuid, uuid, boolean, text, text, text, text) FROM PUBLIC, anon, authenticated;