import { NextResponse } from 'next/server';
import { Pool } from 'pg';

export async function GET() {
    const url = process.env.DATABASE_URL;
    if (!url) return NextResponse.json({ error: 'DATABASE_URL not set' }, { status: 500 });

    const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
    try {
        await pool.query('SELECT 1');
        const result = await pool.query('SELECT id, email, role FROM "User" WHERE email = $1', ['admin@jtl.co.ke']);
        return NextResponse.json({
            db: 'connected',
            adminExists: result.rows.length > 0,
            adminRole: result.rows[0]?.role ?? null,
        });
    } catch (e) {
        return NextResponse.json({ db: 'error', message: (e as Error).message }, { status: 500 });
    } finally {
        await pool.end();
    }
}
