'use server';

import { query, queryOne, execute } from '@/lib/db';
import { auth } from '@/auth';
import type { Task, CreateTaskInput, ImportanceLevel } from '@/types/database';

function serializeTask(t: any): Task {
    return {
        id: t.id,
        date: t.date,
        text: t.text,
        importance: t.importance as ImportanceLevel,
        completed: Boolean(t.completed),
        created_by: t.created_by ?? null,
        created_at: t.created_at,
        updated_at: t.updated_at,
    };
}

export async function getTasks(filters?: { created_by?: string }): Promise<Task[]> {
    let sql = 'SELECT * FROM tasks WHERE 1=1';
    const params: any[] = [];

    if (filters?.created_by) {
        sql += ' AND created_by = ?';
        params.push(filters.created_by);
    }

    sql += ' ORDER BY created_at DESC';
    const rows = await query<any>(sql, ...params);
    return rows.map(serializeTask);
}

export async function addTask(input: CreateTaskInput): Promise<Task> {
    const session = await auth();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await execute(
        `INSERT INTO tasks (id, date, text, importance, completed, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        id,
        input.date ?? null,
        input.text,
        input.importance,
        input.completed ? 1 : 0,
        session?.user?.id ?? null,
        now,
        now
    );

    return {
        id,
        date: input.date ?? null,
        text: input.text,
        importance: input.importance,
        completed: input.completed ?? false,
        created_by: session?.user?.id ?? null,
        created_at: now,
        updated_at: now,
    };
}

export async function updateTask(id: string, updates: Partial<Task>): Promise<Task> {
    const fields: string[] = [];
    const params: any[] = [];

    if (updates.date !== undefined) { fields.push("date = ?"); params.push(updates.date); }
    if (updates.text !== undefined) { fields.push("text = ?"); params.push(updates.text); }
    if (updates.importance !== undefined) { fields.push("importance = ?"); params.push(updates.importance); }
    if (updates.completed !== undefined) { fields.push("completed = ?"); params.push(updates.completed ? 1 : 0); }

    fields.push("updated_at = ?");
    params.push(new Date().toISOString());

    if (fields.length > 1) {
        const sql = `UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`;
        params.push(id);
        await execute(sql, ...params);
    }

    const row = await queryOne<any>('SELECT * FROM tasks WHERE id = ?', id);
    return serializeTask(row);
}

export async function deleteTask(id: string): Promise<void> {
    await execute('DELETE FROM tasks WHERE id = ?', id);
}

export async function toggleTask(id: string, completed: boolean): Promise<void> {
    await execute('UPDATE tasks SET completed = ?, updated_at = ? WHERE id = ?',
        completed ? 1 : 0, new Date().toISOString(), id);
}
