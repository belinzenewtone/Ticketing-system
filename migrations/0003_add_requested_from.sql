-- Add requested_from column to track where the request originated
ALTER TABLE machine_requests 
ADD COLUMN IF NOT EXISTS requested_from VARCHAR(20) DEFAULT 'portal';

-- Update existing records to 'portal' as they were likely created there
UPDATE machine_requests SET requested_from = 'portal' WHERE requested_from IS NULL;
