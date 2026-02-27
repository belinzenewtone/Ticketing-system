import { createClient } from '@/lib/supabase/client';
import type { TicketActivity } from '@/types/database';

const supabase = createClient();

export async function logActivity(
    ticket_id: string,
    action: string,
    metadata?: Record<string, string>
): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
        .from('ticket_activity')
        .insert({ ticket_id, user_id: user?.id ?? null, action, metadata: metadata ?? null });
    if (error) {
        console.error('Failed to log activity:', error);
    }
}

export async function getTicketActivity(ticket_id: string): Promise<TicketActivity[]> {
    const { data, error } = await supabase
        .from('ticket_activity')
        .select('*')
        .eq('ticket_id', ticket_id)
        .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
}
