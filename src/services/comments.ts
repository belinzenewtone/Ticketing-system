'use server';

import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import type { TicketComment, CreateCommentInput } from '@/types/database';

function serializeComment(c: {
    id: string; ticketId: string; userId: string | null;
    authorName: string; content: string; isInternal: boolean; createdAt: Date;
}): TicketComment {
    return {
        id: c.id,
        ticket_id: c.ticketId,
        user_id: c.userId,
        author_name: c.authorName,
        content: c.content,
        is_internal: c.isInternal,
        created_at: c.createdAt.toISOString(),
    };
}

export async function getComments(ticket_id: string, includeInternal: boolean = false): Promise<TicketComment[]> {
    const where: Record<string, unknown> = { ticketId: ticket_id };
    if (!includeInternal) where.isInternal = false;

    const comments = await prisma.ticketComment.findMany({
        where: where as any,
        orderBy: { createdAt: 'asc' },
    });
    return comments.map(serializeComment);
}

export async function addComment(input: CreateCommentInput, authorName: string): Promise<TicketComment> {
    const session = await auth();
    const comment = await prisma.ticketComment.create({
        data: {
            ticketId: input.ticket_id,
            content: input.content,
            isInternal: input.is_internal ?? false,
            userId: session?.user?.id ?? null,
            authorName,
        },
    });
    return serializeComment(comment);
}

export async function deleteComment(id: string): Promise<void> {
    await prisma.ticketComment.delete({ where: { id } });
}
