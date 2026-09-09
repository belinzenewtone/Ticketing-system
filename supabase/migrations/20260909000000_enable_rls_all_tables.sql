-- ============================================================
-- Enable Row Level Security on all public tables
-- ============================================================
-- This app uses Next.js API routes with the Supabase service_role key
-- for all data access. The service_role key bypasses RLS automatically,
-- so no permissive policies are needed for application code.
--
-- Enabling RLS (with no anon/authenticated policies) blocks direct
-- PostgREST access via the anon/authenticated keys, protecting all
-- tables from unauthorized reads and writes that bypass our API layer.
-- ============================================================

-- Auth / NextAuth tables
ALTER TABLE "public"."User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Account" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."VerificationToken" ENABLE ROW LEVEL SECURITY;

-- Application tables
ALTER TABLE "public"."entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."tasks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."machine_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."tickets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."canned_responses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ticket_activity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."kb_articles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ticket_comments" ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- No anon/authenticated policies are added intentionally.
-- All application access goes through Next.js API routes using
-- the service_role key, which bypasses RLS.
--
-- If you ever add Supabase client-side queries in the future,
-- add explicit policies here first.
-- ============================================================

-- Inform PostgREST of schema changes
NOTIFY pgrst, 'reload schema';
