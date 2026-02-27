import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
    console.error("Missing env vars");
    process.exit(1);
}

const supabase = createClient(url, key);

async function run() {
    const { data, error } = await supabase.from('tickets').select('id, ticket_comments(count)').limit(2);
    console.log("tickets:", JSON.stringify(data, null, 2));
}

run();
