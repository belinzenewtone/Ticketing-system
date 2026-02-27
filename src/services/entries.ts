'use server';

import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import type { Entry, CreateEntryInput, ResolutionType } from '@/types/database';

// Prisma enum values use underscores; our TypeScript interfaces use hyphens
function fromEnum(val: string): string { return val.replace(/_/g, '-'); }
function toEnum(val: string): string { return val.replace(/-/g, '_'); }

function serializeEntry(e: {
    id: string; number: number; entryDate: Date | null; employeeName: string;
    workEmail: string; employeePhone: string | null; altEmailStatus: string | null;
    altEmail: string | null; resolution: string; completed: boolean;
    createdById: string | null; createdAt: Date; updatedAt: Date;
}): Entry {
    return {
        id: e.id,
        number: e.number,
        entry_date: e.entryDate?.toISOString().split('T')[0] ?? '',
        employee_name: e.employeeName,
        work_email: e.workEmail,
        employee_phone: e.employeePhone ?? '',
        alt_email_status: e.altEmailStatus ?? '',
        alt_email: e.altEmail ?? '',
        resolution: fromEnum(e.resolution) as ResolutionType,
        completed: e.completed,
        created_by: e.createdById,
        created_at: e.createdAt.toISOString(),
        updated_at: e.updatedAt.toISOString(),
    };
}

export async function getEntries(filters?: {
    completed?: boolean;
    resolution?: ResolutionType;
    search?: string;
    dateRange?: 'today' | 'week' | 'month' | 'year';
}): Promise<Entry[]> {
    const where: Record<string, unknown> = {};

    if (filters?.completed !== undefined) where.completed = filters.completed;
    if (filters?.resolution) where.resolution = toEnum(filters.resolution);
    if (filters?.search) {
        where.OR = [
            { employeeName: { contains: filters.search, mode: 'insensitive' } },
            { workEmail: { contains: filters.search, mode: 'insensitive' } },
        ];
    }
    if (filters?.dateRange) {
        const now = new Date();
        let start: Date;
        switch (filters.dateRange) {
            case 'today': start = new Date(now.toISOString().split('T')[0]); break;
            case 'week': start = new Date(now); start.setDate(start.getDate() - 7); break;
            case 'month': start = new Date(now); start.setMonth(start.getMonth() - 1); break;
            case 'year': start = new Date(now); start.setFullYear(start.getFullYear() - 1); break;
        }
        where.entryDate = { gte: start };
    }

    const entries = await prisma.entry.findMany({
        where: where as Parameters<typeof prisma.entry.findMany>[0]['where'],
        orderBy: { number: 'desc' },
    });
    return entries.map(serializeEntry);
}

export async function addEntry(input: CreateEntryInput): Promise<Entry> {
    const session = await auth();
    const entry = await prisma.entry.create({
        data: {
            entryDate: input.entry_date ? new Date(input.entry_date) : null,
            employeeName: input.employee_name,
            workEmail: input.work_email,
            employeePhone: input.employee_phone,
            altEmailStatus: input.alt_email_status,
            altEmail: input.alt_email,
            resolution: toEnum(input.resolution) as never,
            createdById: session?.user?.id ?? null,
        },
    });
    return serializeEntry(entry);
}

export async function updateEntry(id: string, updates: Partial<Entry>): Promise<Entry> {
    const data: Record<string, unknown> = {};
    if (updates.entry_date !== undefined) data.entryDate = updates.entry_date ? new Date(updates.entry_date) : null;
    if (updates.employee_name !== undefined) data.employeeName = updates.employee_name;
    if (updates.work_email !== undefined) data.workEmail = updates.work_email;
    if (updates.employee_phone !== undefined) data.employeePhone = updates.employee_phone;
    if (updates.alt_email_status !== undefined) data.altEmailStatus = updates.alt_email_status;
    if (updates.alt_email !== undefined) data.altEmail = updates.alt_email;
    if (updates.resolution !== undefined) data.resolution = toEnum(updates.resolution);
    if (updates.completed !== undefined) data.completed = updates.completed;

    const entry = await prisma.entry.update({
        where: { id },
        data: data as Parameters<typeof prisma.entry.update>[0]['data'],
    });
    return serializeEntry(entry);
}

export async function deleteEntry(id: string): Promise<void> {
    await prisma.entry.delete({ where: { id } });
}

export async function getEntryStats() {
    const entries: Array<{ resolution: string; completed: boolean }> = await prisma.entry.findMany({
        select: { resolution: true, completed: true },
    });
    return {
        total: entries.length,
        sorted: entries.filter(e => e.resolution === 'sorted').length,
        pending: entries.filter(e => !e.completed).length,
        completed: entries.filter(e => e.completed).length,
        altEmail: entries.filter(e => e.resolution === 'alt_email').length,
        altPhone: entries.filter(e => e.resolution === 'alt_phone').length,
        altBoth: entries.filter(e => e.resolution === 'alt_both').length,
        neverUsed: entries.filter(e => e.resolution === 'never_used').length,
        licensing: entries.filter(e => e.resolution === 'licensing').length,
    };
}
