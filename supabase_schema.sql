-- ============================================================
-- Supabase / PostgreSQL Schema for Employee Ticketing System
-- Run this in the Supabase SQL Editor (Project → SQL Editor → New query)
-- ============================================================

-- User Table
CREATE TABLE IF NOT EXISTS "User" (
    id TEXT PRIMARY KEY,
    name TEXT,
    email TEXT UNIQUE,
    "emailVerified" TEXT,
    image TEXT,
    password TEXT,
    role TEXT DEFAULT 'USER' CHECK (role IN ('ADMIN', 'IT_STAFF', 'USER')),
    "createdAt" TEXT DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TEXT DEFAULT CURRENT_TIMESTAMP
);

-- NextAuth Tables
CREATE TABLE IF NOT EXISTS "Account" (
    id TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    provider TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    refresh_token TEXT,
    access_token TEXT,
    expires_at INTEGER,
    token_type TEXT,
    scope TEXT,
    id_token TEXT,
    session_state TEXT,
    UNIQUE (provider, "providerAccountId")
);

CREATE TABLE IF NOT EXISTS "Session" (
    id TEXT PRIMARY KEY,
    "sessionToken" TEXT UNIQUE NOT NULL,
    "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
    expires TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS "VerificationToken" (
    identifier TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL,
    expires TEXT NOT NULL,
    UNIQUE (identifier, token)
);

-- Entries Table (auto-incrementing number for display)
CREATE TABLE IF NOT EXISTS entries (
    id TEXT UNIQUE NOT NULL,
    number SERIAL PRIMARY KEY,
    entry_date TEXT,
    employee_name TEXT NOT NULL,
    work_email TEXT NOT NULL,
    employee_phone TEXT,
    alt_email_status TEXT,
    alt_email TEXT,
    resolution TEXT NOT NULL CHECK (resolution IN ('sorted', 'alt-email', 'alt-phone', 'alt-both', 'never-used', 'licensing')),
    completed INTEGER DEFAULT 0,
    created_by TEXT REFERENCES "User"(id),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Tasks Table
CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    date TEXT,
    text TEXT NOT NULL,
    importance TEXT CHECK (importance IN ('urgent', 'important', 'neutral')),
    completed INTEGER DEFAULT 0,
    created_by TEXT REFERENCES "User"(id),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Machine Requests Table
CREATE TABLE IF NOT EXISTS machine_requests (
    id TEXT UNIQUE NOT NULL,
    number SERIAL PRIMARY KEY,
    date TEXT,
    requester_name TEXT NOT NULL,
    user_name TEXT NOT NULL,
    work_email TEXT NOT NULL,
    reason TEXT CHECK (reason IN ('old_hardware', 'faulty', 'new_user')),
    importance TEXT CHECK (importance IN ('urgent', 'important', 'neutral')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'fulfilled', 'rejected')),
    notes TEXT,
    created_by TEXT REFERENCES "User"(id),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Tickets Table
CREATE TABLE IF NOT EXISTS tickets (
    id TEXT UNIQUE NOT NULL,
    number SERIAL PRIMARY KEY,
    ticket_date TEXT,
    employee_name TEXT NOT NULL,
    department TEXT,
    category TEXT CHECK (category IN ('email', 'account_login', 'password_reset', 'hardware', 'software', 'network_vpn', 'other')),
    priority TEXT CHECK (priority IN ('critical', 'high', 'medium', 'low')),
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
    sentiment TEXT DEFAULT 'neutral' CHECK (sentiment IN ('positive', 'neutral', 'frustrated', 'angry')),
    subject TEXT NOT NULL,
    description TEXT,
    resolution_notes TEXT,
    internal_notes TEXT,
    due_date TEXT,
    created_by TEXT REFERENCES "User"(id),
    assigned_to TEXT REFERENCES "User"(id),
    attachment_url TEXT,
    merged_into TEXT REFERENCES tickets(id),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Canned Responses Table
CREATE TABLE IF NOT EXISTS canned_responses (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_by TEXT REFERENCES "User"(id),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Ticket Activity Log
CREATE TABLE IF NOT EXISTS ticket_activity (
    id TEXT PRIMARY KEY,
    ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    user_id TEXT REFERENCES "User"(id),
    action TEXT NOT NULL,
    metadata TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Knowledge Base Articles
CREATE TABLE IF NOT EXISTS kb_articles (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT CHECK (category IN ('email', 'account_login', 'password_reset', 'hardware', 'software', 'network_vpn', 'other')),
    created_by TEXT REFERENCES "User"(id),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Ticket Comments
CREATE TABLE IF NOT EXISTS ticket_comments (
    id TEXT PRIMARY KEY,
    ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    user_id TEXT REFERENCES "User"(id),
    author_name TEXT NOT NULL,
    content TEXT NOT NULL,
    is_internal INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- Create admin user (password: 159357)
-- Run this after the tables are created
-- ============================================================
INSERT INTO "User" (id, name, email, password, role, "createdAt", "updatedAt")
VALUES (
    gen_random_uuid()::text,
    'Admin',
    'admin@jtl.co.ke',
    '$2b$12$y4X1S.w34plcZeYxDY5DN.JeeAvHKNfxiCcL6cfXPSj2d46VhBnQK',
    'ADMIN',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT (email) DO NOTHING;
