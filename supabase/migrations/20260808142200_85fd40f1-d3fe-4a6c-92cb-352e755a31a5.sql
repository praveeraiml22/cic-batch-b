ALTER TABLE public.document_folders
  ADD COLUMN kind text NOT NULL DEFAULT 'user',
  ADD COLUMN username text;

CREATE UNIQUE INDEX idx_document_folders_assignment_owner
  ON public.document_folders(owner_id) WHERE kind = 'assignment';

DROP POLICY "Folders readable by approved members" ON public.document_folders;

CREATE POLICY "Folders readable by approved members"
ON public.document_folders FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR (
    kind = 'user'
    AND (
      auth.uid() = owner_id
      OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.status = 'active')
    )
  )
);

CREATE POLICY "Only admins create assignment folders"
ON public.document_folders AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (kind = 'user' OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uname text;
BEGIN
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

INSERT INTO public.document_folders (name, parent_id, owner_id, kind, username)
SELECT
  COALESCE(NULLIF(p.full_name, ''), NULLIF(split_part(COALESCE(p.email, ''), '@', 1), ''), p.id::text),
  NULL,
  p.id,
  'assignment',
  COALESCE(NULLIF(p.full_name, ''), NULLIF(split_part(COALESCE(p.email, ''), '@', 1), ''), p.id::text)
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.document_folders f WHERE f.owner_id = p.id AND f.kind = 'assignment'
);