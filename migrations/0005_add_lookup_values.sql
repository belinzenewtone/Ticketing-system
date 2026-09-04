-- ─── Editable dropdown lookup values ──────────────────────────────────────────
-- Stores admin-managed list items used across the app for dropdowns.
-- category examples: 'ticket_priority', 'ticket_category', 'ticket_department',
--                    'inventory_category', 'procurement_type', 'procurement_supplier'

CREATE TABLE IF NOT EXISTS lookup_values (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category       TEXT NOT NULL,        -- which dropdown this belongs to
    value          TEXT NOT NULL,        -- the stored/submitted value
    label          TEXT NOT NULL,        -- the display label
    display_order  INTEGER NOT NULL DEFAULT 0,
    active         BOOLEAN NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(category, value)
);

CREATE INDEX IF NOT EXISTS idx_lookup_category ON lookup_values(category, active, display_order);

-- ─── Seed data ────────────────────────────────────────────────────────────────

-- Ticket priorities
INSERT INTO lookup_values (category, value, label, display_order) VALUES
    ('ticket_priority', 'critical', 'Critical',  1),
    ('ticket_priority', 'high',     'High',       2),
    ('ticket_priority', 'medium',   'Medium',     3),
    ('ticket_priority', 'low',      'Low',        4)
ON CONFLICT (category, value) DO NOTHING;

-- Ticket categories
INSERT INTO lookup_values (category, value, label, display_order) VALUES
    ('ticket_category', 'email',          'Email',            1),
    ('ticket_category', 'account-login',  'Account / Login',  2),
    ('ticket_category', 'password-reset', 'Password Reset',   3),
    ('ticket_category', 'hardware',       'Hardware',         4),
    ('ticket_category', 'software',       'Software',         5),
    ('ticket_category', 'network-vpn',    'Network / VPN',    6),
    ('ticket_category', 'other',          'Other',            7)
ON CONFLICT (category, value) DO NOTHING;

-- Ticket departments
INSERT INTO lookup_values (category, value, label, display_order) VALUES
    ('ticket_department', 'IT',          'IT',           1),
    ('ticket_department', 'Finance',     'Finance',      2),
    ('ticket_department', 'HR',          'HR',           3),
    ('ticket_department', 'Operations',  'Operations',   4),
    ('ticket_department', 'Sales',       'Sales',        5),
    ('ticket_department', 'Management',  'Management',   6)
ON CONFLICT (category, value) DO NOTHING;

-- Inventory categories
INSERT INTO lookup_values (category, value, label, display_order) VALUES
    ('inventory_category', 'laptops',     'Laptops',      1),
    ('inventory_category', 'desktops',    'Desktops',     2),
    ('inventory_category', 'peripherals', 'Peripherals',  3),
    ('inventory_category', 'networking',  'Networking',   4),
    ('inventory_category', 'supplies',    'Supplies',     5),
    ('inventory_category', 'other',       'Other',        6)
ON CONFLICT (category, value) DO NOTHING;

-- Procurement types
INSERT INTO lookup_values (category, value, label, display_order) VALUES
    ('procurement_type', 'it-equipment',   'IT Equipment',   1),
    ('procurement_type', 'office-supplies', 'Office Supplies', 2),
    ('procurement_type', 'services',        'Services',       3),
    ('procurement_type', 'other',           'Other',          4)
ON CONFLICT (category, value) DO NOTHING;

-- Procurement suppliers
INSERT INTO lookup_values (category, value, label, display_order) VALUES
    ('procurement_supplier', 'ELEVETUS',    'ELEVETUS',    1),
    ('procurement_supplier', 'OPENSOL',     'OPENSOL',     2),
    ('procurement_supplier', 'DIGITAL LEO', 'DIGITAL LEO', 3),
    ('procurement_supplier', 'SAI OFFICE',  'SAI OFFICE',  4),
    ('procurement_supplier', 'ADTEL',       'ADTEL',       5),
    ('procurement_supplier', 'ANGANI',      'ANGANI',      6)
ON CONFLICT (category, value) DO NOTHING;
