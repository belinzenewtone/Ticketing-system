import { Pool } from 'pg';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 10,
});

// Convert SQLite-style ? placeholders to PostgreSQL $1, $2, ... style
function toPostgresParams(sql: string): string {
    let i = 0;
    return sql.replace(/\?/g, () => `$${++i}`);
}

export async function query<T>(sql: string, ...params: unknown[]): Promise<T[]> {
    const { rows } = await pool.query(toPostgresParams(sql), params);
    return rows as T[];
}

export async function queryOne<T>(sql: string, ...params: unknown[]): Promise<T | null> {
    const { rows } = await pool.query(toPostgresParams(sql), params);
    return (rows[0] as T) ?? null;
}

export async function execute(sql: string, ...params: unknown[]): Promise<void> {
    await pool.query(toPostgresParams(sql), params);
}
