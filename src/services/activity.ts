'use server';

import { query, execute, queryOne } from '@/lib/db';
import { auth } from '@/auth';
import type { TicketActivity } from '@/types/database';

function serializeActivity(a: any): TicketActivity {
    return {
        id: a.id,
        ticket_id: a.ticket_id,
        user_id: a.user_id,
        action: a.action,
        metadata: a.metadata ? JSON.parse(a.metadata) : null,
        created_at: a.created_at,
    };
}

export async function logActivity(
    ticket_id: string,
    action: string,
    metadata?: Record<string, string>
): Promise<void> {
    try {
        const session = await auth();
        const id = crypto.randomUUID();

        await execute(
            `INSERT INTO ticket_activity (id, ticket_id, user_id, action, metadata) 
             VALUES (?, ?, ?, ?, ?)`,
            id,
            ticket_id,
            session?.user?.id ?? null,
            action,
            metadata ? JSON.stringify(metadata) : null
        );
    } catch (error) {
        console.error('Failed to log activity:', error);
    }
}

export async function getTicketActivity(ticket_id: string): Promise<TicketActivity[]> {
    const activities = await query<any>(
        'SELECT * FROM ticket_activity WHERE ticket_id = ? ORDER BY created_at ASC',
        ticket_id
    );
    return activities.map(serializeActivity);
}
