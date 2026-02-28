'use server';

import { query, queryOne } from '@/lib/db';
import type { TicketCategory, TicketPriority, TicketSentiment } from '@/types/database';

export interface DeflectionSuggestion {
    id: string;
    title: string;
    category: string;
    description: string;
}

export async function getAiResponse(ticketId: string, context?: string) {
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

export async function generateTicketSummary(ticketId: string) {
    return summarizeTicket(ticketId);
}

export async function generateDeflectionSuggestions(subject: string, _description: string): Promise<DeflectionSuggestion[]> {
    const articles = await query<DeflectionSuggestion>(
        'SELECT id, title, category, description FROM kb_articles WHERE title LIKE ? OR content LIKE ? LIMIT 3',
        `%${subject}%`, `%${subject}%`
    );
    return articles;
}

export async function categorizeAndPrioritizeTicket(subject: string, description: string): Promise<{ category: TicketCategory; priority: TicketPriority; sentiment: TicketSentiment }> {
    const s = subject.toLowerCase();
    const d = description.toLowerCase();

    let category: TicketCategory = 'other';
    if (s.includes('email') || d.includes('email')) category = 'email';
    else if (s.includes('password') || d.includes('password')) category = 'password-reset';
    else if (s.includes('login') || d.includes('login')) category = 'account-login';
    else if (s.includes('hardware') || d.includes('hardware')) category = 'hardware';
    else if (s.includes('software') || d.includes('software')) category = 'software';
    else if (s.includes('network') || d.includes('vpn')) category = 'network-vpn';

    const priority: TicketPriority = (s.includes('urgent') || d.includes('urgent')) ? 'high' : 'medium';
    const sentiment: TicketSentiment = (s.includes('urgent') || d.includes('frustrated') || d.includes('angry')) ? 'frustrated' : 'neutral';
    return { category, priority, sentiment };
}
