'use server';

import { query, queryOne, execute } from '@/lib/db';
import { auth } from '@/auth';
import { hash } from 'bcryptjs';

export async function updatePassword(password: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Unauthorized');

    const hashedPassword = await hash(password, 12);
    await execute('UPDATE User SET password = ?, updatedAt = ? WHERE id = ?',
        hashedPassword, new Date().toISOString(), session.user.id);

    return { success: true };
}

export async function updateProfile(data: { name?: string; image?: string }) {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Unauthorized');

    const fields: string[] = [];
    const params: any[] = [];

    if (data.name !== undefined) { fields.push("name = ?"); params.push(data.name); }
    if (data.image !== undefined) { fields.push("image = ?"); params.push(data.image); }

    if (fields.length > 0) {
        fields.push("updatedAt = ?");
        params.push(new Date().toISOString());
        params.push(session.user.id);

        await execute(`UPDATE User SET ${fields.join(', ')} WHERE id = ?`, ...params);
    }

    return { success: true };
}

export async function getCurrentProfile() {
    const session = await auth();
    if (!session?.user?.id) return null;
    const user = await queryOne<any>('SELECT id, name, email, role, image, createdAt FROM User WHERE id = ?', session.user.id);
    return user ?? null;
}

export async function getITStaff() {
    return await query<any>("SELECT id, name, email, role FROM User WHERE role IN ('IT_STAFF', 'ADMIN') ORDER BY name ASC");
}

export async function updateUserName(name: string) {
    return updateProfile({ name });
}

export async function updateUserPassword(password: string) {
    return updatePassword(password);
}
