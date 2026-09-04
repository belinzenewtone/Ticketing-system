-- Initial schema migration for Cloudflare D1 (Refactored for SQLite compatibility)

-- User Table (Must come before tables that reference it)
CREATE TABLE User (
    id TEXT PRIMARY KEY,
    name TEXT,
    email TEXT UNIQUE,
    emailVerified TEXT,
    image TEXT,
    password TEXT,
    role TEXT DEFAULT 'USER' CHECK(role IN ('ADMIN', 'IT_STAFF', 'USER')),
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
);

-- NextAuth Tables
CREATE TABLE Account (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    type TEXT NOT NULL,
    provider TEXT NOT NULL,
    providerAccountId TEXT NOT NULL,
    refresh_token TEXT,
    access_token TEXT,
    expires_at INTEGER,
    token_type TEXT,
    scope TEXT,
    id_token TEXT,
    session_state TEXT,
    FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE,
    UNIQUE(provider, providerAccountId)
);

CREATE TABLE Session (
    id TEXT PRIMARY KEY,
    sessionToken TEXT UNIQUE NOT NULL,
    userId TEXT NOT NULL,
    expires TEXT NOT NULL,
    FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE
);

CREATE TABLE VerificationToken (
    identifier TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL,
    expires TEXT NOT NULL,
    UNIQUE(identifier, token)
);

-- Ticketing System Tables
CREATE TABLE entries (
    id TEXT UNIQUE NOT NULL,
    number INTEGER PRIMARY KEY AUTOINCREMENT,
    entry_date TEXT,
    employee_name TEXT NOT NULL,
    work_email TEXT NOT NULL,
    employee_phone TEXT,
    alt_email_status TEXT,
    alt_email TEXT,
    resolution TEXT NOT NULL CHECK(resolution IN ('sorted', 'alt-email', 'alt-phone', 'alt-both', 'never-used', 'licensing')),
    completed INTEGER DEFAULT 0,
    created_by TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES User(id)
);

CREATE TABLE tasks (
    id TEXT PRIMARY KEY,
    date TEXT,
    text TEXT NOT NULL,
    importance TEXT CHECK(importance IN ('urgent', 'important', 'neutral')),
    completed INTEGER DEFAULT 0,
    created_by TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES User(id)
);

CREATE TABLE machine_requests (
    id TEXT UNIQUE NOT NULL,
    number INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT,
    requester_name TEXT NOT NULL,
    user_name TEXT NOT NULL,
    work_email TEXT NOT NULL,
    reason TEXT CHECK(reason IN ('old-hardware', 'faulty', 'new-user')),
    importance TEXT CHECK(importance IN ('urgent', 'important', 'neutral')),
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'fulfilled', 'rejected')),
    notes TEXT,
    created_by TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES User(id)
);

CREATE TABLE tickets (
    id TEXT UNIQUE NOT NULL,
    number INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_date TEXT,
    employee_name TEXT NOT NULL,
    department TEXT,
    category TEXT CHECK(category IN ('email', 'account-login', 'password-reset', 'hardware', 'software', 'network-vpn', 'other')),
    priority TEXT CHECK(priority IN ('critical', 'high', 'medium', 'low')),
    status TEXT DEFAULT 'open' CHECK(status IN ('open', 'in-progress', 'resolved', 'closed')),
    sentiment TEXT DEFAULT 'neutral' CHECK(sentiment IN ('positive', 'neutral', 'frustrated', 'angry')),
    subject TEXT NOT NULL,
    description TEXT,
    resolution_notes TEXT,
    internal_notes TEXT,
    due_date TEXT,
    created_by TEXT,
    assigned_to TEXT,
    attachment_url TEXT,
    merged_into TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES User(id),
    FOREIGN KEY (assigned_to) REFERENCES User(id),
    FOREIGN KEY (merged_into) REFERENCES tickets(id)
);

CREATE TABLE canned_responses (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_by TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES User(id)
);

CREATE TABLE ticket_activity (
    id TEXT PRIMARY KEY,
    ticket_id TEXT NOT NULL,
    user_id TEXT,
    action TEXT NOT NULL,
    metadata TEXT, -- Stored as JSON string
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES User(id)
);

CREATE TABLE kb_articles (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT CHECK(category IN ('email', 'account-login', 'password-reset', 'hardware', 'software', 'network-vpn', 'other')),
    created_by TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES User(id)
);

CREATE TABLE ticket_comments (
    id TEXT PRIMARY KEY,
    ticket_id TEXT NOT NULL,
    user_id TEXT,
    author_name TEXT NOT NULL,
    content TEXT NOT NULL,
    is_internal INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES User(id)
);
