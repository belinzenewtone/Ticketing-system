'use server';

import { query, queryOne, execute } from '@/lib/db';
import { auth } from '@/auth';

export async function getAiResponse(ticketId: string, context?: string) {
    // This previously might have used Prisma to fetch ticket details
    // Now we fetch via SQL
    const ticket = await queryOne<any>('SELECT * FROM tickets WHERE id = ?', ticketId);
    if (!ticket) throw new Error('Ticket not found');

    const prompt = `
        You are an IT support assistant for JTL.
        Ticket Subject: ${ticket.subject}
        Ticket Description: ${ticket.description}
        ${context ? `Question/Context: ${context}` : ''}
        Provide a helpful, professional response to the employee.
    `;

    // Simulate AI response logic (or call an API if configured)
    const response = "Based on the ticket description, this appears to be a common issue. Please try restarting the application and clearing your cache. If the issue persists, let us know.";

    return { response };
}

export async function summarizeTicket(ticketId: string) {
    const ticket = await queryOne<any>('SELECT * FROM tickets WHERE id = ?', ticketId);
    if (!ticket) throw new Error('Ticket not found');

    return { summary: `Summary of ticket ${ticket.number}: ${ticket.subject}. Assigned to ${ticket.assigned_to || 'unassigned'}.` };
}
