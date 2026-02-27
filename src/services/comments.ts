'use server';

import { query, execute } from '@/lib/db';
import { auth } from '@/auth';
import type { TicketComment, CreateCommentInput } from '@/types/database';

function serializeComment(c: any): TicketComment {
    return {
        id: c.id,
        ticket_id: c.ticket_id,
        user_id: c.user_id,
        author_name: c.author_name,
        content: c.content,
        is_internal: Boolean(c.is_internal),
        created_at: c.created_at,
    };
}

export async function getComments(ticket_id: string, includeInternal: boolean = false): Promise<TicketComment[]> {
    const sql = includeInternal
        ? 'SELECT * FROM ticket_comments WHERE ticket_id = ? ORDER BY created_at ASC'
        : 'SELECT * FROM ticket_comments WHERE ticket_id = ? AND is_internal = 0 ORDER BY created_at ASC';

    const comments = await query<any>(sql, ticket_id);
    return comments.map(serializeComment);
}

export async function addComment(input: CreateCommentInput, authorName: string): Promise<TicketComment> {
    const session = await auth();
    const id = crypto.randomUUID();
    const created_at = new Date().toISOString();

    await execute(
        `INSERT INTO ticket_comments (id, ticket_id, user_id, author_name, content, is_internal, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        id,
        input.ticket_id,
        session?.user?.id ?? null,
        authorName,
        input.content,
        input.is_internal ? 1 : 0,
        created_at
    );

    return {
        id,
        ticket_id: input.ticket_id,
        user_id: session?.user?.id ?? null,
        author_name: authorName,
        content: input.content,
        is_internal: input.is_internal ?? false,
        created_at,
    };
}

export async function deleteComment(id: string): Promise<void> {
    await execute('DELETE FROM ticket_comments WHERE id = ?', id);
}
