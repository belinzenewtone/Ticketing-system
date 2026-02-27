import { getRequestContext } from '@cloudflare/next-on-pages';

// Define minimal D1 types if not available globally
export interface D1Result<T = unknown> {
    results: T[];
    success: boolean;
    meta: any;
    error?: string;
}

export interface D1Response {
    success: boolean;
    meta: any;
    error?: string;
}

/**
 * Access the Cloudflare D1 database binding.
 */
export const getDb = (): D1Database => {
    try {
        const ctx = getRequestContext();
        if (ctx?.env?.DB) {
            return ctx.env.DB as D1Database;
        }
    } catch (e) {
        // Fallback or warning
    }
    throw new Error('Cloudflare D1 Database binding "DB" not found.');
};

/**
 * SQL Helper to run queries with binds
 */
export async function query<T>(sql: string, ...params: any[]): Promise<T[]> {
    const db = getDb();
    const result = await db.prepare(sql).bind(...params).all<T>();
    return result.results || [];
}

export async function queryOne<T>(sql: string, ...params: any[]): Promise<T | null> {
    const db = getDb();
    const result = await db.prepare(sql).bind(...params).first<T>();
    return result;
}

export async function execute(sql: string, ...params: any[]): Promise<D1Response> {
    const db = getDb();
    return await db.prepare(sql).bind(...params).run();
}
