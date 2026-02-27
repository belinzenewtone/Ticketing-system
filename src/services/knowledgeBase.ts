import { createClient } from '@/lib/supabase/client';
import type { KbArticle, CreateKbArticleInput, TicketCategory } from '@/types/database';

const supabase = createClient();

export async function getKbArticles(filters?: {
    category?: TicketCategory | null;
    search?: string;
}): Promise<KbArticle[]> {
    let query = supabase
        .from('kb_articles')
        .select('*')
        .order('created_at', { ascending: false });

    if (filters?.category) {
        query = query.eq('category', filters.category);
    }
    if (filters?.search) {
        query = query.or(`title.ilike.%${filters.search}%,content.ilike.%${filters.search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
}

export async function addKbArticle(input: CreateKbArticleInput): Promise<KbArticle> {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
        .from('kb_articles')
        .insert({ ...input, created_by: user?.id ?? null })
        .select('*')
        .single();
    if (error) throw error;
    return data;
}

export async function updateKbArticle(id: string, updates: Partial<KbArticle>): Promise<KbArticle> {
    const { data, error } = await supabase
        .from('kb_articles')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('*')
        .single();
    if (error) throw error;
    return data;
}

export async function deleteKbArticle(id: string): Promise<void> {
    const { error } = await supabase.from('kb_articles').delete().eq('id', id);
    if (error) throw error;
}
