CREATE OR REPLACE FUNCTION public.uploader_name(_uid uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT NULLIF(trim(full_name),'') FROM public.profiles WHERE id = _uid), 'CIC Admin')
$$;

CREATE OR REPLACE FUNCTION public.push_on_achievement() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.enqueue_push('achievement','achievements',NEW.id,NULL,true,
    public.uploader_name(NEW.created_by) || ' uploaded achievement, ''' || NEW.title || '''.',
    left(concat_ws(' — ', NULLIF(NEW.student_name,''), NULLIF(NEW.description,'')), 1500),
    '/', 'achievement:' || NEW.id::text);
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.push_on_home_notice() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.enqueue_push('home_notice','notices',NEW.id,NULL,true,
    public.uploader_name(NEW.created_by) || ' uploaded notice for everyone, ''' || NEW.title || '''.',
    CASE WHEN NEW.file_name IS NOT NULL THEN 'PDF: ' || NEW.file_name
         ELSE left(COALESCE(NEW.body,'A new notice has been posted.'), 300) END,
    '/', 'home_notice:' || NEW.id::text);
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.push_on_announcement() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT COALESCE(NEW.is_broadcast, false) THEN
    UPDATE public.announcements SET notification_status = 'skipped' WHERE id = NEW.id;
    RETURN NEW;
  END IF;
  PERFORM public.enqueue_push('announcement','announcements',NEW.id,NULL,true,
    'Attention!! Important announcement to all.',
    left(NEW.title || COALESCE(' — ' || NEW.description, ''), 300),
    '/notifications', 'announcement:' || NEW.id::text);
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.push_on_document() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.enqueue_push('document','documents',NEW.id,NULL,true,
    public.uploader_name(NEW.uploaded_by) || ' uploaded ''' || NEW.title || '''.',
    NEW.file_name, '/documents', 'document:' || NEW.id::text);
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.push_on_event() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.enqueue_push('event','events',NEW.id,NULL,true,
    public.uploader_name(NEW.created_by) || ' uploaded event, ''' || NEW.title || '''.',
    left(COALESCE(NEW.description,'A new event has been posted.'),300),
    '/', 'event:' || NEW.id::text);
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.push_on_resume() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.file_path IS NOT DISTINCT FROM OLD.file_path THEN RETURN NEW; END IF;
  PERFORM public.enqueue_push('resume','resumes',NEW.id,NULL,true,
    public.uploader_name(NEW.user_id) || ' uploaded resume ''' || NEW.file_name || '''.',
    NULL, '/', 'resume:' || NEW.id::text || ':' || md5(NEW.file_path));
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.push_on_assignment_upload() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.enqueue_push('assignment_upload','assignments',NEW.id,NULL,true,
    public.uploader_name(NEW.submitted_by) || ' uploaded assignment ''' || NEW.title || '''.',
    NEW.subject, '/', 'assignment_upload:' || NEW.id::text);
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS documents_push_upload ON public.documents;
CREATE TRIGGER documents_push_upload AFTER INSERT ON public.documents FOR EACH ROW EXECUTE FUNCTION public.push_on_document();
DROP TRIGGER IF EXISTS events_push_upload ON public.events;
CREATE TRIGGER events_push_upload AFTER INSERT ON public.events FOR EACH ROW EXECUTE FUNCTION public.push_on_event();
DROP TRIGGER IF EXISTS resumes_push_upload ON public.resumes;
CREATE TRIGGER resumes_push_upload AFTER INSERT OR UPDATE ON public.resumes FOR EACH ROW EXECUTE FUNCTION public.push_on_resume();
DROP TRIGGER IF EXISTS assignments_push_upload ON public.assignments;
CREATE TRIGGER assignments_push_upload AFTER INSERT ON public.assignments FOR EACH ROW EXECUTE FUNCTION public.push_on_assignment_upload();

REVOKE ALL ON FUNCTION public.uploader_name(uuid), public.push_on_document(), public.push_on_event(), public.push_on_resume(), public.push_on_assignment_upload(), public.push_on_achievement(), public.push_on_home_notice(), public.push_on_announcement() FROM PUBLIC, anon, authenticated;