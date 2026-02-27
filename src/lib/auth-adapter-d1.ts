import { queryOne, execute } from './db';
import type { Adapter, AdapterUser, AdapterAccount, AdapterSession, VerificationToken } from '@auth/core/adapters';

/**
 * Custom Cloudflare D1 Adapter for NextAuth.js
 */
export function D1Adapter(): Adapter {
    const adapter: Adapter = {
        async createUser(user: Omit<AdapterUser, "id">) {
            const id = crypto.randomUUID();
            await execute(
                'INSERT INTO User (id, name, email, emailVerified, image, role) VALUES (?, ?, ?, ?, ?, ?)',
                id, user.name, user.email, user.emailVerified?.toISOString(), user.image, (user as any).role || 'USER'
            );
            return { ...user, id } as AdapterUser;
        },
        async getUser(id: string) {
            const user = await queryOne<any>('SELECT * FROM User WHERE id = ?', id);
            if (!user) return null;
            return { ...user, emailVerified: user.emailVerified ? new Date(user.emailVerified) : null } as AdapterUser;
        },
        async getUserByEmail(email: string) {
            const user = await queryOne<any>('SELECT * FROM User WHERE email = ?', email);
            if (!user) return null;
            return { ...user, emailVerified: user.emailVerified ? new Date(user.emailVerified) : null } as AdapterUser;
        },
        async getUserByAccount({ provider, providerAccountId }) {
            const account = await queryOne<any>(
                'SELECT userId FROM Account WHERE provider = ? AND providerAccountId = ?',
                provider, providerAccountId
            );
            if (!account) return null;
            return adapter.getUser!(account.userId);
        },
        async updateUser(user: Partial<AdapterUser> & { id: string }) {
            const fields: string[] = [];
            const params: any[] = [];
            if (user.name !== undefined) { fields.push("name = ?"); params.push(user.name); }
            if (user.email !== undefined) { fields.push("email = ?"); params.push(user.email); }
            if (user.emailVerified !== undefined) { fields.push("emailVerified = ?"); params.push(user.emailVerified?.toISOString()); }
            if (user.image !== undefined) { fields.push("image = ?"); params.push(user.image); }

            if (fields.length > 0) {
                fields.push("updatedAt = ?");
                params.push(new Date().toISOString());
                params.push(user.id);
                await execute(`UPDATE User SET ${fields.join(', ')} WHERE id = ?`, ...params);
            }
            return adapter.getUser!(user.id) as Promise<AdapterUser>;
        },
        async deleteUser(userId: string) {
            await execute('DELETE FROM User WHERE id = ?', userId);
        },
        async linkAccount(account: AdapterAccount) {
            await execute(
                `INSERT INTO Account (
          id, userId, type, provider, providerAccountId, refresh_token, 
          access_token, expires_at, token_type, scope, id_token, session_state
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                crypto.randomUUID(), account.userId, account.type, account.provider, account.providerAccountId,
                account.refresh_token, account.access_token, account.expires_at, account.token_type,
                account.scope, account.id_token, account.session_state
            );
        },
        async createSession(session: { sessionToken: string; userId: string; expires: Date }) {
            const id = crypto.randomUUID();
            await execute(
                'INSERT INTO Session (id, sessionToken, userId, expires) VALUES (?, ?, ?, ?)',
                id, session.sessionToken, session.userId, session.expires.toISOString()
            );
            return { ...session, id } as AdapterSession;
        },
        async getSessionAndUser(sessionToken: string) {
            const session = await queryOne<any>('SELECT * FROM Session WHERE sessionToken = ?', sessionToken);
            if (!session) return null;
            const user = await adapter.getUser!(session.userId);
            if (!user) return null;
            return {
                session: { ...session, expires: new Date(session.expires) },
                user
            };
        },
        async updateSession(session: Partial<AdapterSession> & { sessionToken: string }) {
            if (!session.expires) return null;
            await execute(
                'UPDATE Session SET expires = ? WHERE sessionToken = ?',
                session.expires.toISOString(), session.sessionToken
            );
            return adapter.getSessionAndUser!(session.sessionToken) as any;
        },
        async deleteSession(sessionToken: string) {
            await execute('DELETE FROM Session WHERE sessionToken = ?', sessionToken);
        },
        async createVerificationToken(token: VerificationToken) {
            await execute(
                'INSERT INTO VerificationToken (identifier, token, expires) VALUES (?, ?, ?)',
                token.identifier, token.token, token.expires.toISOString()
            );
            return token;
        },
        async useVerificationToken({ identifier, token }) {
            const result = await queryOne<any>(
                'SELECT * FROM VerificationToken WHERE identifier = ? AND token = ?',
                identifier, token
            );
            if (!result) return null;
            await execute('DELETE FROM VerificationToken WHERE identifier = ? AND token = ?', identifier, token);
            return { ...result, expires: new Date(result.expires) };
        },
    };
    return adapter;
}
