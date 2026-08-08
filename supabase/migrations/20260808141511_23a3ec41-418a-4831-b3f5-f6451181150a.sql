CREATE TABLE public.document_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  parent_id uuid REFERENCES public.document_folders(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_folders TO authenticated;
GRANT ALL ON public.document_folders TO service_role;

ALTER TABLE public.document_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Folders readable by approved members"
ON public.document_folders FOR SELECT TO authenticated
USING (
  auth.uid() = owner_id
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.status = 'active')
);

CREATE POLICY "Users create own folders"
ON public.document_folders FOR INSERT TO authenticated
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners or admins update folders"
ON public.document_folders FOR UPDATE TO authenticated
USING (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owners or admins delete folders"
ON public.document_folders FOR DELETE TO authenticated
USING (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER document_folders_touch_updated_at
BEFORE UPDATE ON public.document_folders
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_document_folders_parent ON public.document_folders(parent_id);

ALTER TABLE public.documents
  ADD COLUMN folder_id uuid NOT NULL REFERENCES public.document_folders(id) ON DELETE CASCADE;

CREATE INDEX idx_documents_folder ON public.documents(folder_id);