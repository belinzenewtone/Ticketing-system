-- ─── Procurement Requisitions ─────────────────────────────────────────────────
-- Run this against your Supabase/PostgreSQL database when ready

CREATE TABLE IF NOT EXISTS requisitions (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    number           SERIAL UNIQUE,
    requisition_date DATE NOT NULL DEFAULT CURRENT_DATE,  -- auto-defaults to today
    title            TEXT NOT NULL,
    item_quantity    INTEGER NOT NULL DEFAULT 1,          -- total units being procured
    requested_for    TEXT,                                -- employee / department being procured for
    type            TEXT NOT NULL DEFAULT 'other',           -- RequisitionType
    supplier_name   TEXT NOT NULL,
    supplier_contact TEXT,
    total_amount    NUMERIC(15, 2) NOT NULL DEFAULT 0,
    current_stage   TEXT NOT NULL DEFAULT 'draft',           -- RequisitionStage
    notes           TEXT,
    created_by      TEXT,                          -- user id of the admin who created it
    requestor_name  TEXT,                          -- auto-filled from session at creation
    requestor_email TEXT,                          -- auto-filled from session at creation
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Individual PO line items belonging to a requisition
CREATE TABLE IF NOT EXISTS requisition_items (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requisition_id   UUID NOT NULL REFERENCES requisitions(id) ON DELETE CASCADE,
    po_reference     TEXT NOT NULL,      -- unique item/PO reference number
    description      TEXT NOT NULL,
    quantity         INTEGER NOT NULL DEFAULT 1,
    unit_price       NUMERIC(15, 2) NOT NULL DEFAULT 0,
    total_price      NUMERIC(15, 2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Sign-off history per stage per requisition
CREATE TABLE IF NOT EXISTS requisition_stages (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requisition_id   UUID NOT NULL REFERENCES requisitions(id) ON DELETE CASCADE,
    stage            TEXT NOT NULL,       -- which approval stage
    status           TEXT NOT NULL DEFAULT 'pending',  -- approved | rejected | pending
    signed_date      DATE,                -- manually entered date executive signed
    notes            TEXT,
    recorded_by      TEXT,                -- admin user id who recorded this
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_req_items_req_id   ON requisition_items(requisition_id);
CREATE INDEX IF NOT EXISTS idx_req_stages_req_id  ON requisition_stages(requisition_id);
CREATE INDEX IF NOT EXISTS idx_requisitions_stage ON requisitions(current_stage);
