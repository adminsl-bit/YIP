-- Jury accounts created by the organizer before the create-role-users
-- function started tagging event_id never got linked to an event, so they
-- were invisible in the Super Admin "Roles" menu (which filters by event).
-- Backfill them onto the active Yi Madurai event and add the matching
-- event_participants rows.
UPDATE public.profiles
SET event_id = '57edea74-bf80-4a21-910f-f3ea971f06ec'
WHERE user_type = 'jury'
  AND event_id IS NULL;

INSERT INTO public.event_participants (event_id, user_id, is_current)
SELECT '57edea74-bf80-4a21-910f-f3ea971f06ec', user_id, true
FROM public.profiles
WHERE user_type = 'jury'
  AND user_id IN ('470b0407-be9f-4f2a-8422-228501c3705b', '8613313e-c238-4cb0-8885-ef3f1b79d1d1')
ON CONFLICT (event_id, user_id) DO UPDATE SET is_current = true;
