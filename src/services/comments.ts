import { createClient } from '@/lib/supabase/client';
import type { TicketComment, CreateCommentInput } from '@/types/database';

const supabase = createClient();

export async function getComments(ticket_id: string, includeInternal: boolean = false): Promise<TicketComment[]> {
    let query = supabase
        .from('ticket_comments')
        .select('*')
        .eq('ticket_id', ticket_id)
        .order('created_at', { ascending: true });

    if (!includeInternal) {
        query = query.eq('is_internal', false);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
}

export async function addComment(input: CreateCommentInput, authorName: string): Promise<TicketComment> {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
        .from('ticket_comments')
        .insert({
            ticket_id: input.ticket_id,
            content: input.content,
            is_internal: input.is_internal ?? false,
            user_id: user?.id ?? null,
            author_name: authorName,
        })
        .select('*')
        .single();
    if (error) throw error;
    return data;
}

export async function deleteComment(id: string): Promise<void> {
    const { error } = await supabase.from('ticket_comments').delete().eq('id', id);
    if (error) throw error;
}
