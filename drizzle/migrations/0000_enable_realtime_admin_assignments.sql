-- Live updates for the admin Assignments section: stream changes to
-- assignments (new submission / review / delete) and document_folders
-- (folder created at signup / removed when an account is deleted).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'assignments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.assignments;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'document_folders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.document_folders;
  END IF;
END $$;