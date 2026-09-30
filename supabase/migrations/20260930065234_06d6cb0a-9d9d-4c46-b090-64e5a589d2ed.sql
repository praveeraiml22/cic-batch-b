CREATE OR REPLACE FUNCTION public.push_on_achievement()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  PERFORM public.enqueue_push('achievement','achievements',NEW.id,NULL,true,
    'New CIC Achievement: ' || NEW.title,
    left(concat_ws(' — ', NULLIF(NEW.student_name,''), NULLIF(NEW.description,'')), 1500),
    '/', 'achievement:' || NEW.id::text);
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.push_on_home_notice()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  PERFORM public.enqueue_push('home_notice','notices',NEW.id,NULL,true,
    'New Notice: ' || NEW.title,
    CASE WHEN NEW.file_name IS NOT NULL THEN 'PDF: ' || NEW.file_name
         ELSE left(COALESCE(NEW.body,'A new notice has been posted.'), 300) END,
    '/', 'home_notice:' || NEW.id::text);
  RETURN NEW;
END; $$;

REVOKE ALL ON FUNCTION public.push_on_achievement() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.push_on_home_notice() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER achievements_push_notify AFTER INSERT ON public.achievements
FOR EACH ROW EXECUTE FUNCTION public.push_on_achievement();
CREATE TRIGGER notices_push_notify AFTER INSERT ON public.notices
FOR EACH ROW EXECUTE FUNCTION public.push_on_home_notice();