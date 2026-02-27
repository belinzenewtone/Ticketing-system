'use server';

import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import type { KbArticle, CreateKbArticleInput, TicketCategory } from '@/types/database';

// Prisma enum values use underscores; our TypeScript interfaces use hyphens
function fromEnum(val: string): string { return val.replace(/_/g, '-'); }
function toEnum(val: string): string { return val.replace(/-/g, '_'); }

function serializeKbArticle(a: {
    id: string; title: string; content: string; category: string | null;
    createdById: string | null; createdAt: Date; updatedAt: Date;
}): KbArticle {
    return {
        id: a.id,
        title: a.title,
        content: a.content,
        category: a.category ? fromEnum(a.category) as TicketCategory : null,
        created_by: a.createdById,
        created_at: a.createdAt.toISOString(),
        updated_at: a.updatedAt.toISOString(),
    };
}

export async function getKbArticles(filters?: {
    category?: TicketCategory | null;
    search?: string;
}): Promise<KbArticle[]> {
    const where: Record<string, unknown> = {};

    if (filters?.category) where.category = toEnum(filters.category);
    if (filters?.search) {
        where.OR = [
            { title: { contains: filters.search, mode: 'insensitive' } },
            { content: { contains: filters.search, mode: 'insensitive' } },
        ];
    }

    const articles = await prisma.kbArticle.findMany({
        where: where as Parameters<typeof prisma.kbArticle.findMany>[0]['where'],
        orderBy: { createdAt: 'desc' },
    });
    return articles.map(serializeKbArticle);
}

export async function addKbArticle(input: CreateKbArticleInput): Promise<KbArticle> {
    const session = await auth();
    const article = await prisma.kbArticle.create({
        data: {
            title: input.title,
            content: input.content,
            category: input.category ? toEnum(input.category) as never : null,
            createdById: session?.user?.id ?? null,
        },
    });
    return serializeKbArticle(article);
}

export async function updateKbArticle(id: string, updates: Partial<KbArticle>): Promise<KbArticle> {
    const data: Record<string, unknown> = {};
    if (updates.title !== undefined) data.title = updates.title;
    if (updates.content !== undefined) data.content = updates.content;
    if (updates.category !== undefined) data.category = updates.category ? toEnum(updates.category) : null;

    const article = await prisma.kbArticle.update({
        where: { id },
        data: data as Parameters<typeof prisma.kbArticle.update>[0]['data'],
    });
    return serializeKbArticle(article);
}

export async function deleteKbArticle(id: string): Promise<void> {
    await prisma.kbArticle.delete({ where: { id } });
}
