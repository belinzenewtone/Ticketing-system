import { createClient } from '@/lib/supabase/client';
import type { Task, CreateTaskInput, ImportanceLevel } from '@/types/database';

const supabase = createClient();

export async function getTasks(filters?: {
    completed?: boolean;
    importance?: ImportanceLevel;
    search?: string;
}): Promise<Task[]> {
    let query = supabase
        .from('tasks')
        .select('*')
        .order('date', { ascending: false });

    if (filters?.completed !== undefined) {
        query = query.eq('completed', filters.completed);
    }
    if (filters?.importance) {
        query = query.eq('importance', filters.importance);
    }
    if (filters?.search) {
        query = query.ilike('text', `%${filters.search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
}

export async function addTask(input: CreateTaskInput): Promise<Task> {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
        .from('tasks')
        .insert({ ...input, created_by: user?.id })
        .select('*')
        .single();
    if (error) throw error;
    return data;
}

export async function updateTask(id: string, updates: Partial<Task>): Promise<Task> {
    const { data, error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', id)
        .select('*')
        .single();
    if (error) throw error;
    return data;
}

export async function deleteTask(id: string): Promise<void> {
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (error) throw error;
}

export async function getTaskStats() {
    const { data, error } = await supabase.from('tasks').select('importance, completed');
    if (error) throw error;
    const tasks = data || [];
    return {
        total: tasks.length,
        completed: tasks.filter(t => t.completed).length,
        pending: tasks.filter(t => !t.completed).length,
        urgent: tasks.filter(t => t.importance === 'urgent').length,
        important: tasks.filter(t => t.importance === 'important').length,
        neutral: tasks.filter(t => t.importance === 'neutral').length,
    };
}
