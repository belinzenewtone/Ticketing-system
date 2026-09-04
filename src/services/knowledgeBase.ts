'use server';

import { query, queryOne, execute } from '@/lib/db';
import { auth } from '@/auth';
import type { KbArticle, TicketCategory, CreateKbArticleInput } from '@/types/database';

function serializeKb(k: any): KbArticle {
    return {
        id: k.id,
        title: k.title,
        content: k.content,
        category: (k.category?.replace(/_/g, '-') as TicketCategory) || null,
        created_by: k.created_by ?? null,
        created_at: k.created_at,
        updated_at: k.updated_at,
    };
}

export async function getKbArticles(opts?: { category?: TicketCategory; search?: string }): Promise<KbArticle[]> {
    const category = opts?.category;
    const search = opts?.search;
    let sql = 'SELECT * FROM kb_articles WHERE 1=1';
    const params: any[] = [];

    if (category) {
        sql += ' AND category = ?';
        params.push(category.replace(/-/g, '_'));
    }

    if (search) {
        sql += ' AND (title LIKE ? OR content LIKE ?)';
        const s = `%${search}%`;
        params.push(s, s);
    }

    sql += ' ORDER BY created_at DESC';
    const rows = await query<any>(sql, ...params);
    return rows.map(serializeKb);
}

export async function addKbArticle(input: CreateKbArticleInput): Promise<KbArticle> {
    const session = await auth();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const category = input.category ?? null;

    await execute(
        'INSERT INTO kb_articles (id, title, content, category, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        id, input.title, input.content, category ? category.replace(/-/g, '_') : null, session?.user?.id ?? null, now, now
    );

    return { id, title: input.title, content: input.content, category, created_by: session?.user?.id ?? null, created_at: now, updated_at: now };
}

export async function updateKbArticle(id: string, updates: { title?: string; content?: string; category?: TicketCategory | null }): Promise<void> {
    const fields: string[] = [];
    const params: any[] = [];

    if (updates.title !== undefined) { fields.push('title = ?'); params.push(updates.title); }
    if (updates.content !== undefined) { fields.push('content = ?'); params.push(updates.content); }
    if (updates.category !== undefined) { fields.push('category = ?'); params.push(updates.category ? updates.category.replace(/-/g, '_') : null); }

    if (fields.length > 0) {
        fields.push('updated_at = ?');
        params.push(new Date().toISOString());
        params.push(id);
        await execute(`UPDATE kb_articles SET ${fields.join(', ')} WHERE id = ?`, ...params);
    }
}

export async function deleteKbArticle(id: string): Promise<void> {
    await execute('DELETE FROM kb_articles WHERE id = ?', id);
}
