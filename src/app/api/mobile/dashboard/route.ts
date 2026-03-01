import { NextResponse } from 'next/server';
import { getSession } from '@/lib/mobile-auth';
import { query } from '@/lib/db';

export async function GET(request: Request) {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role === 'USER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const [tickets, tasks, machines] = await Promise.all([
        query<any>('SELECT status, priority, created_at FROM tickets'),
        query<any>('SELECT completed, importance FROM tasks'),
        query<any>('SELECT status FROM machine_requests'),
    ]);

    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];

    return NextResponse.json({
        tickets: {
            total: tickets.length,
            open: tickets.filter(t => t.status === 'open').length,
            in_progress: tickets.filter(t => t.status === 'in_progress').length,
            resolved: tickets.filter(t => t.status === 'resolved').length,
            closed: tickets.filter(t => t.status === 'closed').length,
            critical: tickets.filter(t => t.priority === 'critical').length,
            today: tickets.filter(t => t.created_at?.slice(0, 10) === today).length,
            this_week: tickets.filter(t => t.created_at?.slice(0, 10) >= weekAgo).length,
        },
        tasks: {
            total: tasks.length,
            completed: tasks.filter(t => t.completed === true || t.completed === 1).length,
            pending: tasks.filter(t => !t.completed).length,
            urgent: tasks.filter(t => t.importance === 'urgent' && !t.completed).length,
        },
        machines: {
            total: machines.length,
            pending: machines.filter(m => m.status === 'pending').length,
            approved: machines.filter(m => m.status === 'approved').length,
            fulfilled: machines.filter(m => m.status === 'fulfilled').length,
        },
    });
}
