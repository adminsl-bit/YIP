-- Fix orphaned assessment - update to point to existing student
UPDATE assessments 
SET student_id = '056ce462-ddf1-431a-a2b8-3a93e4cdac72'
WHERE student_id = 'dfce8c25-5f0f-494f-a209-d37d58882dde';