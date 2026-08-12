CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Config (backend only)
CREATE TABLE public.push_config (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  endpoint_url text NOT NULL,
  webhook_secret text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.push_config TO service_role;
ALTER TABLE public.push_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No client access to push config" ON public.push_config FOR SELECT TO authenticated USING (false);
CREATE TRIGGER push_config_touch BEFORE UPDATE ON public.push_config FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Logs
CREATE TABLE public.push_notification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  source_table text,
  source_id uuid,
  user_id uuid,
  is_broadcast boolean NOT NULL DEFAULT false,
  title text NOT NULL,
  body text,
  link text,
  dedupe_key text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  error text,
  response jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.push_notification_logs TO authenticated;
GRANT ALL ON public.push_notification_logs TO service_role;
ALTER TABLE public.push_notification_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read push logs" ON public.push_notification_logs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE TRIGGER push_logs_touch BEFORE UPDATE ON public.push_notification_logs FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX push_logs_user_idx ON public.push_notification_logs (user_id, created_at DESC);

-- Dispatcher
CREATE OR REPLACE FUNCTION public.enqueue_push(
  _event_type text,
  _source_table text,
  _source_id uuid,
  _user_id uuid,
  _is_broadcast boolean,
  _title text,
  _body text,
  _link text,
  _dedupe_key text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  cfg public.push_config%ROWTYPE;
  log_id uuid;
BEGIN
  INSERT INTO public.push_notification_logs
    (event_type, source_table, source_id, user_id, is_broadcast, title, body, link, dedupe_key)
  VALUES
    (_event_type, _source_table, _source_id, _user_id, COALESCE(_is_broadcast, false), _title, _body, _link, _dedupe_key)
  ON CONFLICT (dedupe_key) DO NOTHING
  RETURNING id INTO log_id;

  IF log_id IS NULL THEN
    RETURN; -- duplicate, already handled
  END IF;

  SELECT * INTO cfg FROM public.push_config WHERE id = true;
  IF cfg IS NULL OR cfg.enabled = false THEN
    UPDATE public.push_notification_logs
      SET status = 'skipped', error = 'push_config missing or disabled'
      WHERE id = log_id;
    RETURN;
  END IF;

  PERFORM extensions.net.http_post(
    url := cfg.endpoint_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-secret', cfg.webhook_secret
    ),
    body := jsonb_build_object(
      'log_id', log_id,
      'event_type', _event_type,
      'user_id', _user_id,
      'is_broadcast', COALESCE(_is_broadcast, false),
      'title', _title,
      'body', _body,
      'link', _link
    )
  );

  UPDATE public.push_notification_logs SET status = 'dispatched' WHERE id = log_id;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_push(text, text, uuid, uuid, boolean, text, text, text, text) FROM PUBLIC, anon, authenticated;

-- Assignment status / feedback trigger
CREATE OR REPLACE FUNCTION public.push_on_assignment_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status IN ('approved'::public.assignment_status, 'rejected'::public.assignment_status) THEN
    PERFORM public.enqueue_push(
      'assignment_status',
      'assignments',
      NEW.id,
      NEW.submitted_by,
      false,
      CASE WHEN NEW.status = 'approved'::public.assignment_status
           THEN 'Assignment reviewed' ELSE 'Assignment rejected' END,
      NEW.title || ' has been ' ||
        CASE WHEN NEW.status = 'approved'::public.assignment_status THEN 'reviewed and approved.' ELSE 'rejected.' END,
      '/assignments',
      'assignment_status:' || NEW.id::text || ':' || NEW.status::text
    );
  END IF;

  IF NEW.feedback IS DISTINCT FROM OLD.feedback AND COALESCE(NEW.feedback, '') <> '' THEN
    PERFORM public.enqueue_push(
      'assignment_feedback',
      'assignments',
      NEW.id,
      NEW.submitted_by,
      false,
      'New feedback on your assignment',
      left(NEW.title || ': ' || NEW.feedback, 300),
      '/assignments',
      'assignment_feedback:' || NEW.id::text || ':' || md5(NEW.feedback)
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER assignments_push_notify
AFTER UPDATE ON public.assignments
FOR EACH ROW EXECUTE FUNCTION public.push_on_assignment_change();

-- Announcement trigger
CREATE OR REPLACE FUNCTION public.push_on_announcement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.enqueue_push(
    'announcement',
    'announcements',
    NEW.id,
    NULL,
    true,
    NEW.title,
    left(COALESCE(NEW.description, 'A new announcement has been published.'), 300),
    '/notifications',
    'announcement:' || NEW.id::text
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER announcements_push_notify
AFTER INSERT ON public.announcements
FOR EACH ROW EXECUTE FUNCTION public.push_on_announcement();
