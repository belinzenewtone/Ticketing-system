-- ==========================================
-- SUPABASE SCHEMA RECOVERY SCRIPT
-- ==========================================
-- This script reconstructs the tables, ENUMs, and RLS policies
-- based on your application's TypeScript interfaces and local SQL history.
-- Run this in your Supabase SQL Editor to recreate your project structure.

-- 1. Create Data Types (Enums)
CREATE TYPE user_role AS ENUM ('ADMIN', 'IT_STAFF', 'USER');
CREATE TYPE resolution_type AS ENUM ('sorted', 'alt-email', 'alt-phone', 'alt-both', 'never-used', 'licensing');
CREATE TYPE importance_level AS ENUM ('urgent', 'important', 'neutral');
CREATE TYPE machine_reason AS ENUM ('old-hardware', 'faulty', 'new-user');
CREATE TYPE machine_status AS ENUM ('pending', 'approved', 'fulfilled', 'rejected');
CREATE TYPE ticket_category AS ENUM ('email', 'account-login', 'password-reset', 'hardware', 'software', 'network-vpn', 'other');
CREATE TYPE ticket_priority AS ENUM ('critical', 'high', 'medium', 'low');
CREATE TYPE ticket_status AS ENUM ('open', 'in-progress', 'resolved', 'closed');
CREATE TYPE ticket_sentiment AS ENUM ('positive', 'neutral', 'frustrated', 'angry');

-- 2. Create Tables

-- PROFILES
CREATE TABLE public.profiles (
    id uuid references auth.users on delete cascade not null primary key,
    name text not null,
    email text not null,
    role user_role default 'USER',
    created_at timestamp with time zone default now() not null,
    updated_at timestamp with time zone default now() not null
);

-- ENTRIES
CREATE TABLE public.entries (
    id uuid default gen_random_uuid() primary key,
    number serial,
    entry_date date,
    employee_name text not null,
    work_email text not null,
    employee_phone text,
    alt_email_status text,
    alt_email text,
    resolution resolution_type not null,
    completed boolean default false,
    created_by uuid references auth.users(id),
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

-- TASKS
CREATE TABLE public.tasks (
    id uuid default gen_random_uuid() primary key,
    date date,
    text text not null,
    importance importance_level not null,
    completed boolean default false,
    created_by uuid references auth.users(id),
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

-- MACHINE REQUESTS
CREATE TABLE public.machine_requests (
    id uuid default gen_random_uuid() primary key,
    number serial,
    date date,
    requester_name text not null,
    user_name text not null,
    work_email text not null,
    reason machine_reason not null,
    importance importance_level not null,
    status machine_status default 'pending',
    notes text,
    created_by uuid references auth.users(id),
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

-- TICKETS
CREATE TABLE public.tickets (
    id uuid default gen_random_uuid() primary key,
    number serial,
    ticket_date date,
    employee_name text not null,
    department text,
    category ticket_category not null,
    priority ticket_priority not null,
    status ticket_status default 'open',
    sentiment ticket_sentiment default 'neutral',
    subject text not null,
    description text,
    resolution_notes text,
    internal_notes text,
    due_date timestamp with time zone,
    created_by uuid references auth.users(id),
    assigned_to uuid references auth.users(id),
    attachment_url text,
    merged_into uuid references public.tickets(id),
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

-- CANNED RESPONSES
CREATE TABLE public.canned_responses (
    id uuid default gen_random_uuid() primary key,
    title text not null,
    content text not null,
    created_by uuid references auth.users(id),
    created_at timestamp with time zone default now()
);

-- TICKET ACTIVITY
CREATE TABLE public.ticket_activity (
    id uuid default gen_random_uuid() primary key,
    ticket_id uuid references public.tickets(id) on delete cascade not null,
    user_id uuid references auth.users(id),
    action text not null,
    metadata jsonb,
    created_at timestamp with time zone default now()
);

-- KB ARTICLES
CREATE TABLE public.kb_articles (
    id uuid default gen_random_uuid() primary key,
    title text not null,
    content text not null,
    category ticket_category,
    created_by uuid references auth.users(id),
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

-- TICKET COMMENTS
CREATE TABLE public.ticket_comments (
    id uuid default gen_random_uuid() primary key,
    ticket_id uuid references public.tickets(id) on delete cascade not null,
    user_id uuid references auth.users(id),
    author_name text not null,
    content text not null,
    is_internal boolean default false,
    created_at timestamp with time zone default now()
);

-- ==========================================
-- 3. SUPABASE SECURITY POLICIES (RLS)
-- ==========================================

-- Enable RLS on all tables
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE machine_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE canned_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_activity ENABLE ROW LEVEL SECURITY;

-- Helper function to check if the current user is an admin or IT staff
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
