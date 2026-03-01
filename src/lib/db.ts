import { Pool } from 'pg';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('supabase') || process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: false }
        : false,
    max: 10,
});

// Convert SQLite-style ? placeholders to PostgreSQL $1, $2, ... style
// If the SQL already contains $1, we skip the translation to avoid double-processing
function toPostgresParams(sql: string): string {
    if (sql.includes('$1')) return sql;
    let i = 0;
    return sql.replace(/\?/g, () => `$${++i}`);
}

export async function query<T>(sql: string, ...params: unknown[]): Promise<T[]> {
    try {
        const { rows } = await pool.query(toPostgresParams(sql), params);
        return rows as T[];
    } catch (e) {
        console.error('DB query Error:', e);
        throw e;
    }
}

export async function queryOne<T>(sql: string, ...params: unknown[]): Promise<T | null> {
    try {
        const { rows } = await pool.query(toPostgresParams(sql), params);
        return (rows[0] as T) ?? null;
    } catch (e) {
        console.error('DB queryOne Error:', e);
        throw e;
    }
}

export async function execute(sql: string, ...params: unknown[]): Promise<void> {
    try {
        await pool.query(toPostgresParams(sql), params);
    } catch (e) {
        console.error('DB execute Error:', e);
        throw e;
    }
}
