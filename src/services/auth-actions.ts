'use server';

import { query, queryOne, execute } from '@/lib/db';
import { auth } from '@/auth';
import { hash } from 'bcryptjs';

const BYPASS_AUTH = process.env.BYPASS_AUTH === 'true';

// Mock profile returned when BYPASS_AUTH=true or when the DB is unreachable
const DEV_PROFILE = {
    id: 'dev-admin-bypass-id',
    name: 'Dev Admin (Bypass)',
    email: 'dev@jtl.co.ke',
    role: 'ADMIN',
    image: null,
    createdAt: new Date().toISOString(),
};

export async function updatePassword(password: string) {
    if (BYPASS_AUTH) return { success: true }; // no-op in dev bypass

    const session = await auth();
    if (!session?.user?.id) throw new Error('Unauthorized');

    const hashedPassword = await hash(password, 12);
    await execute('UPDATE "User" SET password = $1, "updatedAt" = $2 WHERE id = $3',
        hashedPassword, new Date().toISOString(), session.user.id);

    return { success: true };
}

export async function updateProfile(data: { name?: string; image?: string }) {
    if (BYPASS_AUTH) return { success: true }; // no-op in dev bypass

    const session = await auth();
    if (!session?.user?.id) throw new Error('Unauthorized');

    const fields: string[] = [];
    const params: any[] = [];

    if (data.name !== undefined) { fields.push(`name = $${fields.length + 1}`); params.push(data.name); }
    if (data.image !== undefined) { fields.push(`image = $${fields.length + 1}`); params.push(data.image); }

    if (fields.length > 0) {
        fields.push('"updatedAt" = $' + (fields.length + 1));
        params.push(new Date().toISOString());
        params.push(session.user.id);

        const sql = `UPDATE "User" SET ${fields.join(', ')} WHERE id = $${params.length}`;
        await execute(sql, ...params);
    }

    return { success: true };
}

export async function getCurrentProfile() {
    const session = await auth();
    if (!session?.user?.id) return null;

    // Return the mock profile directly in bypass mode (avoids a failing DB call)
    if (BYPASS_AUTH || session.user.id === 'dev-admin-bypass-id') {
        return { ...DEV_PROFILE, name: session.user.name ?? DEV_PROFILE.name, email: session.user.email ?? DEV_PROFILE.email };
    }

    try {
        const user = await queryOne<any>(
            'SELECT id, name, email, role, image, "createdAt" FROM "User" WHERE id = $1',
            session.user.id
        );
        return user ?? null;
    } catch {
        // DB unavailable — return a minimal profile so the UI doesn't break
        console.warn('[auth-actions] DB unreachable, returning mock profile');
        return DEV_PROFILE;
    }
}

export async function getITStaff() {
    if (BYPASS_AUTH) return []; // no DB in bypass
    try {
        return await query<any>("SELECT id, name, email, role FROM \"User\" WHERE role IN ('IT_STAFF', 'ADMIN') ORDER BY name ASC");
    } catch {
        return [];
    }
}

export async function updateUserName(name: string) {
    return updateProfile({ name });
}

export async function updateUserPassword(password: string) {
    return updatePassword(password);
}
