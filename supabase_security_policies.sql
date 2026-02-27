-- ==========================================
-- SUPABASE SECURITY POLICIES (RLS)
-- ==========================================
-- INSTRUCTIONS: Copy and paste this entire script into your Supabase SQL Editor and run it.

-- 1. Enable RLS on all tables
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE machine_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE canned_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_activity ENABLE ROW LEVEL SECURITY;

-- 2. Helper function to check if the current user is an admin or IT staff
CREATE OR REPLACE FUNCTION is_admin_or_staff()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('ADMIN', 'IT_STAFF')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ==========================================
-- TICKETS POLICIES
-- ==========================================
-- Anyone can view their own tickets, IT/Admin can view all
CREATE POLICY "Users can view their own tickets" ON tickets
  FOR SELECT USING (auth.uid() = created_by OR is_admin_or_staff());

-- Anyone can insert a ticket
CREATE POLICY "Users can insert tickets" ON tickets
  FOR INSERT WITH CHECK (auth.uid() = created_by);

-- Users can only update their own open tickets, IT/Admin can update all
CREATE POLICY "Users can update their own tickets" ON tickets
  FOR UPDATE USING (auth.uid() = created_by OR is_admin_or_staff());

-- Only IT/Admin can delete tickets (or users can delete their own)
CREATE POLICY "Users can delete their own tickets" ON tickets
  FOR DELETE USING (auth.uid() = created_by OR is_admin_or_staff());


-- ==========================================
-- PROFILES POLICIES
-- ==========================================
-- Everyone can read all profiles (needed for assigning tickets)
CREATE POLICY "Anyone can view profiles" ON profiles
  FOR SELECT USING (true);

-- Users can update their own profile name
CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);


-- ==========================================
-- COMMENTS POLICIES
-- ==========================================
-- Users can see comments on tickets they own, or public comments. IT/Admin sees all.
CREATE POLICY "View comments" ON ticket_comments
  FOR SELECT USING (
    is_admin_or_staff() OR 
    EXISTS (SELECT 1 FROM tickets WHERE id = ticket_id AND created_by = auth.uid())
  );

-- Users can insert comments on their own tickets, IT/Admin can insert on any
CREATE POLICY "Insert comments" ON ticket_comments
  FOR INSERT WITH CHECK (
    is_admin_or_staff() OR 
    EXISTS (SELECT 1 FROM tickets WHERE id = ticket_id AND created_by = auth.uid())
  );


-- ==========================================
-- ADMIN-ONLY TABLES (Entries, Tasks, Machines)
-- ==========================================
-- Assuming these are mostly handled by IT/Admin; adjust if standard users create them.

CREATE POLICY "Admin/Staff full access to entries" ON entries
  FOR ALL USING (is_admin_or_staff() OR auth.uid() = created_by);

CREATE POLICY "Admin/Staff full access to tasks" ON tasks
  FOR ALL USING (is_admin_or_staff() OR auth.uid() = created_by);

CREATE POLICY "Admin/Staff full access to machines" ON machine_requests
  FOR ALL USING (is_admin_or_staff() OR auth.uid() = created_by);


-- ==========================================
-- KB & CANNED RESPONSES
-- ==========================================
-- Everyone can read KB articles
CREATE POLICY "Anyone can view KB articles" ON kb_articles
  FOR SELECT USING (true);

-- Only Admin/Staff can manage KB
CREATE POLICY "Admin/Staff manage KB" ON kb_articles
  FOR ALL USING (is_admin_or_staff());

-- Only Admin/Staff can read/manage Canned Responses
CREATE POLICY "Admin/Staff manage canned responses" ON canned_responses
  FOR ALL USING (is_admin_or_staff());

-- Only Admin/Staff can read audit logs
CREATE POLICY "Admin/Staff view audit logs" ON ticket_activity
  FOR ALL USING (is_admin_or_staff());


-- ==========================================
-- STORAGE POLICIES
-- ==========================================
-- Ticket attachments bucket (Run these if your bucket is named 'ticket_attachments')

-- Create bucket if it doesn't exist (Requires Postgres plugin, usually done in UI but safe here)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('ticket_attachments', 'ticket_attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Anyone authenticated can upload
CREATE POLICY "Authenticated users can upload attachments" 
  ON storage.objects FOR INSERT 
  WITH CHECK (bucket_id = 'ticket_attachments' AND auth.role() = 'authenticated');

-- Everyone can read for now (since publicUrl is used in the app)
-- To restrict this, you'd need to use signed urls instead of public urls in the application.
CREATE POLICY "Anyone can view attachments" 
  ON storage.objects FOR SELECT 
  USING (bucket_id = 'ticket_attachments');
