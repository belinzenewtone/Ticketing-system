import { create } from 'zustand';
import type { ImportanceLevel, TicketCategory, TicketPriority, TicketStatus } from '@/types/database';

interface AppState {
    // Task filters
    taskFilter: 'all' | 'completed' | 'pending';
    taskImportance: ImportanceLevel | 'all';
    taskSearch: string;
    setTaskFilter: (f: 'all' | 'completed' | 'pending') => void;
    setTaskImportance: (i: ImportanceLevel | 'all') => void;
    setTaskSearch: (s: string) => void;

    // Ticket filters
    ticketCategory: TicketCategory | 'all';
    ticketPriority: TicketPriority | 'all';
    ticketStatus: TicketStatus | 'all';
    ticketSearch: string;
    ticketDateRange: 'today' | 'week' | 'month' | 'year' | undefined;
    setTicketCategory: (c: TicketCategory | 'all') => void;
    setTicketPriority: (p: TicketPriority | 'all') => void;
    setTicketStatus: (s: TicketStatus | 'all') => void;
    setTicketSearch: (s: string) => void;
    setTicketDateRange: (r: 'today' | 'week' | 'month' | 'year' | undefined) => void;
}

export const useAppStore = create<AppState>((set) => ({
    taskFilter: 'all',
    taskImportance: 'all',
    taskSearch: '',
    setTaskFilter: (taskFilter) => set({ taskFilter }),
    setTaskImportance: (taskImportance) => set({ taskImportance }),
    setTaskSearch: (taskSearch) => set({ taskSearch }),

    ticketCategory: 'all',
    ticketPriority: 'all',
    ticketStatus: 'all',
    ticketSearch: '',
    ticketDateRange: undefined,
    setTicketCategory: (ticketCategory) => set({ ticketCategory }),
    setTicketPriority: (ticketPriority) => set({ ticketPriority }),
    setTicketStatus: (ticketStatus) => set({ ticketStatus }),
    setTicketSearch: (ticketSearch) => set({ ticketSearch }),
    setTicketDateRange: (ticketDateRange) => set({ ticketDateRange }),
}));
