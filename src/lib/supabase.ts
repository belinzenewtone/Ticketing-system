import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY env vars.');
}

/** Browser / client-side Supabase client (anon key, RLS-respecting). */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/** Server-side admin client — only use in server actions / API routes. */
export function createSupabaseAdmin() {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY env var.');
    return createClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false },
    });
}
