-- Add SLA tracking and Internal Notes to existing Tickets table
ALTER TABLE public.tickets
ADD COLUMN due_date timestamp with time zone,
ADD COLUMN internal_notes text;

-- Create Canned Responses (Macros) table
CREATE TABLE public.canned_responses (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    title text NOT NULL,
    content text NOT NULL,
    created_by uuid REFERENCES auth.users(id),
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT canned_responses_pkey PRIMARY KEY (id)
);

-- Turn on Row Level Security for Canning table
ALTER TABLE public.canned_responses ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read and insert canned responses
CREATE POLICY "Enable read access for all users" ON public.canned_responses
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for authenticated users only" ON public.canned_responses
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" ON public.canned_responses
    FOR DELETE USING (auth.role() = 'authenticated');

-- After running this SQL, please run this to refresh the cache!
NOTIFY pgrst, 'reload schema';
