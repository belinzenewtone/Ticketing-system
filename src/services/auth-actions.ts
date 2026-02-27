'use server';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import type { Profile } from '@/types/database';

export async function getSession() {
    return auth();
}

export async function getCurrentUser() {
    const session = await auth();
    return session?.user || null;
}

export async function getCurrentProfile(): Promise<Profile | null> {
    const session = await auth();
    if (!session?.user?.id) return null;

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
    });

    if (!user) return null;
    return user as unknown as Profile;
}

export async function getITStaff() {
    return prisma.user.findMany({
        where: { role: { in: ['ADMIN', 'IT_STAFF'] } },
    });
}

export async function updateUserName(name: string): Promise<void> {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Not authenticated');

    await prisma.user.update({
        where: { id: session.user.id },
        data: { name },
    });
}

export async function updateUserPassword(password: string): Promise<void> {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Not authenticated');

    const bcrypt = await import('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.user.update({
        where: { id: session.user.id },
        data: { password: hashedPassword },
    });
}
