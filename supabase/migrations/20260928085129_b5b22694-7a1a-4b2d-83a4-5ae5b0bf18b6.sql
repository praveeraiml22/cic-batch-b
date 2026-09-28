CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uname text;
BEGIN
  -- Only create the account once the email has been verified.
  IF NEW.email_confirmed_at IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.profiles (id, full_name, email, student_id, status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', ''),
    NEW.email,
    NEW.raw_user_meta_data ->> 'student_id',
    'pending'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = COALESCE(EXCLUDED.email, public.profiles.email),
    full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.profiles.full_name),
    student_id = COALESCE(EXCLUDED.student_id, public.profiles.student_id),
    updated_at = now();

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'student')
  ON CONFLICT (user_id, role) DO NOTHING;

  uname := COALESCE(
    NULLIF(NEW.raw_user_meta_data ->> 'username', ''),
    NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''),
    NULLIF(split_part(COALESCE(NEW.email, ''), '@', 1), ''),
    NEW.id::text
  );

  INSERT INTO public.document_folders (name, parent_id, owner_id, kind, username)
  VALUES (uname, NULL, NEW.id, 'assignment', uname)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$function$;

-- Remove accounts that were signed up but never verified their email,
-- so they no longer appear in the admin approval list.
DELETE FROM public.document_folders f
USING auth.users u
WHERE f.owner_id = u.id AND u.email_confirmed_at IS NULL;

DELETE FROM public.user_roles r
USING auth.users u
WHERE r.user_id = u.id AND u.email_confirmed_at IS NULL;

DELETE FROM public.profiles p
USING auth.users u
WHERE p.id = u.id AND u.email_confirmed_at IS NULL;