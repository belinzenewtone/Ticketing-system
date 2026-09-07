'use client';

import { useUnreadComments } from '@/hooks/useUnreadComments';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { getTickets, addTicket, updateTicket, deleteTicket } from '@/services/tickets';
import { uploadTicketAttachment } from '@/services/storage';
import { getITStaff } from '@/services/auth-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
    Dialog, DialogContent, DialogClose, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useAppStore } from '@/store/useAppStore';
import {
    Plus, Search, Ticket, CircleCheckBig, Loader2, Archive, MessageSquare,
    Paperclip, Pencil, Trash2, BookOpen, X, Bot, Sparkles, Package,
    Monitor as MonitorIcon, Laptop as LaptopIcon, ChevronRight, User,
} from 'lucide-react';
import { toast } from 'sonner';
import { useState, useCallback, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { TicketCategory, TicketPriority, TicketStatus, CreateTicketInput, Ticket as TicketType, KbArticle, MachineRequest } from '@/types/database';
import { generateDeflectionSuggestions, categorizeAndPrioritizeTicket, type DeflectionSuggestion } from '@/services/ai';
import { getKbArticles } from '@/services/knowledgeBase';
import { addMachine, getMachines } from '@/services/machines';
import { ChatInterface } from '@/components/ChatInterface';
import { PageTransition } from '@/components/PageTransition';

// ── Config maps ──────────────────────────────────────────────
const categoryConfig: Record<TicketCategory, { label: string; icon: string }> = {
    email: { label: 'Email', icon: '📧' },
    'account-login': { label: 'Account / Login', icon: '🔐' },
    'password-reset': { label: 'Password Reset', icon: '🔑' },
    hardware: { label: 'Hardware', icon: '💻' },
    software: { label: 'Software', icon: '📦' },
    'network-vpn': { label: 'Network / VPN', icon: '🌐' },
    other: { label: 'Other', icon: '📋' },
};

const statusConfig: Record<TicketStatus, { label: string; color: string; dot: string }> = {
    open:        { label: 'Open',        color: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-400 dark:border-sky-800',         dot: 'bg-sky-500' },
    'in-progress':{ label: 'In Progress', color: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800', dot: 'bg-amber-500' },
    resolved:    { label: 'Resolved',    color: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800', dot: 'bg-emerald-500' },
    closed:      { label: 'Closed',      color: 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700', dot: 'bg-slate-400' },
};

const priorityBorder: Record<string, string> = {
    critical: 'border-l-red-500',
    high:     'border-l-orange-400',
    medium:   'border-l-sky-400',
    low:      'border-l-slate-300 dark:border-l-slate-600',
};

const importanceBorder: Record<string, string> = {
    urgent:    'border-l-red-500',
    important: 'border-l-amber-400',
    neutral:   'border-l-slate-300 dark:border-l-slate-600',
};

const reasonLabels: Record<string, string> = {
    'old-hardware': 'Old Hardware',
    faulty: 'Faulty',
    'new-user': 'New User Onboarding',
};

// ── Validation ───────────────────────────────────────────────
const ticketSchema = z.object({
    category: z.enum(['email', 'account-login', 'password-reset', 'hardware', 'software', 'network-vpn', 'other']),
    subject: z.string().min(3, 'Subject required'),
    description: z.string().optional(),
});

const requestItemSchema = z.object({
    item_type: z.enum(['supplies', 'desktop', 'laptop']),
    date: z.string().min(1, 'Date required'),
    requester_name: z.string().min(2, 'Name required'),
    work_email: z.string().email().refine(e => e.endsWith('@jtl.co.ke'), 'Must be @jtl.co.ke'),
    importance: z.enum(['urgent', 'important', 'neutral']),
    item_count: z.coerce.number().int().min(1).max(999),
    supply_name: z.string().optional(),
    reason: z.enum(['old-hardware', 'faulty', 'new-user']).optional(),
    notes: z.string().optional(),
});

type FormValues = z.infer<typeof ticketSchema>;
type RequestItemValues = z.infer<typeof requestItemSchema>;

// ── Helpers ──────────────────────────────────────────────────
function Initials({ name }: { name?: string | null }) {
    const letters = (name || 'U')
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map(w => w[0].toUpperCase())
        .join('');
    return <>{letters}</>;
}

// ── Page ─────────────────────────────────────────────────────
export default function PortalPage() {
    const { profile } = useAppStore();
    const { readCounts, isInitialized, markTicketAsRead } = useUnreadComments();
    const [formOpen, setFormOpen] = useState(false);
    const [requestItemOpen, setRequestItemOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [viewNotesTicket, setViewNotesTicket] = useState<TicketType | null>(null);
    const [viewNotesMachine, setViewNotesMachine] = useState<MachineRequest | null>(null);
    const [editingTicketId, setEditingTicketId] = useState<string | null>(null);
    const [attachment, setAttachment] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [deflections, setDeflections] = useState<DeflectionSuggestion[]>([]);
    const [isCheckingDeflection, setIsCheckingDeflection] = useState(false);
    const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);
    const [aiCooldown, setAiCooldown] = useState(false);
    const [kbArticles, setKbArticles] = useState<KbArticle[]>([]);
    const [expandedKbId, setExpandedKbId] = useState<string | null>(null);
    const [viewCommentsTicket, setViewCommentsTicket] = useState<TicketType | null>(null);
    const [viewCommentsMachine, setViewCommentsMachine] = useState<MachineRequest | null>(null);

    const queryClient = useQueryClient();

    const { data: staffList } = useQuery({ queryKey: ['staff'], queryFn: getITStaff });
    const staffMap = staffList?.reduce((acc, s) => { acc[s.id] = s.name ?? ''; return acc; }, {} as Record<string, string>) || {};

    const { data: tickets, isLoading } = useQuery({
        queryKey: ['portal-tickets', profile?.id, search],
        queryFn: () => getTickets({ created_by: profile?.id, search: search || undefined }),
        enabled: !!profile?.id,
        refetchOnWindowFocus: true,
    });

    const { data: userRequests, isLoading: requestsLoading } = useQuery({
        queryKey: ['portal-requests', profile?.id],
        queryFn: () => getMachines({ search: profile?.email || undefined }),
        enabled: !!profile?.id,
    });

    const createMut = useMutation({
        mutationFn: addTicket,
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['portal-tickets'] }); toast.success('Ticket submitted'); handleOpenChange(false); },
        onError: (e: Error) => toast.error(e.message),
    });

    const updateMut = useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<TicketType> }) => updateTicket(id, data),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['portal-tickets'] }); toast.success('Ticket updated'); handleOpenChange(false); },
        onError: (e: Error) => toast.error(e.message),
    });

    const deleteMut = useMutation({
        mutationFn: deleteTicket,
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['portal-tickets'] }); toast.success('Ticket deleted'); },
        onError: (e: Error) => toast.error(e.message),
    });

    const createItemMut = useMutation({
        mutationFn: addMachine,
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['portal-requests'] }); toast.success('Request submitted'); setRequestItemOpen(false); itemForm.reset(); },
        onError: (e: Error) => toast.error(e.message || 'Failed to submit request'),
    });

    const form = useForm<FormValues>({
        resolver: zodResolver(ticketSchema),
        defaultValues: { category: 'email', subject: '', description: '' },
    });

    const itemForm = useForm<RequestItemValues>({
        resolver: zodResolver(requestItemSchema) as any,
        defaultValues: {
            item_type: 'supplies',
            date: new Date().toISOString().split('T')[0],
            requester_name: profile?.name || '',
            work_email: profile?.email || '',
            importance: 'neutral',
            item_count: 1,
            notes: '',
        },
    });

    const handleSubjectBlur = useCallback(async () => {
        const subject = form.getValues('subject');
        if (!subject || subject.length < 3) return;
        try {
            const results = await getKbArticles({ search: subject });
            setKbArticles(results.slice(0, 3));
        } catch { /* silently ignore */ }
    }, [form]);

    const activeItem = viewCommentsTicket || viewCommentsMachine;

    const handleOpenChange = (open: boolean) => {
        setFormOpen(open);
        if (!open) {
            setEditingTicketId(null);
            setAttachment(null);
            setKbArticles([]);
            setExpandedKbId(null);
            form.reset({ category: 'email', subject: '', description: '' });
        }
    };

    const handleEdit = (ticket: TicketType) => {
        setEditingTicketId(ticket.id);
        form.reset({ category: ticket.category, subject: ticket.subject, description: ticket.description || '' });
        setFormOpen(true);
    };

    const handleCheckSolutions = async (e: React.MouseEvent) => {
        e.preventDefault();
        const subject = form.getValues('subject');
        const description = form.getValues('description');
        if (!subject && !description) { toast.error('Please enter a subject or description first.'); return; }
        if (aiCooldown) { toast.info('Please wait a moment before asking AI again.'); return; }
        setIsCheckingDeflection(true);
        setAiCooldown(true);
        setTimeout(() => setAiCooldown(false), 10000);
        try {
            const suggestions = await generateDeflectionSuggestions(subject, description || '');
            setDeflections(suggestions);
            if (suggestions.length === 0) toast.info('No immediate solutions found. Please submit your ticket.');
        } catch { toast.error('AI analysis failed.'); }
        finally { setIsCheckingDeflection(false); }
    };

    const handleSubmit = async (data: FormValues) => {
        if (!profile) return toast.error('Profile not loaded');
        setIsAiAnalyzing(true);
        let aiResult;
        try {
            aiResult = await categorizeAndPrioritizeTicket(data.subject, data.description || '');
        } catch {
            toast.error('AI analysis failed, falling back to defaults.');
            aiResult = { category: 'other' as TicketCategory, priority: 'medium' as TicketPriority, sentiment: 'neutral' as const };
        }
        setIsAiAnalyzing(false);

        let attachment_url = null;
        if (attachment) {
            setIsUploading(true);
            try { attachment_url = await uploadTicketAttachment(attachment); }
            catch (error: unknown) {
                setIsUploading(false);
                return toast.error(`Attachment failed: ${error instanceof Error ? error.message : 'Upload failed'}`);
            }
            setIsUploading(false);
        }

        const fullData: CreateTicketInput = {
            ticket_date: new Date().toISOString().split('T')[0],
            employee_name: profile.name || '',
            department: 'Employee Portal',
            created_by: profile.id,
            attachment_url,
            category: data.category,
            priority: aiResult.priority,
            sentiment: aiResult.sentiment,
            subject: data.subject,
            description: data.description,
        };

        if (editingTicketId) { updateMut.mutate({ id: editingTicketId, data: fullData }); }
        else { createMut.mutate(fullData); }
    };

    const handleItemSubmit = async (data: RequestItemValues) => {
        if (!profile) return toast.error('Profile not loaded');
        if (data.item_type === 'supplies' && !data.supply_name) return toast.error('Please specify the supply name');
        if (data.item_type !== 'supplies' && !data.reason) return toast.error('Please specify the reason for the machine request');
        if (data.supply_name && data.supply_name.length > 20) return toast.error('Supply name cannot exceed 20 characters');

        createItemMut.mutate({
            ...data,
            item_count: data.item_count,
            requested_from: 'portal' as const,
            reason: data.item_type === 'supplies' ? undefined : (data.reason as any),
        } as any);
    };

    const myRequests = userRequests?.filter(r => r.created_by === profile?.id) ?? [];

    // ── Priority dot colours ─────────────────────────────────
    const priorityDot: Record<string, string> = {
        critical: 'bg-red-500', high: 'bg-orange-400', medium: 'bg-sky-400', low: 'bg-slate-400',
    };

    return (
        <PageTransition>
        <div className="space-y-8 pb-16">

            {/* ══════════════════════ HERO ══════════════════════ */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 shadow-2xl shadow-emerald-900/20">
                {/* Decorative circles */}
                <div className="pointer-events-none absolute -right-20 -top-20 h-80 w-80 rounded-full bg-white/5" />
                <div className="pointer-events-none absolute right-16 -bottom-24 h-56 w-56 rounded-full bg-white/5" />
                <div className="pointer-events-none absolute left-1/2 top-0 h-40 w-40 -translate-x-1/2 rounded-full bg-teal-400/10 blur-2xl" />

                <div className="relative p-6 sm:p-8">
                    {/* Top row: identity + stats */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 mb-7">
                        {/* Avatar + name */}
                        <div className="flex items-center gap-4">
                            <div className="h-14 w-14 shrink-0 rounded-2xl border border-white/25 bg-white/20 backdrop-blur-sm flex items-center justify-center text-white font-bold text-xl select-none">
                                <Initials name={profile?.name} />
                            </div>
                            <div>
                                <p className="text-emerald-200 text-xs font-semibold tracking-widest uppercase">IT Self-Service Portal</p>
                                <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mt-0.5" style={{ textWrap: 'balance' } as React.CSSProperties}>
                                    {profile?.name ? `Hi, ${profile.name.split(' ')[0]}` : 'Welcome'}
                                </h1>
                            </div>
                        </div>

                        {/* Stat pills */}
                        <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-end">
                            {[
                                { label: 'Tickets', value: isLoading ? null : tickets?.length ?? 0 },
                                { label: 'Active',  value: isLoading ? null : tickets?.filter(t => t.status === 'open' || t.status === 'in-progress').length ?? 0 },
                                { label: 'Done',    value: isLoading ? null : tickets?.filter(t => t.status === 'resolved' || t.status === 'closed').length ?? 0 },
                            ].map(stat => (
                                <div key={stat.label} className="rounded-xl border border-white/15 bg-white/10 backdrop-blur-sm px-3.5 py-2.5 text-center min-w-[60px]">
                                    <p className="text-white/55 text-[9px] font-bold uppercase tracking-widest">{stat.label}</p>
                                    <p className="text-white text-xl font-bold tabular-nums leading-none mt-0.5">
                                        {stat.value === null ? '…' : stat.value}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* CTA row */}
                    <div className="flex flex-wrap gap-3">
                        <Button
                            onClick={() => setFormOpen(true)}
                            className="bg-white text-emerald-700 hover:bg-emerald-50 font-semibold h-10 px-5 shadow-lg shadow-black/25 border-0"
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            New Ticket
                        </Button>
                        <Button
                            onClick={() => setRequestItemOpen(true)}
                            variant="outline"
                            className="border-white/30 text-white hover:bg-white/10 hover:border-white/50 h-10 px-5 bg-transparent"
                        >
                            <Package className="h-4 w-4 mr-2" />
                            Request Item
                        </Button>
                    </div>
                </div>
            </div>

            {/* ══════════════════════ TICKETS ══════════════════════ */}
            <section>
                {/* Section header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-5">
                    <div className="flex items-center gap-2.5">
                        <h2 className="text-base font-bold text-foreground">Your Tickets</h2>
                        {!isLoading && tickets && (
                            <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 px-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 tabular-nums">
                                {tickets.length}
                            </span>
                        )}
                    </div>
                    <div className="relative w-full sm:w-56">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                        <Input
                            placeholder="Search tickets…"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="pl-9 h-8 text-sm bg-white dark:bg-slate-900"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {isLoading || !profile ? (
                        Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 border-l-4 border-l-slate-200 dark:border-l-slate-700 p-5 space-y-3">
                                <div className="flex justify-between"><Skeleton className="h-3.5 w-12" /><Skeleton className="h-5 w-20 rounded-full" /></div>
                                <Skeleton className="h-5 w-3/4" />
                                <Skeleton className="h-5 w-1/2" />
                                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                                    <Skeleton className="h-4 w-24" />
                                    <Skeleton className="h-7 w-20 rounded-lg" />
                                </div>
                            </div>
                        ))
                    ) : !tickets?.length ? (
                        <div className="col-span-full flex flex-col items-center justify-center py-20 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 text-center">
                            <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                                <Ticket className="h-7 w-7 text-slate-400" />
                            </div>
                            <p className="font-semibold text-foreground mb-1">No tickets yet</p>
                            <p className="text-sm text-muted-foreground mb-5">Report an issue and we'll get on it.</p>
                            <Button onClick={() => setFormOpen(true)} size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white">
                                <Plus className="h-3.5 w-3.5 mr-1.5" /> Create your first ticket
                            </Button>
                        </div>
                    ) : (
                        (tickets ?? []).map(ticket => {
                            const sc = statusConfig[ticket.status];
                            const hasUnread = isInitialized && ticket.public_comment_count > (readCounts[ticket.id] || 0);
                            return (
                                <article
                                    key={ticket.id}
                                    className={cn(
                                        'group relative flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 border-l-4 shadow-sm hover:shadow-md transition-all duration-200',
                                        priorityBorder[ticket.priority] || 'border-l-slate-300',
                                    )}
                                >
                                    <div className="flex-1 flex flex-col p-5">
                                        {/* Top row */}
                                        <div className="flex items-start justify-between gap-2 mb-3">
                                            <div className="flex items-center gap-1.5">
                                                <span className={cn('inline-block h-1.5 w-1.5 rounded-full shrink-0', priorityDot[ticket.priority] || 'bg-slate-400')} />
                                                <span className="font-mono text-[11px] font-semibold text-slate-400">#{ticket.number}</span>
                                            </div>
                                            <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold', sc?.color)}>
                                                <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', sc?.dot)} />
                                                {sc?.label}
                                            </span>
                                        </div>

                                        {/* Subject */}
                                        <h3 className="font-semibold text-foreground leading-snug line-clamp-2 mb-3 text-[15px]" title={ticket.subject}>
                                            {ticket.subject}
                                        </h3>

                                        {/* Category + unread */}
                                        <div className="flex flex-wrap items-center gap-2 mb-auto">
                                            <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-400">
                                                <span>{categoryConfig[ticket.category]?.icon}</span>
                                                {categoryConfig[ticket.category]?.label}
                                            </span>
                                            {hasUnread && (
                                                <button
                                                    onClick={() => setViewCommentsTicket(ticket)}
                                                    className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 dark:bg-red-900/30 px-2.5 py-1 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
                                                >
                                                    <span className="relative flex h-1.5 w-1.5">
                                                        <span className="animate-ping absolute inset-0 rounded-full bg-red-400 opacity-75" />
                                                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
                                                    </span>
                                                    New reply
                                                </button>
                                            )}
                                        </div>

                                        {/* Footer */}
                                        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                                            <div className="min-w-0">
                                                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Assigned to</p>
                                                <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
                                                    {ticket.assigned_to && staffMap[ticket.assigned_to]
                                                        ? staffMap[ticket.assigned_to]
                                                        : <span className="text-slate-400 text-xs font-normal italic">Unassigned</span>}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0">
                                                {ticket.status !== 'closed' && ticket.status !== 'resolved' && (
                                                    <>
                                                        <button
                                                            onClick={() => handleEdit(ticket)}
                                                            title="Edit"
                                                            className="p-1.5 rounded-lg text-slate-400 hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                                        >
                                                            <Pencil className="h-3.5 w-3.5" />
                                                        </button>
                                                        <AlertDialog>
                                                            <AlertDialogTrigger asChild>
                                                                <button
                                                                    title="Delete"
                                                                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                                                                >
                                                                    <Trash2 className="h-3.5 w-3.5" />
                                                                </button>
                                                            </AlertDialogTrigger>
                                                            <AlertDialogContent>
                                                                <AlertDialogHeader>
                                                                    <AlertDialogTitle>Delete Ticket #{ticket.number}?</AlertDialogTitle>
                                                                    <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                                                                </AlertDialogHeader>
                                                                <AlertDialogFooter>
                                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                    <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white" onClick={() => deleteMut.mutate(ticket.id)}>Delete</AlertDialogAction>
                                                                </AlertDialogFooter>
                                                            </AlertDialogContent>
                                                        </AlertDialog>
                                                    </>
                                                )}
                                                {ticket.resolution_notes && (
                                                    <button
                                                        onClick={() => setViewNotesTicket(ticket)}
                                                        title="View IT notes"
                                                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors"
                                                    >
                                                        <MessageSquare className="h-3.5 w-3.5" /> Notes
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => setViewCommentsTicket(ticket)}
                                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-sky-700 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/30 transition-colors"
                                                >
                                                    <MessageSquare className="h-3.5 w-3.5" /> Updates
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Date watermark on hover */}
                                    <span className="absolute bottom-4 right-4 text-[10px] text-slate-300 dark:text-slate-700 font-mono opacity-0 group-hover:opacity-100 transition-opacity select-none">
                                        {ticket.ticket_date}
                                    </span>
                                </article>
                            );
                        })
                    )}
                </div>
            </section>

            {/* ══════════════════════ REQUESTS ══════════════════════ */}
            <section>
                <div className="flex items-center gap-2.5 mb-5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/40">
                        <Package className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <h2 className="text-base font-bold text-foreground">Item Requests</h2>
                    {!requestsLoading && (
                        <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 px-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 tabular-nums">
                            {myRequests.length}
                        </span>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {requestsLoading || !profile ? (
                        Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 border-l-4 border-l-slate-200 dark:border-l-slate-700 p-5 space-y-3">
                                <Skeleton className="h-4 w-3/4" />
                                <Skeleton className="h-4 w-1/2" />
                                <Skeleton className="h-4 w-2/3" />
                            </div>
                        ))
                    ) : myRequests.length === 0 ? (
                        <div className="col-span-full flex flex-col items-center justify-center py-16 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 text-center">
                            <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                                <Package className="h-7 w-7 text-slate-400" />
                            </div>
                            <p className="font-semibold text-foreground mb-1">No requests yet</p>
                            <p className="text-sm text-muted-foreground mb-5">Need supplies or hardware? Submit a request.</p>
                            <Button onClick={() => setRequestItemOpen(true)} size="sm" variant="outline">
                                <Plus className="h-3.5 w-3.5 mr-1.5" /> Request an item
                            </Button>
                        </div>
                    ) : (
                        myRequests.map(req => {
                            const statusColor =
                                req.status === 'fulfilled' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800' :
                                req.status === 'rejected'  ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800' :
                                                             'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800';
                            const statusDot =
                                req.status === 'fulfilled' ? 'bg-emerald-500' :
                                req.status === 'rejected'  ? 'bg-red-500' : 'bg-amber-500';
                            const statusLabel =
                                req.status === 'fulfilled' ? 'Fulfilled' :
                                req.status === 'rejected'  ? 'Rejected' : 'Pending';
                            const hasUnread = isInitialized && req.public_comment_count > (readCounts[req.id] || 0);

                            const itemLabel =
                                req.item_type === 'supplies' ? (req.supply_name || 'Supplies') :
                                req.item_type === 'desktop' ? 'Desktop PC' : 'Laptop';

                            return (
                                <article
                                    key={req.id}
                                    className={cn(
                                        'group relative flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 border-l-4 shadow-sm hover:shadow-md transition-all duration-200',
                                        importanceBorder[req.importance] || 'border-l-slate-300',
                                    )}
                                >
                                    <div className="flex-1 flex flex-col p-5">
                                        {/* Top row */}
                                        <div className="flex items-start justify-between gap-2 mb-3">
                                            <div className="flex items-center gap-2">
                                                <div className={cn(
                                                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                                                    req.item_type === 'supplies' ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-sky-100 dark:bg-sky-900/30'
                                                )}>
                                                    {req.item_type === 'supplies'
                                                        ? <Package className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                                                        : req.item_type === 'desktop'
                                                            ? <MonitorIcon className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                                                            : <LaptopIcon className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                                                    }
                                                </div>
                                                <div>
                                                    <p className="font-mono text-[10px] text-slate-400">#{req.number || 'REQ'}</p>
                                                    <h3 className="font-semibold text-[15px] text-foreground leading-tight capitalize">{itemLabel}</h3>
                                                </div>
                                            </div>
                                            <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold shrink-0', statusColor)}>
                                                <span className={cn('h-1.5 w-1.5 rounded-full', statusDot)} />
                                                {statusLabel}
                                            </span>
                                        </div>

                                        {/* Details */}
                                        <div className="space-y-1.5 mb-auto">
                                            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                                                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 w-16 shrink-0">Reason</span>
                                                <span className="font-medium truncate">
                                                    {req.item_type === 'supplies'
                                                        ? (req.supply_name || 'Standard supplies')
                                                        : (req.reason ? reasonLabels[req.reason as string] || req.reason : 'Hardware request')}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                                                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 w-16 shrink-0">Qty</span>
                                                <span className="font-bold tabular-nums">{req.item_count}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                                                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 w-16 shrink-0">Priority</span>
                                                <span className={cn(
                                                    'text-[11px] font-bold uppercase',
                                                    req.importance === 'urgent' ? 'text-red-500' :
                                                    req.importance === 'important' ? 'text-amber-500' : 'text-slate-400'
                                                )}>{req.importance}</span>
                                            </div>
                                        </div>

                                        {/* Footer */}
                                        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-1">
                                            {hasUnread && (
                                                <button
                                                    onClick={() => setViewCommentsMachine(req)}
                                                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-red-600 bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
                                                >
                                                    <span className="relative flex h-1.5 w-1.5">
                                                        <span className="animate-ping absolute inset-0 rounded-full bg-red-400 opacity-75" />
                                                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
                                                    </span>
                                                    New update
                                                </button>
                                            )}
                                            {req.resolution_notes && (
                                                <button
                                                    onClick={() => setViewNotesMachine(req)}
                                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors"
                                                >
                                                    <MessageSquare className="h-3.5 w-3.5" /> Notes
                                                </button>
                                            )}
                                            <button
                                                onClick={() => setViewCommentsMachine(req)}
                                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-sky-700 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/30 transition-colors"
                                            >
                                                <MessageSquare className="h-3.5 w-3.5" /> Updates
                                            </button>
                                        </div>
                                    </div>
                                </article>
                            );
                        })
                    )}
                </div>
            </section>
        </div>

        {/* ══════════════════════ DIALOGS ══════════════════════ */}

        {/* ── Report / Edit Ticket ── */}
        <Dialog open={formOpen} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-[520px] p-0 overflow-hidden gap-0">
                {/* Coloured header stripe */}
                <div className="bg-gradient-to-r from-emerald-600 to-teal-700 px-6 py-5">
                    <DialogTitle className="text-white text-lg font-bold">
                        {editingTicketId ? 'Edit Ticket' : 'Report an Issue'}
                    </DialogTitle>
                    <DialogDescription className="text-emerald-100 text-sm mt-0.5">
                        {editingTicketId ? 'Update your ticket details below.' : 'Describe the problem — AI will prioritise it automatically.'}
                    </DialogDescription>
                </div>

                <div className="max-h-[75vh] overflow-y-auto">
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="px-6 py-5 space-y-5">

                        {/* AI deflection suggestions */}
                        {deflections.length > 0 && (
                            <div className="rounded-xl border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-950/20 p-4">
                                <h4 className="flex items-center gap-2 text-sm font-bold text-emerald-800 dark:text-emerald-400 mb-3">
                                    <Sparkles className="w-4 h-4" /> Try these first
                                </h4>
                                <div className="space-y-2">
                                    {deflections.map((def, idx) => (
                                        <div key={idx} className="rounded-lg bg-white dark:bg-slate-900 border border-emerald-100 dark:border-emerald-900/40 p-3 text-sm">
                                            <p className="font-semibold text-slate-800 dark:text-slate-200">{def.title}</p>
                                            <p className="text-slate-500 dark:text-slate-400 mt-1 leading-relaxed text-xs">{def.description}</p>
                                        </div>
                                    ))}
                                </div>
                                <p className="mt-3 text-xs text-emerald-600 dark:text-emerald-500 italic">Still blocked? Submit your ticket below.</p>
                            </div>
                        )}

                        {/* Category — icon grid */}
                        <div className="space-y-2">
                            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Category</p>
                            <div className="grid grid-cols-4 gap-2">
                                {Object.entries(categoryConfig).map(([k, v]) => {
                                    const active = form.watch('category') === k;
                                    return (
                                        <button
                                            key={k}
                                            type="button"
                                            onClick={() => form.setValue('category', k as TicketCategory)}
                                            className={cn(
                                                'flex flex-col items-center gap-1.5 rounded-xl border p-2.5 text-center transition-all duration-150',
                                                active
                                                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 shadow-sm'
                                                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                                            )}
                                        >
                                            <span className="text-xl leading-none">{v.icon}</span>
                                            <span className={cn('text-[10px] font-semibold leading-tight', active ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-500')}>
                                                {v.label.split(' ')[0]}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Subject */}
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Subject</Label>
                            <Input
                                placeholder="Short summary of the issue"
                                {...form.register('subject')}
                                onBlur={handleSubjectBlur}
                                className="h-10"
                            />
                            {form.formState.errors.subject && <p className="text-red-500 text-xs">{form.formState.errors.subject.message}</p>}
                        </div>

                        {/* KB article suggestions */}
                        {kbArticles.length > 0 && (
                            <div className="rounded-xl border border-sky-200 dark:border-sky-800/50 bg-sky-50 dark:bg-sky-950/20 p-4">
                                <h4 className="flex items-center gap-2 text-sm font-bold text-sky-800 dark:text-sky-400 mb-3">
                                    <BookOpen className="w-4 h-4" /> Help Articles
                                </h4>
                                <div className="space-y-2">
                                    {kbArticles.map(article => (
                                        <div key={article.id} className="rounded-lg border border-sky-100 dark:border-sky-900/40 bg-white dark:bg-slate-900 p-3 text-sm">
                                            <p className="font-semibold text-slate-800 dark:text-slate-200">{article.title}</p>
                                            <p className={cn('text-slate-500 dark:text-slate-400 mt-1 leading-relaxed text-xs', expandedKbId === article.id ? '' : 'line-clamp-2')}>
                                                {article.content}
                                            </p>
                                            {article.content.length > 120 && (
                                                <button type="button" onClick={() => setExpandedKbId(expandedKbId === article.id ? null : article.id)}
                                                    className="text-xs text-sky-600 hover:text-sky-700 mt-1 font-semibold">
                                                    {expandedKbId === article.id ? 'Show less ↑' : 'Read more ↓'}
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <p className="mt-3 text-xs text-sky-600 dark:text-sky-500 italic">Still need help? Continue below.</p>
                            </div>
                        )}

                        {/* Description */}
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Description</Label>
                            <Textarea
                                placeholder="Describe what's happening, what you expected, and any steps you've already tried…"
                                className="min-h-[90px] resize-none text-sm"
                                {...form.register('description')}
                            />
                        </div>

                        {/* Attachment */}
                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                Attachment <span className="font-normal normal-case text-slate-400">(optional)</span>
                            </Label>
                            <input type="file" ref={fileInputRef} onChange={e => setAttachment(e.target.files?.[0] || null)} className="hidden" accept="image/*,.pdf,.doc,.docx" />
                            {attachment ? (
                                <div className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-4 py-3">
                                    <Paperclip className="h-4 w-4 text-slate-400 shrink-0" />
                                    <span className="text-sm text-slate-700 dark:text-slate-300 truncate flex-1">{attachment.name}</span>
                                    <button type="button" onClick={() => { setAttachment(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                                        className="text-slate-400 hover:text-red-500 transition-colors shrink-0">
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="flex items-center gap-2.5 w-full rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 px-4 py-3 text-sm text-slate-500 hover:border-emerald-400 hover:text-emerald-600 dark:hover:border-emerald-700 dark:hover:text-emerald-400 transition-colors"
                                >
                                    <Paperclip className="h-4 w-4 shrink-0" />
                                    Attach a screenshot or file
                                </button>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-2 border-t border-slate-100 dark:border-slate-800 mt-2">
                            <Button type="button" variant="outline" onClick={handleCheckSolutions} disabled={isCheckingDeflection || aiCooldown}
                                className="w-full sm:w-auto text-emerald-700 border-emerald-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 h-9 text-sm">
                                {isCheckingDeflection ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <Bot className="w-3.5 h-3.5 mr-2" />}
                                {aiCooldown ? 'Please wait…' : 'Check for Solutions'}
                            </Button>
                            <div className="flex items-center gap-2 w-full sm:w-auto">
                                <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)} className="flex-1 sm:flex-none h-9 text-sm">Cancel</Button>
                                <Button type="submit" disabled={createMut.isPending || updateMut.isPending || isUploading || isAiAnalyzing}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white flex-1 sm:flex-none h-9 text-sm font-semibold shadow-sm shadow-emerald-600/30">
                                    {isUploading ? 'Uploading…' : isAiAnalyzing ? 'Analysing…' : (createMut.isPending || updateMut.isPending) ? 'Saving…' : editingTicketId ? 'Save Changes' : 'Submit Ticket'}
                                </Button>
                            </div>
                        </div>
                    </form>
                </div>
            </DialogContent>
        </Dialog>

        {/* ── Request Item ── */}
        <Dialog open={requestItemOpen} onOpenChange={open => {
            setRequestItemOpen(open);
            if (open) {
                itemForm.reset({
                    item_type: 'supplies',
                    date: new Date().toISOString().split('T')[0],
                    requester_name: profile?.name || '',
                    work_email: profile?.email || '',
                    importance: 'neutral',
                    item_count: 1,
                    notes: '',
                });
            } else {
                itemForm.reset();
            }
        }}>
            <DialogContent className="sm:max-w-[520px] p-0 overflow-hidden gap-0">
                <div className="bg-gradient-to-r from-slate-700 to-slate-900 dark:from-slate-800 dark:to-slate-950 px-6 py-5">
                    <DialogTitle className="text-white text-lg font-bold">Request an Item</DialogTitle>
                    <DialogDescription className="text-slate-300 text-sm mt-0.5">Supplies, hardware, or other equipment from IT.</DialogDescription>
                </div>

                <div className="max-h-[75vh] overflow-y-auto">
                    <form onSubmit={itemForm.handleSubmit(handleItemSubmit)} className="px-6 py-5 space-y-5">

                        {/* Item type — visual tiles */}
                        <div className="space-y-2">
                            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">What do you need?</p>
                            <div className="grid grid-cols-3 gap-3">
                                {([
                                    { value: 'supplies', icon: <Package className="h-6 w-6" />, label: 'Supplies', color: 'amber' },
                                    { value: 'desktop', icon: <MonitorIcon className="h-6 w-6" />, label: 'Desktop', color: 'sky' },
                                    { value: 'laptop', icon: <LaptopIcon className="h-6 w-6" />, label: 'Laptop', color: 'indigo' },
                                ] as const).map(opt => {
                                    const active = itemForm.watch('item_type') === opt.value;
                                    const colors: Record<string, string> = {
                                        amber: active ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300' : 'border-slate-200 dark:border-slate-700 text-slate-500',
                                        sky:   active ? 'border-sky-400 bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-300' : 'border-slate-200 dark:border-slate-700 text-slate-500',
                                        indigo:active ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300' : 'border-slate-200 dark:border-slate-700 text-slate-500',
                                    };
                                    return (
                                        <button key={opt.value} type="button"
                                            onClick={() => itemForm.setValue('item_type', opt.value as any)}
                                            className={cn('flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all duration-150 hover:scale-[1.02]', colors[opt.color])}>
                                            {opt.icon}
                                            <span className="text-sm font-semibold">{opt.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Date + Importance */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Date</Label>
                                <Input type="date" {...itemForm.register('date')} className="h-10" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Importance</Label>
                                <div className="grid grid-cols-3 gap-1.5 h-10">
                                    {([
                                        { value: 'urgent', label: 'Urgent', dot: 'bg-red-500' },
                                        { value: 'important', label: 'Important', dot: 'bg-amber-500' },
                                        { value: 'neutral', label: 'Neutral', dot: 'bg-sky-500' },
                                    ] as const).map(opt => {
                                        const active = itemForm.watch('importance') === opt.value;
                                        return (
                                            <button key={opt.value} type="button"
                                                onClick={() => itemForm.setValue('importance', opt.value as any)}
                                                className={cn(
                                                    'flex items-center justify-center gap-1 rounded-lg border text-[10px] font-bold transition-all',
                                                    active
                                                        ? 'border-slate-400 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                                                        : 'border-slate-200 dark:border-slate-700 text-slate-400 hover:border-slate-300'
                                                )}>
                                                <span className={cn('h-1.5 w-1.5 rounded-full', opt.dot)} />
                                                {opt.label.slice(0, 3)}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Name + Email */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Your Name <span className="text-red-400">*</span></Label>
                                <Input {...itemForm.register('requester_name')} placeholder="Full name" className="h-10" />
                                {itemForm.formState.errors.requester_name?.message && <p className="text-red-500 text-xs">{itemForm.formState.errors.requester_name.message}</p>}
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Work Email <span className="text-red-400">*</span></Label>
                                <Input type="email" {...itemForm.register('work_email')} placeholder="yourname@jtl.co.ke" className="h-10" />
                                {itemForm.formState.errors.work_email?.message && <p className="text-red-500 text-xs">{itemForm.formState.errors.work_email.message}</p>}
                            </div>
                        </div>

                        {/* Conditional fields */}
                        {itemForm.watch('item_type') === 'supplies' ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Supply Name <span className="text-red-400">*</span></Label>
                                    <Input {...itemForm.register('supply_name')} placeholder="e.g. Printer Toners" maxLength={20} className="h-10" />
                                    <p className="text-[10px] text-slate-400">Max 20 characters</p>
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Quantity <span className="text-red-400">*</span></Label>
                                    <Input type="number" min="1" max="999" {...itemForm.register('item_count')} placeholder="e.g. 5" className="h-10" />
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Reason <span className="text-red-400">*</span></Label>
                                    <Select onValueChange={v => itemForm.setValue('reason', v as any)} value={itemForm.watch('reason') || ''}>
                                        <SelectTrigger className="h-10"><SelectValue placeholder="Select reason" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="old-hardware">Old Hardware</SelectItem>
                                            <SelectItem value="faulty">Faulty / Broken</SelectItem>
                                            <SelectItem value="new-user">New User</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Quantity <span className="text-red-400">*</span></Label>
                                    <Input type="number" min="1" max="999" {...itemForm.register('item_count')} placeholder="e.g. 1" className="h-10" />
                                </div>
                            </div>
                        )}

                        {/* Notes */}
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                Notes <span className="font-normal normal-case text-slate-400">(optional)</span>
                            </Label>
                            <Textarea placeholder="Any additional context or requirements…" className="resize-none text-sm min-h-[70px]" {...itemForm.register('notes')} />
                        </div>

                        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 mt-2">
                            <Button type="button" variant="ghost" onClick={() => setRequestItemOpen(false)} className="h-9 text-sm">Cancel</Button>
                            <Button type="submit" disabled={createItemMut.isPending}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white h-9 px-5 text-sm font-semibold shadow-sm shadow-emerald-600/30">
                                {createItemMut.isPending ? 'Submitting…' : 'Submit Request'}
                            </Button>
                        </div>
                    </form>
                </div>
            </DialogContent>
        </Dialog>

        {/* ── Updates / Chat ── */}
        <Dialog open={!!activeItem} onOpenChange={open => { if (!open) { setViewCommentsTicket(null); setViewCommentsMachine(null); } }}>
            {/* [&>button:last-child]:hidden suppresses the default absolute close button so our custom one doesn't overlap the badge */}
            <DialogContent className="sm:max-w-[480px] h-[85dvh] max-h-[580px] flex flex-col p-0 overflow-hidden gap-0 [&>button:last-child]:hidden">
                {/* Header — sticky, never scrolls */}
                <div className="shrink-0 flex items-center gap-3 px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
                    {/* Icon + title/subtitle */}
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="h-9 w-9 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                            <MessageSquare style={{ height: 18, width: 18 }} className="text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-bold text-foreground truncate">
                                {viewCommentsTicket ? 'Ticket' : 'Request'} #{activeItem?.number}
                            </p>
                            <p className="text-xs text-slate-400 truncate">
                                {viewCommentsTicket ? viewCommentsTicket.subject : (
                                    activeItem && 'item_type' in activeItem
                                        ? (activeItem.item_type === 'supplies' ? (activeItem as any).supply_name : activeItem.item_type === 'desktop' ? 'Desktop PC' : 'Laptop')
                                        : ''
                                )}
                            </p>
                        </div>
                    </div>
                    {/* Status badge + close button — grouped so X never overlaps badge */}
                    <div className="flex items-center gap-2 shrink-0">
                        {activeItem?.status && (
                            <span className={cn(
                                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold',
                                activeItem.status === 'open' ? 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-400 dark:border-sky-800' :
                                activeItem.status === 'in-progress' ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800' :
                                activeItem.status === 'resolved' || activeItem.status === 'fulfilled' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800' :
                                'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                            )}>
                                <span className={cn('h-1.5 w-1.5 rounded-full',
                                    activeItem.status === 'open' ? 'bg-sky-500' :
                                    activeItem.status === 'in-progress' ? 'bg-amber-500' :
                                    activeItem.status === 'resolved' || activeItem.status === 'fulfilled' ? 'bg-emerald-500' : 'bg-slate-400'
                                )} />
                                {activeItem.status.charAt(0).toUpperCase() + activeItem.status.slice(1).replace('-', ' ')}
                            </span>
                        )}
                        <DialogClose className="h-7 w-7 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                            <X className="h-3.5 w-3.5" />
                        </DialogClose>
                    </div>
                </div>
                {/* flex-1 min-h-0 constrains ChatInterface so its internal scroll works and the header stays pinned */}
                <div className="flex-1 min-h-0">
                    {activeItem && (
                        <ChatInterface
                            id={activeItem.id}
                            isMachine={!!viewCommentsMachine}
                            profile={profile}
                            number={activeItem.number}
                            status={activeItem.status}
                        />
                    )}
                </div>
            </DialogContent>
        </Dialog>

        {/* ── IT Notes — Ticket ── */}
        <Dialog open={!!viewNotesTicket} onOpenChange={open => !open && setViewNotesTicket(null)}>
            <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden gap-0">
                <div className="bg-emerald-600 px-6 py-5">
                    <DialogTitle className="text-white font-bold">IT Response</DialogTitle>
                    <DialogDescription className="text-emerald-100 text-sm mt-0.5">
                        Ticket #{viewNotesTicket?.number}: {viewNotesTicket?.subject}
                    </DialogDescription>
                </div>
                <div className="px-6 py-5 space-y-4">
                    <div className="relative rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-4">
                        <div className="absolute left-0 top-4 bottom-4 w-1 rounded-r-full bg-emerald-500 dark:bg-emerald-600" />
                        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap pl-3">
                            {viewNotesTicket?.resolution_notes}
                        </p>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                        {viewNotesTicket && (
                            <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold', statusConfig[viewNotesTicket.status]?.color)}>
                                <span className={cn('h-1.5 w-1.5 rounded-full', statusConfig[viewNotesTicket.status]?.dot)} />
                                {statusConfig[viewNotesTicket.status]?.label}
                            </span>
                        )}
                        <span className="text-slate-400">
                            Resolved by {viewNotesTicket?.assigned_to && staffMap[viewNotesTicket.assigned_to] ? staffMap[viewNotesTicket.assigned_to] : 'IT Support'}
                        </span>
                    </div>
                </div>
            </DialogContent>
        </Dialog>

        {/* ── IT Notes — Machine ── */}
        <Dialog open={!!viewNotesMachine} onOpenChange={open => !open && setViewNotesMachine(null)}>
            <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden gap-0">
                <div className="bg-gradient-to-r from-slate-700 to-slate-900 px-6 py-5">
                    <DialogTitle className="text-white font-bold">IT Response</DialogTitle>
                    <DialogDescription className="text-slate-300 text-sm mt-0.5">
                        Request #{viewNotesMachine?.number}:{' '}
                        {viewNotesMachine?.item_type === 'supplies' ? viewNotesMachine?.supply_name : viewNotesMachine?.item_type === 'desktop' ? 'Desktop PC' : 'Laptop'}
                    </DialogDescription>
                </div>
                <div className="px-6 py-5 space-y-4">
                    <div className="relative rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-4">
                        <div className={cn('absolute left-0 top-4 bottom-4 w-1 rounded-r-full',
                            viewNotesMachine?.status === 'fulfilled' ? 'bg-emerald-500' :
                            viewNotesMachine?.status === 'rejected' ? 'bg-red-500' : 'bg-amber-500'
                        )} />
                        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap pl-3">
                            {viewNotesMachine?.resolution_notes}
                        </p>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                        <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold',
                            viewNotesMachine?.status === 'fulfilled' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800' :
                            viewNotesMachine?.status === 'rejected' ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800' :
                            'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800'
                        )}>
                            <span className={cn('h-1.5 w-1.5 rounded-full',
                                viewNotesMachine?.status === 'fulfilled' ? 'bg-emerald-500' :
                                viewNotesMachine?.status === 'rejected' ? 'bg-red-500' : 'bg-amber-500'
                            )} />
                            {viewNotesMachine?.status?.charAt(0).toUpperCase()}{viewNotesMachine?.status?.slice(1)}
                        </span>
                        <span className="text-slate-400">— IT Department</span>
                    </div>
                </div>
            </DialogContent>
        </Dialog>

        </PageTransition>
    );
}
