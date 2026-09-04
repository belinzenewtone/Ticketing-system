-- Add unread_by column to tickets table to track comment reads
ALTER TABLE "public"."tickets" ADD COLUMN IF NOT EXISTS "unread_by" TEXT DEFAULT 'none';

-- Create an enum or check constraint to ensure only valid values are used
-- 'none' = All read
-- 'admin' = Employee responded, IT admin hasn't read it
-- 'employee' = IT admin responded, employee hasn't read it

ALTER TABLE "public"."tickets" DROP CONSTRAINT IF EXISTS "unread_by_check";
ALTER TABLE "public"."tickets" ADD CONSTRAINT "unread_by_check" 
    CHECK (unread_by IN ('none', 'admin', 'employee'));

-- Inform PostgREST of schema changes
NOTIFY pgrst, 'reload schema';
