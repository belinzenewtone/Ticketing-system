-- ============================================================
-- Enable Row Level Security on procurement / lookup tables
-- ============================================================
-- Covers the 4 tables added after the initial schema that were
-- missed by the first RLS migration.
-- service_role (used by all Next.js API routes) bypasses RLS,
-- so no policies are needed — this simply closes the PostgREST
-- anon/authenticated door.
-- ============================================================

ALTER TABLE "public"."lookup_values" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."requisition_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."requisition_stages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."requisitions" ENABLE ROW LEVEL SECURITY;

-- Inform PostgREST of schema changes
NOTIFY pgrst, 'reload schema';
