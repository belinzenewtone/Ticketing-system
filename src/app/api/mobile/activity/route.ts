import { NextResponse } from 'next/server';
import { getSession } from '@/lib/mobile-auth';
import { query } from '@/lib/db';

export async function GET(request: Request) {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const ticketId = searchParams.get('ticket_id');
    if (!ticketId) return NextResponse.json({ error: 'ticket_id required' }, { status: 400 });

    const rows = await query<any>(
        `SELECT ta.*, u.name as user_name
         FROM ticket_activity ta
         LEFT JOIN "User" u ON u.id = ta.user_id
         WHERE ta.ticket_id = $1
         ORDER BY ta.created_at ASC`,
        ticketId
    );

    return NextResponse.json(rows.map(r => ({
        ...r,
        metadata: r.metadata ? (typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata) : null,
    })));
}
