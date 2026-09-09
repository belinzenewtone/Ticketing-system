-- ============================================================
-- Add missing indexes on foreign key columns
-- ============================================================
-- Unindexed FKs cause full table scans on every JOIN and
-- ON DELETE CASCADE. These indexes fix the 15 warnings from
-- the Supabase security/performance advisor.
-- ============================================================

-- Account
CREATE INDEX IF NOT EXISTS idx_account_user_id ON "public"."Account" ("userId");

-- Session
CREATE INDEX IF NOT EXISTS idx_session_user_id ON "public"."Session" ("userId");

-- canned_responses
CREATE INDEX IF NOT EXISTS idx_canned_responses_created_by ON "public"."canned_responses" ("created_by");

-- entries
CREATE INDEX IF NOT EXISTS idx_entries_created_by ON "public"."entries" ("created_by");

-- kb_articles
CREATE INDEX IF NOT EXISTS idx_kb_articles_created_by ON "public"."kb_articles" ("created_by");

-- machine_requests
CREATE INDEX IF NOT EXISTS idx_machine_requests_created_by ON "public"."machine_requests" ("created_by");

-- tasks
CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON "public"."tasks" ("created_by");

-- ticket_activity
CREATE INDEX IF NOT EXISTS idx_ticket_activity_ticket_id ON "public"."ticket_activity" ("ticket_id");
CREATE INDEX IF NOT EXISTS idx_ticket_activity_user_id ON "public"."ticket_activity" ("user_id");

-- ticket_comments
CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket_id ON "public"."ticket_comments" ("ticket_id");
CREATE INDEX IF NOT EXISTS idx_ticket_comments_machine_id ON "public"."ticket_comments" ("machine_id");
CREATE INDEX IF NOT EXISTS idx_ticket_comments_user_id ON "public"."ticket_comments" ("user_id");

-- tickets
CREATE INDEX IF NOT EXISTS idx_tickets_created_by ON "public"."tickets" ("created_by");
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to ON "public"."tickets" ("assigned_to");
CREATE INDEX IF NOT EXISTS idx_tickets_merged_into ON "public"."tickets" ("merged_into");

-- Inform PostgREST of schema changes
NOTIFY pgrst, 'reload schema';
