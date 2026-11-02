-- Admin-created assignment topics with deadlines; student submissions link to a topic.
CREATE TABLE public.assignment_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  subject text,
  description text,
  deadline timestamptz,
  is_published boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.assignment_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid NOT NULL REFERENCES public.assignment_topics(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  file_name text NOT NULL,
  file_size bigint,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.assignment_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  file_name text NOT NULL,
  file_size bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Link existing student submissions to a topic (nullable: legacy self-created rows stay untouched).
ALTER TABLE public.assignments
  ADD COLUMN topic_id uuid REFERENCES public.assignment_topics(id) ON DELETE CASCADE;

CREATE INDEX idx_assignment_attachments_topic ON public.assignment_attachments(topic_id);
CREATE INDEX idx_assignment_files_assignment ON public.assignment_files(assignment_id);
CREATE INDEX idx_assignments_topic ON public.assignments(topic_id) WHERE topic_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assignment_topics TO authenticated;
GRANT ALL ON public.assignment_topics TO service_role;
GRANT SELECT, INSERT, DELETE ON public.assignment_attachments TO authenticated;
GRANT ALL ON public.assignment_attachments TO service_role;
GRANT SELECT, INSERT, DELETE ON public.assignment_files TO authenticated;
GRANT ALL ON public.assignment_files TO service_role;

ALTER TABLE public.assignment_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Published topics readable; admins read all"
ON public.assignment_topics FOR SELECT TO authenticated
USING (is_published OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage topics"
ON public.assignment_topics FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update topics"
ON public.assignment_topics FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete topics"
ON public.assignment_topics FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Attachments readable with their topic"
ON public.assignment_attachments FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.assignment_topics t
  WHERE t.id = topic_id AND (t.is_published OR public.has_role(auth.uid(), 'admin'::app_role))
));

CREATE POLICY "Admins add attachments"
ON public.assignment_attachments FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.assignment_topics t
  WHERE t.id = topic_id AND public.has_role(auth.uid(), 'admin'::app_role)
));

CREATE POLICY "Admins remove attachments"
ON public.assignment_attachments FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.assignment_topics t
  WHERE t.id = topic_id AND public.has_role(auth.uid(), 'admin'::app_role)
));

CREATE POLICY "Submission files readable by owner, admins, or public"
ON public.assignment_files FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.assignments a
  WHERE a.id = assignment_id
    AND (a.submitted_by = auth.uid() OR a.is_public OR public.has_role(auth.uid(), 'admin'::app_role))
));

CREATE POLICY "Students attach files to their own submission"
ON public.assignment_files FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.assignments a
  WHERE a.id = assignment_id AND a.submitted_by = auth.uid()
));

CREATE POLICY "Owners or admins remove submission files"
ON public.assignment_files FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.assignments a
  WHERE a.id = assignment_id
    AND (a.submitted_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
));

-- Live updates: deadline/publish changes reach every user instantly.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'assignment_topics'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.assignment_topics;
  END IF;
END $$;