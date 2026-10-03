CREATE OR REPLACE FUNCTION public.push_on_assignment_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  reviewer text := public.uploader_name(COALESCE(NEW.reviewed_by, auth.uid()));
  student text := public.uploader_name(NEW.submitted_by);
  action text;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status <> 'submitted'::public.assignment_status THEN
    action := CASE NEW.status
      WHEN 'approved' THEN 'approved'
      WHEN 'rejected' THEN 'rejected'
      WHEN 'under_review' THEN 'started reviewing'
      WHEN 'resubmission_required' THEN 'requested resubmission of'
      ELSE 'updated' END;
    PERFORM public.enqueue_push('assignment_status','assignments',NEW.id,NULL,true,
      reviewer || ' ' || action || ' ' || student || '''s assignment ''' || NEW.title || '''.',
      NEW.subject, '/assignments',
      'assignment_status:' || NEW.id::text || ':' || NEW.status::text || ':' || extract(epoch from now())::bigint::text);
  END IF;

  IF NEW.grade IS DISTINCT FROM OLD.grade AND COALESCE(NEW.grade,'') <> '' THEN
    PERFORM public.enqueue_push('assignment_grade','assignments',NEW.id,NULL,true,
      reviewer || ' graded ' || student || '''s assignment ''' || NEW.title || '''.',
      'Grade: ' || NEW.grade, '/assignments',
      'assignment_grade:' || NEW.id::text || ':' || md5(NEW.grade));
  END IF;

  IF NEW.feedback IS DISTINCT FROM OLD.feedback AND COALESCE(NEW.feedback,'') <> '' THEN
    PERFORM public.enqueue_push('assignment_feedback','assignments',NEW.id,NULL,true,
      reviewer || ' gave feedback on ' || student || '''s assignment ''' || NEW.title || '''.',
      left(NEW.feedback, 300), '/assignments',
      'assignment_feedback:' || NEW.id::text || ':' || md5(NEW.feedback));
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.push_on_assignment_change() FROM PUBLIC, anon, authenticated;