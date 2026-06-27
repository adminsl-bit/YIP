-- Add 'impeachment_motion' to the motion_type ENUM.
-- The TypeScript union was updated earlier but the DB ENUM was missed,
-- causing inserts to fail with an invalid enum value error.

ALTER TYPE motion_type ADD VALUE IF NOT EXISTS 'impeachment_motion';
