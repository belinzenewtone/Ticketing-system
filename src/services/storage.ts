'use server';

import { createClient } from '@supabase/supabase-js';

const BUCKET = 'attachments';

function getSupabaseAdmin() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('Supabase env vars are not configured.');
    return createClient(url, key);
}

export async function uploadTicketAttachment(file: File): Promise<string> {
    const supabase = getSupabaseAdmin();
    const ext = file.name.split('.').pop();
    const path = `tickets/${Date.now()}-${crypto.randomUUID()}.${ext}`;

    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
        contentType: file.type,
        upsert: false,
    });

    if (error) throw new Error(`Upload failed: ${error.message}`);

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl;
}
