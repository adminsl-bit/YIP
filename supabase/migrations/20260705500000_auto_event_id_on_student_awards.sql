-- Trigger: automatically set event_id on student_awards from the student's profile.
-- Needed because super_admin has event_id=null, so profile?.event_id is null
-- when they assign awards — this trigger fills it in from the student side.

CREATE OR REPLACE FUNCTION public.set_student_award_event_id()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.event_id IS NULL THEN
    SELECT event_id INTO NEW.event_id
    FROM profiles WHERE user_id = NEW.student_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_student_award_event_id ON public.student_awards;
CREATE TRIGGER trg_student_award_event_id
  BEFORE INSERT OR UPDATE ON public.student_awards
  FOR EACH ROW EXECUTE FUNCTION public.set_student_award_event_id();
