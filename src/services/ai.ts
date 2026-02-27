'use server';

import type { TicketCategory, TicketPriority, TicketSentiment } from '@/types/database';

export interface DeflectionSuggestion {
    title: string;
    description: string;
}

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

async function callOpenAI(systemPrompt: string, userMessage: string, forceJson: boolean = false) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        throw new Error("OPENAI_API_KEY is missing from environment variables.");
    }

    const payload: Record<string, unknown> = {
        model: 'gpt-4o-mini',
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
        ]
    };

    if (forceJson) {
        payload.response_format = { type: 'json_object' };
    }

    const res = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(payload)
    });

    if (!res.ok) {
        const errorData = await res.text();
        throw new Error(`OpenAI API Error: ${res.status} - ${errorData}`);
    }

    const data = await res.json();
    return data.choices[0].message.content;
}

export async function generateDeflectionSuggestions(subject: string, description: string): Promise<DeflectionSuggestion[]> {
    const systemPrompt = `You are an IT Support AI. 
Analyze the user's issue and provide 0 to 2 potential self-service solutions. 
If the issue requires IT intervention (like physical hardware replacement), return an empty array.
If it's common (like printer, password reset), provide clear steps.
Respond STRICTLY as a JSON object containing an array called "suggestions", where each object has "title" and "description".`;

    // Validation & Length Limiting
    const safeSubject = subject.trim().substring(0, 150);
    const safeDesc = description.trim().substring(0, 1000);

    if (!safeSubject && !safeDesc) return [];

    try {
        const result = await callOpenAI(systemPrompt, `Subject: ${safeSubject}\n\nDescription: ${safeDesc}`, true);
        const parsed = JSON.parse(result);
        return parsed.suggestions || [];
    } catch (e: unknown) {
        console.error("Deflection AI Error:", (e as Error).message || e);
        return []; // Fail gracefully back to empty list 
    }
}

export async function categorizeAndPrioritizeTicket(
    subject: string,
    description: string
): Promise<{ category: TicketCategory; priority: TicketPriority; sentiment: TicketSentiment }> {

    const systemPrompt = `Analyze the IT support ticket and classify it.
Reply STRICTLY with a JSON object containing exactly 3 keys:
1. "category": Must be exactly one of ["email", "account-login", "password-reset", "hardware", "software", "network-vpn", "other"]
2. "priority": Must be exactly one of ["critical", "high", "medium", "low"]
3. "sentiment": Analyze the tone of the user's text. Must be exactly one of ["positive", "neutral", "frustrated", "angry"]. If they use swear words, exclamation marks, all caps complaining, aggressive language about blockers, classify as angry or frustrated. Otherwise neutral.

Always return valid JSON.`;

    // Validation & Length Limiting
    const safeSubject = subject.trim().substring(0, 150);
    const safeDesc = description.trim().substring(0, 1000);

    try {
        const result = await callOpenAI(systemPrompt, `Subject: ${safeSubject}\n\nDescription: ${safeDesc}`, true);
        const parsed = JSON.parse(result);
        return {
            category: parsed.category as TicketCategory || 'other',
            priority: parsed.priority as TicketPriority || 'medium',
            sentiment: parsed.sentiment as TicketSentiment || 'neutral'
        };
    } catch (e: unknown) {
        console.error("Categorize AI Error:", (e as Error).message || e);
        // Fail gracefully to defaults if API fails or key is missing
        return { category: 'other', priority: 'medium', sentiment: 'neutral' };
    }
}

export async function generateTicketSummary(description: string, resolution_notes?: string): Promise<string> {
    if (description.length < 100 && !resolution_notes) {
        return "Ticket description is short; no summary needed.";
    }

    const systemPrompt = `You are an IT Assistant. Summarize this ticket in exactly 1-2 short sentences so an IT admin can glance at it and know exactly what is going on.
If resolution notes are provided, include how it was resolved final sentence.`;

    let prompt = `Description: ${description}`;
    if (resolution_notes) {
        prompt += `\n\nResolution Notes: ${resolution_notes}`;
    }

    try {
        const summary = await callOpenAI(systemPrompt, prompt);
        return summary.trim();
    } catch (e: unknown) {
        console.error("Summary AI Error:", e);
        return "AI Summary is temporarily unavailable.";
    }
}
