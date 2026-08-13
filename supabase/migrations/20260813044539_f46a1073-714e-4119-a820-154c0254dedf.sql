
ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS notification_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS notification_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS onesignal_notification_id text,
  ADD COLUMN IF NOT EXISTS notification_error text,
  ADD COLUMN IF NOT EXISTS notification_attempts integer NOT NULL DEFAULT 0;

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS push_enabled boolean NOT NULL DEFAULT true;

-- Only broadcast notices push; "public notice board only" stays silent.
CREATE OR REPLACE FUNCTION public.push_on_announcement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT COALESCE(NEW.is_broadcast, false) THEN
    UPDATE public.announcements SET notification_status = 'skipped' WHERE id = NEW.id;
    RETURN NEW;
  END IF;

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
$function$;

-- Personal notices to selected members get their own targeted push.
CREATE OR REPLACE FUNCTION public.push_on_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT COALESCE(NEW.push_enabled, true) THEN
    RETURN NEW;
  END IF;

  PERFORM public.enqueue_push(
    'notice',
    'notifications',
    NEW.id,
    NEW.user_id,
    false,
    NEW.title,
    left(COALESCE(NEW.message, 'You have a new notice.'), 300),
    COALESCE(NEW.link, '/notifications'),
    'notification:' || NEW.id::text
  );
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.push_on_notification() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS notifications_push_notify ON public.notifications;
CREATE TRIGGER notifications_push_notify
AFTER INSERT ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.push_on_notification();

-- Atomic claim helper: only one invocation may deliver a given log row.
CREATE OR REPLACE FUNCTION public.claim_push_log(_log_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  claimed uuid;
BEGIN
  UPDATE public.push_notification_logs
     SET status = 'processing', updated_at = now()
   WHERE id = _log_id
     AND status NOT IN ('sent', 'processing')
  RETURNING id INTO claimed;

  RETURN claimed IS NOT NULL;
END;
$function$;

REVOKE ALL ON FUNCTION public.claim_push_log(uuid) FROM PUBLIC, anon, authenticated;

-- Mirror delivery outcome back onto the source notice row.
CREATE OR REPLACE FUNCTION public.sync_push_result(
  _source_table text,
  _source_id uuid,
  _status text,
  _onesignal_id text,
  _error text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF _source_table = 'announcements' AND _source_id IS NOT NULL THEN
    UPDATE public.announcements
       SET notification_status = _status,
           onesignal_notification_id = COALESCE(_onesignal_id, onesignal_notification_id),
           notification_error = _error,
           notification_attempts = notification_attempts + 1,
           notification_sent_at = CASE WHEN _status = 'sent' THEN now() ELSE notification_sent_at END
     WHERE id = _source_id;
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.sync_push_result(text, uuid, text, text, text) FROM PUBLIC, anon, authenticated;
