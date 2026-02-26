-- Phase 6 Migration: Add sentiment column to tickets table

-- 1. Create an ENUM type for ticket sentiment
CREATE TYPE ticket_sentiment AS ENUM ('positive', 'neutral', 'frustrated', 'angry');

-- 2. Add the sentiment column to the tickets table, defaulting to 'neutral'
ALTER TABLE tickets 
ADD COLUMN sentiment ticket_sentiment DEFAULT 'neutral';

-- Note: No RLS changes are strictly required here as it just extends the tickets table which already has policies.
