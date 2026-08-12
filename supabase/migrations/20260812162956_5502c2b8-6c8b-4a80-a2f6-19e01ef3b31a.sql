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
SET search_path = public, net, extensions
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
    RETURN;
  END IF;

  SELECT * INTO cfg FROM public.push_config WHERE id = true;
  IF cfg IS NULL OR cfg.enabled = false THEN
    UPDATE public.push_notification_logs
      SET status = 'skipped', error = 'push_config missing or disabled'
      WHERE id = log_id;
    RETURN;
  END IF;

  PERFORM net.http_post(
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