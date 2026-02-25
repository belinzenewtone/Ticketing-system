import { createClient } from '@/lib/supabase/client';
import type { Entry, CreateEntryInput, ResolutionType } from '@/types/database';

const supabase = createClient();

export async function getEntries(filters?: {
    completed?: boolean;
    resolution?: ResolutionType;
    search?: string;
    dateRange?: 'today' | 'week' | 'month' | 'year';
}): Promise<Entry[]> {
    let query = supabase
        .from('entries')
        .select('*')
        .order('number', { ascending: false });

    if (filters?.completed !== undefined) {
        query = query.eq('completed', filters.completed);
    }
    if (filters?.resolution) {
        query = query.eq('resolution', filters.resolution);
    }
    if (filters?.search) {
        query = query.or(
            `employee_name.ilike.%${filters.search}%,work_email.ilike.%${filters.search}%`
        );
    }
    if (filters?.dateRange) {
        const now = new Date();
        let start: string;
        switch (filters.dateRange) {
            case 'today':
                start = now.toISOString().split('T')[0];
                break;
            case 'week':
                now.setDate(now.getDate() - 7);
                start = now.toISOString().split('T')[0];
                break;
            case 'month':
                now.setMonth(now.getMonth() - 1);
                start = now.toISOString().split('T')[0];
                break;
            case 'year':
                now.setFullYear(now.getFullYear() - 1);
                start = now.toISOString().split('T')[0];
                break;
        }
        query = query.gte('entry_date', start);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
}

export async function addEntry(input: CreateEntryInput): Promise<Entry> {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
        .from('entries')
        .insert({ ...input, created_by: user?.id })
        .select('*')
        .single();
    if (error) throw error;
    return data;
}

export async function updateEntry(id: string, updates: Partial<Entry>): Promise<Entry> {
    const { data, error } = await supabase
        .from('entries')
        .update(updates)
        .eq('id', id)
        .select('*')
        .single();
    if (error) throw error;
    return data;
}

export async function deleteEntry(id: string): Promise<void> {
    const { error } = await supabase.from('entries').delete().eq('id', id);
    if (error) throw error;
}

export async function getEntryStats() {
    const { data, error } = await supabase.from('entries').select('resolution, completed');
    if (error) throw error;
    const entries = data || [];
    return {
        total: entries.length,
        sorted: entries.filter(e => e.resolution === 'sorted').length,
        pending: entries.filter(e => !e.completed).length,
        completed: entries.filter(e => e.completed).length,
        altEmail: entries.filter(e => e.resolution === 'alt-email').length,
        altPhone: entries.filter(e => e.resolution === 'alt-phone').length,
        altBoth: entries.filter(e => e.resolution === 'alt-both').length,
        neverUsed: entries.filter(e => e.resolution === 'never-used').length,
        licensing: entries.filter(e => e.resolution === 'licensing').length,
    };
}
