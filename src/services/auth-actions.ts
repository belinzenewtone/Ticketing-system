'use server';

import { query, queryOne, execute } from '@/lib/db';
import { auth } from '@/auth';
import { hash } from 'bcryptjs';

export async function updatePassword(password: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Unauthorized');

    const hashedPassword = await hash(password, 12);
    await execute('UPDATE "User" SET password = $1, "updatedAt" = $2 WHERE id = $3',
        hashedPassword, new Date().toISOString(), session.user.id);

    return { success: true };
}

export async function updateProfile(data: { name?: string; image?: string }) {
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
    const user = await queryOne<any>('SELECT id, name, email, role, image, "createdAt" FROM "User" WHERE id = $1', session.user.id);
    return user ?? null;
}

export async function getITStaff() {
    return await query<any>("SELECT id, name, email, role FROM \"User\" WHERE role IN ('IT_STAFF', 'ADMIN') ORDER BY name ASC");
}

export async function updateUserName(name: string) {
    return updateProfile({ name });
}

export async function updateUserPassword(password: string) {
    return updatePassword(password);
}
