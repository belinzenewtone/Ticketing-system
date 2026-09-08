import { NextResponse } from 'next/server';
import { getSession } from '@/lib/mobile-auth';
import { query } from '@/lib/db';

export async function GET(request: Request) {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role === 'USER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range') ?? 'month';

    const now = new Date();
    let start: Date;
    if (range === 'today') start = new Date(now.toDateString());
    else if (range === 'week') { start = new Date(now); start.setDate(start.getDate() - 7); }
    else if (range === 'year') { start = new Date(now); start.setFullYear(start.getFullYear() - 1); }
    else { start = new Date(now); start.setMonth(start.getMonth() - 1); }
    const startStr = start.toISOString().split('T')[0];

    const safe = async (sql: string, ...p: any[]) => { try { return await query<any>(sql, ...p); } catch { return []; } };

    const [tickets, tasks, entries, machines, procurement] = await Promise.all([
        safe(`SELECT status, priority, category FROM tickets WHERE ticket_date >= $1`, startStr),
        safe(`SELECT completed, importance FROM tasks WHERE date >= $1`, startStr),
        safe(`SELECT completed, resolution FROM entries WHERE entry_date >= $1`, startStr),
        safe(`SELECT status FROM machine_requests WHERE created_at >= $1`, startStr),
        safe(`SELECT current_stage FROM requisitions WHERE requisition_date >= $1`, startStr),
    ]);

    return NextResponse.json({
        range,
        period: { from: startStr, to: now.toISOString().split('T')[0] },
        tickets: {
            total: tickets.length,
            open: tickets.filter((t: any) => t.status === 'open').length,
            resolved: tickets.filter((t: any) => t.status === 'resolved').length,
            closed: tickets.filter((t: any) => t.status === 'closed').length,
            critical: tickets.filter((t: any) => t.priority === 'critical').length,
            by_category: ['email','account_login','password_reset','hardware','software','network_vpn','other'].map(c => ({
                category: c.replace(/_/g, '-'),
                count: tickets.filter((t: any) => t.category === c).length,
            })).filter(c => c.count > 0),
        },
        tasks: {
            total: tasks.length,
            completed: tasks.filter((t: any) => Boolean(t.completed)).length,
            pending: tasks.filter((t: any) => !t.completed).length,
            urgent: tasks.filter((t: any) => t.importance === 'urgent').length,
        },
        entries: {
            total: entries.length,
            sorted: entries.filter((e: any) => Boolean(e.completed)).length,
            pending: entries.filter((e: any) => !e.completed).length,
        },
        machines: {
            total: machines.length,
            fulfilled: machines.filter((m: any) => m.status === 'fulfilled').length,
            pending: machines.filter((m: any) => m.status === 'pending').length,
        },
        procurement: {
            total: procurement.length,
            delivered: procurement.filter((r: any) => r.current_stage === 'delivered').length,
            active: procurement.filter((r: any) => !['draft','delivered'].includes(r.current_stage)).length,
        },
    });
}
