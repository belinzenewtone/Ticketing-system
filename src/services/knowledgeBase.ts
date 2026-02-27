'use server';

import { query, queryOne, execute } from '@/lib/db';
import { auth } from '@/auth';
import type { KbArticle, TicketCategory } from '@/types/database';

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

export async function addKbArticle(title: string, content: string, category: TicketCategory): Promise<KbArticle> {
    const session = await auth();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await execute(
        'INSERT INTO kb_articles (id, title, content, category, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        id, title, content, category.replace(/-/g, '_'), session?.user?.id ?? null, now, now
    );

    return { id, title, content, category, created_by: session?.user?.id ?? null, created_at: now, updated_at: now };
}

export async function updateKbArticle(id: string, title: string, content: string, category: TicketCategory): Promise<void> {
    await execute(
        'UPDATE kb_articles SET title = ?, content = ?, category = ?, updated_at = ? WHERE id = ?',
        title, content, category.replace(/-/g, '_'), new Date().toISOString(), id
    );
}

export async function deleteKbArticle(id: string): Promise<void> {
    await execute('DELETE FROM kb_articles WHERE id = ?', id);
}
