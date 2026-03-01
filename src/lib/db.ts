import { Pool } from 'pg';

// Strip sslmode from the connection string so the explicit ssl Pool option takes precedence.
// New versions of pg-connection-string treat sslmode=require as verify-full (certificate verification),
// which conflicts with Supabase's self-signed certificate chain.
function stripSslMode(url: string): string {
    try {
        const u = new URL(url);
        u.searchParams.delete('sslmode');
        return u.toString();
    } catch {
        return url;
    }
}

const rawUrl = process.env.DATABASE_URL ?? '';

const pool = new Pool({
    connectionString: stripSslMode(rawUrl),
    ssl: rawUrl.includes('supabase') || process.env.NODE_ENV === 'production'
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
