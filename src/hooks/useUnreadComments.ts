'use client';

import { useState, useEffect, useCallback } from 'react';

/**
 * A simple hook to track if a ticket has unread comments based on the number of comments 
 * currently in the database vs what was last seen/opened by the user.
 */
export function useUnreadComments() {
    // Store in format: { "ticketId": lastSeenCommentCount }
    const [readCounts, setReadCounts] = useState<Record<string, number>>({});

    useEffect(() => {
        // Load on mount
        try {
            const stored = localStorage.getItem('ticket_read_counts');
            if (stored) {
                setReadCounts(JSON.parse(stored));
            }
        } catch (e) {
            console.error('Failed to load read counts from storage', e);
        }
    }, []);

    const markTicketAsRead = useCallback((ticketId: string, currentCommentCount: number) => {
        setReadCounts(prev => {
            if (prev[ticketId] === currentCommentCount) {
                return prev;
            }
            const next = { ...prev, [ticketId]: currentCommentCount };
            try {
                localStorage.setItem('ticket_read_counts', JSON.stringify(next));
            } catch (e) {
                console.error('Failed to save read counts to storage', e);
            }
            return next;
        });
    }, []);

    const hasUnread = useCallback((ticketId: string, currentCommentCount: number) => {
        const lastSeen = readCounts[ticketId] || 0;
        return currentCommentCount > lastSeen;
    }, [readCounts]);

    return {
        readCounts,
        markTicketAsRead,
        hasUnread
    };
}
