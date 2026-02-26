import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

export async function uploadTicketAttachment(file: File): Promise<string> {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
    const filePath = `${fileName}`;

    const { data, error } = await supabase.storage
        .from('ticket_attachments')
        .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
        });

    if (error) {
        throw new Error(`Upload failed: ${error.message}`);
    }

    const { data: publicUrlData } = supabase.storage
        .from('ticket_attachments')
        .getPublicUrl(filePath);

    return publicUrlData.publicUrl;
}
