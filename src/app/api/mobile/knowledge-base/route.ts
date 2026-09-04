import { NextResponse } from 'next/server';
import { getSession } from '@/lib/mobile-auth';
import { query, execute } from '@/lib/db';

function serialize(k: any) {
    return { ...k, category: k.category?.replace(/_/g, '-') ?? null };
}

export async function GET(request: Request) {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const category = searchParams.get('category');

    let sql = 'SELECT * FROM kb_articles WHERE 1=1';
    const params: any[] = [];

    if (category && category !== 'all') {
        sql += ` AND category = $${params.length + 1}`;
        params.push(category.replace(/-/g, '_'));
    }
    if (search) {
        sql += ` AND (title ILIKE $${params.length + 1} OR content ILIKE $${params.length + 2})`;
        params.push(`%${search}%`, `%${search}%`);
    }

    sql += ' ORDER BY created_at DESC';
    const rows = await query<any>(sql, ...params);
    return NextResponse.json(rows.map(serialize));
}

export async function POST(request: Request) {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role === 'USER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { title, content, category } = await request.json();
    if (!title || !content) return NextResponse.json({ error: 'title and content required' }, { status: 400 });

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const cat = category ? category.replace(/-/g, '_') : null;

    await execute(
        'INSERT INTO kb_articles (id, title, content, category, created_by, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        id, title, content, cat, session.id, now, now
    );

    return NextResponse.json({ id, title, content, category: category ?? null, created_by: session.id, created_at: now, updated_at: now }, { status: 201 });
}
