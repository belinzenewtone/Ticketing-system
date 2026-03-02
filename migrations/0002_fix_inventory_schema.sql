-- Migration to fix inventory submissions
-- Adds missing columns and relaxes constraints

ALTER TABLE machine_requests 
ALTER COLUMN user_name DROP NOT NULL;

ALTER TABLE machine_requests 
ADD COLUMN IF NOT EXISTS item_type TEXT DEFAULT 'desktop' CHECK (item_type IN ('supplies', 'desktop', 'laptop')),
ADD COLUMN IF NOT EXISTS supply_name TEXT,
ADD COLUMN IF NOT EXISTS item_count INTEGER DEFAULT 1;

-- Update existing records if any
UPDATE machine_requests SET item_type = 'desktop' WHERE item_type IS NULL;
UPDATE machine_requests SET item_count = 1 WHERE item_count IS NULL;
