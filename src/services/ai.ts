'use server';

import type { TicketCategory, TicketPriority } from '@/types/database';

export interface DeflectionSuggestion {
    title: string;
    description: string;
}

export async function generateDeflectionSuggestions(subject: string, description: string): Promise<DeflectionSuggestion[]> {
    // Mock API delay
    await new Promise((resolve) => setTimeout(resolve, 800));

    const text = `${subject} ${description}`.toLowerCase();

    if (text.includes('password') || text.includes('login') || text.includes('account')) {
        return [
            { title: 'Self-Service Password Reset', description: 'You can reset your password using the "Forgot Password" link on the login page.' },
            { title: 'Account Lockout Helper', description: 'Accounts automatically unlock after 15 minutes of inactivity.' }
        ];
    }

    if (text.includes('printer') || text.includes('printing')) {
        return [
            { title: 'Connecting to Office Printers', description: 'Make sure you are on the corporate network, then add the printer via Windows Settings -> Devices.' }
        ];
    }

    if (text.includes('vpn') || text.includes('network')) {
        return [
            { title: 'VPN Troubleshooting Guide', description: 'Ensure your Cisco AnyConnect client is up to date and restart your device before trying again.' }
        ];
    }

    // Return empty array if no obvious deflections are found
    return [];
}

export async function categorizeAndPrioritizeTicket(
    subject: string,
    description: string
): Promise<{ category: TicketCategory; priority: TicketPriority }> {
    // Mock API delay
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const text = `${subject} ${description}`.toLowerCase();

    let category: TicketCategory = 'other';
    let priority: TicketPriority = 'medium';

    // Heuristics for category
    if (text.includes('password') || text.includes('login')) {
        category = 'account-login';
    } else if (text.includes('email') || text.includes('outlook')) {
        category = 'email';
    } else if (text.includes('vpn') || text.includes('wifi') || text.includes('internet') || text.includes('network')) {
        category = 'network-vpn';
    } else if (text.includes('laptop') || text.includes('monitor') || text.includes('keyboard') || text.includes('hardware')) {
        category = 'hardware';
    } else if (text.includes('install') || text.includes('app') || text.includes('software')) {
        category = 'software';
    }

    // Heuristics for priority
    if (text.includes('urgent') || text.includes('emergency') || text.includes('critical') || text.includes('down')) {
        priority = 'critical';
    } else if (text.includes('asap') || text.includes('high') || text.includes('blocked')) {
        priority = 'high';
    } else if (text.includes('minor') || text.includes('low') || text.includes('whenever')) {
        priority = 'low';
    }

    return { category, priority };
}

export async function generateTicketSummary(description: string, resolution_notes?: string): Promise<string> {
    await new Promise((resolve) => setTimeout(resolve, 1000));

    if (description.length < 100) {
        return "Ticket description is short; no summary needed.";
    }

    return `AI Summary: The user encountered a technical issue requiring IT support. ${resolution_notes ? 'The issue has since been addressed.' : 'Awaiting resolution.'
        }`;
}
