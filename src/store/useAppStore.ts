import { create } from 'zustand';
import type { Profile, ImportanceLevel, MachineReason, MachineStatus, TicketCategory, TicketPriority, TicketStatus } from '@/types/database';

interface AppState {
    profile: Profile | null;
    setProfile: (profile: Profile | null) => void;

    sidebarOpen: boolean;
    toggleSidebar: () => void;
    setSidebarOpen: (open: boolean) => void;

    // Entry filters
    entryFilter: 'all' | 'sorted' | 'pending';
    entryDateRange: 'today' | 'week' | 'month' | 'year' | undefined;
    entrySearch: string;
    setEntryFilter: (f: 'all' | 'sorted' | 'pending') => void;
    setEntryDateRange: (r: 'today' | 'week' | 'month' | 'year' | undefined) => void;
    setEntrySearch: (s: string) => void;

    // Task filters
    taskFilter: 'all' | 'completed' | 'pending';
    taskImportance: ImportanceLevel | 'all';
    taskSearch: string;
    setTaskFilter: (f: 'all' | 'completed' | 'pending') => void;
    setTaskImportance: (i: ImportanceLevel | 'all') => void;
    setTaskSearch: (s: string) => void;

    // Machine filters
    machineReason: MachineReason | 'all';
    machineStatus: MachineStatus | 'all';
    machineSearch: string;
    setMachineReason: (r: MachineReason | 'all') => void;
    setMachineStatus: (s: MachineStatus | 'all') => void;
    setMachineSearch: (s: string) => void;

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
    profile: null,
    setProfile: (profile) => set({ profile }),

    sidebarOpen: true,
    toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
    setSidebarOpen: (open) => set({ sidebarOpen: open }),

    entryFilter: 'all',
    entryDateRange: undefined,
    entrySearch: '',
    setEntryFilter: (entryFilter) => set({ entryFilter }),
    setEntryDateRange: (entryDateRange) => set({ entryDateRange }),
    setEntrySearch: (entrySearch) => set({ entrySearch }),

    taskFilter: 'all',
    taskImportance: 'all',
    taskSearch: '',
    setTaskFilter: (taskFilter) => set({ taskFilter }),
    setTaskImportance: (taskImportance) => set({ taskImportance }),
    setTaskSearch: (taskSearch) => set({ taskSearch }),

    machineReason: 'all',
    machineStatus: 'all',
    machineSearch: '',
    setMachineReason: (machineReason) => set({ machineReason }),
    setMachineStatus: (machineStatus) => set({ machineStatus }),
    setMachineSearch: (machineSearch) => set({ machineSearch }),

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
