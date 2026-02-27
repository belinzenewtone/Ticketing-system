'use server';

import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import type { TicketActivity } from '@/types/database';

function serializeActivity(a: {
    id: string; ticketId: string; userId: string | null;
    action: string; metadata: unknown; createdAt: Date;
}): TicketActivity {
    return {
        id: a.id,
        ticket_id: a.ticketId,
        user_id: a.userId,
        action: a.action,
        metadata: a.metadata as Record<string, string> | null,
        created_at: a.createdAt.toISOString(),
    };
}

export async function logActivity(
    ticket_id: string,
    action: string,
    metadata?: Record<string, string>
): Promise<void> {
    try {
        const session = await auth();
        await prisma.ticketActivity.create({
            data: {
                ticketId: ticket_id,
                userId: session?.user?.id ?? null,
                action,
                metadata: metadata ?? null,
            },
        });
    } catch (error) {
        console.error('Failed to log activity:', error);
    }
}

export async function getTicketActivity(ticket_id: string): Promise<TicketActivity[]> {
    const activities = await prisma.ticketActivity.findMany({
        where: { ticketId: ticket_id },
        orderBy: { createdAt: 'asc' },
    });
    return activities.map(serializeActivity);
}
