'use server';

import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import type { Task, CreateTaskInput, ImportanceLevel } from '@/types/database';

function serializeTask(t: {
    id: string; date: Date | null; text: string; importance: string;
    completed: boolean; createdById: string | null; createdAt: Date; updatedAt: Date;
}): Task {
    return {
        id: t.id,
        date: t.date?.toISOString().split('T')[0] ?? '',
        text: t.text,
        importance: t.importance as ImportanceLevel,
        completed: t.completed,
        created_by: t.createdById,
        created_at: t.createdAt.toISOString(),
        updated_at: t.updatedAt.toISOString(),
    };
}

export async function getTasks(filters?: {
    completed?: boolean;
    importance?: ImportanceLevel;
    search?: string;
}): Promise<Task[]> {
    const where: Record<string, unknown> = {};

    if (filters?.completed !== undefined) where.completed = filters.completed;
    if (filters?.importance) where.importance = filters.importance;
    if (filters?.search) where.text = { contains: filters.search, mode: 'insensitive' };

    const tasks = await prisma.task.findMany({
        where: where as any,
        orderBy: { date: 'desc' },
    });
    return tasks.map(serializeTask);
}

export async function addTask(input: CreateTaskInput): Promise<Task> {
    const session = await auth();
    const task = await prisma.task.create({
        data: {
            date: input.date ? new Date(input.date) : null,
            text: input.text,
            importance: input.importance as never,
            createdById: session?.user?.id ?? null,
        },
    });
    return serializeTask(task);
}

export async function updateTask(id: string, updates: Partial<Task>): Promise<Task> {
    const data: Record<string, unknown> = {};
    if (updates.date !== undefined) data.date = updates.date ? new Date(updates.date) : null;
    if (updates.text !== undefined) data.text = updates.text;
    if (updates.importance !== undefined) data.importance = updates.importance;
    if (updates.completed !== undefined) data.completed = updates.completed;

    const task = await prisma.task.update({
        where: { id },
        data: data as any,
    });
    return serializeTask(task);
}

export async function deleteTask(id: string): Promise<void> {
    await prisma.task.delete({ where: { id } });
}

export async function getTaskStats() {
    const tasks: Array<{ importance: string; completed: boolean }> = await prisma.task.findMany({
        select: { importance: true, completed: true },
    });
    return {
        total: tasks.length,
        completed: tasks.filter(t => t.completed).length,
        pending: tasks.filter(t => !t.completed).length,
        urgent: tasks.filter(t => t.importance === 'urgent').length,
        important: tasks.filter(t => t.importance === 'important').length,
        neutral: tasks.filter(t => t.importance === 'neutral').length,
    };
}
