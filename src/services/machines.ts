'use server';

import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import type { MachineRequest, CreateMachineInput, MachineReason, MachineStatus } from '@/types/database';

// Prisma enum values use underscores; our TypeScript interfaces use hyphens
function fromEnum(val: string): string { return val.replace(/_/g, '-'); }
function toEnum(val: string): string { return val.replace(/-/g, '_'); }

function serializeMachine(m: {
    id: string; number: number; date: Date | null; requesterName: string;
    userName: string; workEmail: string; reason: string; importance: string;
    status: string; notes: string | null; createdById: string | null;
    createdAt: Date; updatedAt: Date;
}): MachineRequest {
    return {
        id: m.id,
        number: m.number,
        date: m.date?.toISOString().split('T')[0] ?? '',
        requester_name: m.requesterName,
        user_name: m.userName,
        work_email: m.workEmail,
        reason: fromEnum(m.reason) as MachineReason,
        importance: m.importance as MachineRequest['importance'],
        status: m.status as MachineStatus,
        notes: m.notes ?? '',
        created_by: m.createdById,
        created_at: m.createdAt.toISOString(),
        updated_at: m.updatedAt.toISOString(),
    };
}

export async function getMachines(filters?: {
    reason?: MachineReason;
    status?: MachineStatus;
    search?: string;
}): Promise<MachineRequest[]> {
    const where: Record<string, unknown> = {};

    if (filters?.reason) where.reason = toEnum(filters.reason);
    if (filters?.status) where.status = filters.status;
    if (filters?.search) {
        where.OR = [
            { requesterName: { contains: filters.search, mode: 'insensitive' } },
            { userName: { contains: filters.search, mode: 'insensitive' } },
            { workEmail: { contains: filters.search, mode: 'insensitive' } },
        ];
    }

    const machines = await prisma.machineRequest.findMany({
        where: where as Parameters<typeof prisma.machineRequest.findMany>[0]['where'],
        orderBy: { number: 'desc' },
    });
    return machines.map(serializeMachine);
}

export async function addMachine(input: CreateMachineInput): Promise<MachineRequest> {
    const session = await auth();
    const machine = await prisma.machineRequest.create({
        data: {
            date: input.date ? new Date(input.date) : null,
            requesterName: input.requester_name,
            userName: input.user_name,
            workEmail: input.work_email,
            reason: toEnum(input.reason) as never,
            importance: input.importance as never,
            notes: input.notes,
            createdById: session?.user?.id ?? null,
        },
    });
    return serializeMachine(machine);
}

export async function updateMachine(id: string, updates: Partial<MachineRequest>): Promise<MachineRequest> {
    const data: Record<string, unknown> = {};
    if (updates.date !== undefined) data.date = updates.date ? new Date(updates.date) : null;
    if (updates.requester_name !== undefined) data.requesterName = updates.requester_name;
    if (updates.user_name !== undefined) data.userName = updates.user_name;
    if (updates.work_email !== undefined) data.workEmail = updates.work_email;
    if (updates.reason !== undefined) data.reason = toEnum(updates.reason);
    if (updates.importance !== undefined) data.importance = updates.importance;
    if (updates.status !== undefined) data.status = updates.status;
    if (updates.notes !== undefined) data.notes = updates.notes;

    const machine = await prisma.machineRequest.update({
        where: { id },
        data: data as Parameters<typeof prisma.machineRequest.update>[0]['data'],
    });
    return serializeMachine(machine);
}

export async function deleteMachine(id: string): Promise<void> {
    await prisma.machineRequest.delete({ where: { id } });
}

export async function getMachineStats() {
    const machines: Array<{ reason: string; status: string; importance: string }> = await prisma.machineRequest.findMany({
        select: { reason: true, status: true, importance: true },
    });
    return {
        total: machines.length,
        pending: machines.filter(m => m.status === 'pending').length,
        fulfilled: machines.filter(m => m.status === 'fulfilled').length,
        rejected: machines.filter(m => m.status === 'rejected').length,
        oldHardware: machines.filter(m => m.reason === 'old_hardware').length,
        faulty: machines.filter(m => m.reason === 'faulty').length,
        newUser: machines.filter(m => m.reason === 'new_user').length,
    };
}
