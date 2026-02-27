'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getTickets, addTicket, updateTicket, deleteTicket, getTicketStats, getCannedResponses, addCannedResponse, deleteCannedResponse, mergeTickets } from '@/services/tickets';
import { getITStaff } from '@/services/auth';
import { getTicketActivity } from '@/services/activity';
import { getComments, addComment, deleteComment } from '@/services/comments';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useAppStore } from '@/store/useAppStore';
import { Plus, Search, Trash2, Pencil, LayoutDashboard, List, Ticket, Clock, CheckCircle2, Loader2, Archive, UserPlus, Paperclip, Sparkles, AlertTriangle, BookTemplate, GitMerge, MessageSquare, Send, Lock, Activity, TrendingUp, Timer } from 'lucide-react';
import { toast } from 'sonner';
import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { TicketCategory, TicketPriority, TicketStatus, CreateTicketInput, Ticket as TicketType, TicketSentiment, CreateCommentInput } from '@/types/database';
import { generateTicketSummary } from '@/services/ai';
import { formatDistanceToNow } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

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

const priorityConfig: Record<TicketPriority, { label: string; color: string }> = {
    critical: { label: 'Critical', color: 'bg-red-600/20 text-red-500 border-red-600/30 hover:bg-red-600/20' },
    high: { label: 'High', color: 'bg-orange-600/20 text-orange-500 border-orange-600/30 hover:bg-orange-600/20' },
    medium: { label: 'Medium', color: 'bg-blue-600/20 text-blue-500 border-blue-600/30 hover:bg-blue-600/20' },
    low: { label: 'Low', color: 'bg-slate-600/20 text-slate-400 border-slate-600/30 hover:bg-slate-600/20' },
};

const statusConfig: Record<TicketStatus, { label: string; color: string; icon: React.ElementType }> = {
    open: { label: 'Open', color: 'bg-blue-600/20 text-blue-500 border-blue-600/30 hover:bg-blue-600/20', icon: Ticket },
    'in-progress': { label: 'In Progress', color: 'bg-amber-600/20 text-amber-500 border-amber-600/30 hover:bg-amber-600/20', icon: Loader2 },
    resolved: { label: 'Resolved', color: 'bg-emerald-600/20 text-emerald-500 border-emerald-600/30 hover:bg-emerald-600/20', icon: CheckCircle2 },
    closed: { label: 'Closed', color: 'bg-slate-600/20 text-slate-400 border-slate-600/30 hover:bg-slate-600/20', icon: Archive },
};

const sentimentConfig: Record<TicketSentiment, { label: string; color: string; icon: string }> = {
    positive: { label: 'Positive', color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20', icon: '😊' },
    neutral: { label: 'Neutral', color: 'text-slate-500 bg-slate-500/10 border-slate-500/20', icon: '😐' },
    frustrated: { label: 'Frustrated', color: 'text-orange-600 bg-orange-600/10 border-orange-600/20', icon: '😤' },
    angry: { label: 'Angry', color: 'text-red-600 bg-red-600/10 border-red-600/20', icon: '😡' },
};

// ── SLA Helper ────────────────────────────────────────────────
function getSlaStatus(ticket: TicketType): 'overdue' | 'due-soon' | 'ok' | 'done' {
    if (ticket.status === 'resolved' || ticket.status === 'closed') return 'done';
    if (!ticket.due_date) return 'ok';
    const now = new Date();
    const due = new Date(ticket.due_date);
    if (due < now) return 'overdue';
    if (due.getTime() - now.getTime() < 60 * 60 * 1000) return 'due-soon';
    return 'ok';
}

// ── Activity helpers ──────────────────────────────────────────
function getActivityLabel(action: string, metadata: Record<string, string> | null): string {
    switch (action) {
        case 'created': return `Ticket created${metadata?.by ? ` by ${metadata.by}` : ''}`;
        case 'status_changed': return `Status changed: ${metadata?.from} → ${metadata?.to}`;
        case 'assigned': return `Assigned to: ${metadata?.agent || 'Unassigned'}`;
        case 'priority_changed': return `Priority changed: ${metadata?.from} → ${metadata?.to}`;
        case 'note_added': return 'Resolution note updated';
        case 'merged': return metadata?.into ? 'Merged into another ticket' : 'Received a merged ticket';
        default: return action;
    }
}

// ── Validation ───────────────────────────────────────────────
const ticketSchema = z.object({
    ticket_date: z.string().min(1, 'Date required'),
    employee_name: z.string().min(2, 'Employee name required'),
    department: z.string().optional(),
    category: z.enum(['email', 'account-login', 'password-reset', 'hardware', 'software', 'network-vpn', 'other']),
    priority: z.enum(['critical', 'high', 'medium', 'low']),
    subject: z.string().min(3, 'Subject required'),
    description: z.string().optional(),
});

// ── Page ─────────────────────────────────────────────────────
export default function TicketsPage() {
    const { profile } = useAppStore();
    const [formOpen, setFormOpen] = useState(false);
    const [cannedResponsesOpen, setCannedResponsesOpen] = useState(false);
    const [editingTicket, setEditingTicket] = useState<TicketType | null>(null);
    const [view, setView] = useState<'dashboard' | 'list'>('list');
    const [showOverdueOnly, setShowOverdueOnly] = useState(false);
    const [dialogTab, setDialogTab] = useState<'details' | 'comments' | 'activity'>('details');

    // Merge state
    const [mergingTicket, setMergingTicket] = useState<TicketType | null>(null);
    const [mergeTargetId, setMergeTargetId] = useState('');

    // Comment state
    const [newComment, setNewComment] = useState('');
    const [isInternal, setIsInternal] = useState(false);

    const { ticketCategory, ticketPriority, ticketStatus, ticketSearch, ticketDateRange, setTicketCategory, setTicketPriority, setTicketStatus, setTicketSearch } = useAppStore();
    const queryClient = useQueryClient();

    // AI Summary State
    const [isSummarizing, setIsSummarizing] = useState(false);
    const [aiSummary, setAiSummary] = useState<string | null>(null);

    // ── Queries ──────────────────────────────────────────────
    const { data: staffList } = useQuery({ queryKey: ['staff'], queryFn: getITStaff });
    const staffMap = staffList?.reduce((acc, s) => { acc[s.id] = s.name; return acc; }, {} as Record<string, string>) || {};

    const { data: stats, isLoading: statsLoading } = useQuery({ queryKey: ['ticket-stats'], queryFn: () => getTicketStats() });
    const { data: tickets, isLoading } = useQuery({
        queryKey: ['tickets', ticketCategory, ticketPriority, ticketStatus, ticketSearch, ticketDateRange],
        queryFn: () => getTickets({
            category: ticketCategory === 'all' ? undefined : ticketCategory,
            priority: ticketPriority === 'all' ? undefined : ticketPriority,
            status: ticketStatus === 'all' ? undefined : ticketStatus,
            search: ticketSearch || undefined,
            dateRange: ticketDateRange,
        }),
    });

    const { data: cannedResponses } = useQuery({ queryKey: ['canned-responses'], queryFn: getCannedResponses });

    // Activity + Comments — only fetched when editing dialog is open
    const { data: ticketActivity } = useQuery({
        queryKey: ['ticket-activity', editingTicket?.id],
        queryFn: () => getTicketActivity(editingTicket!.id),
        enabled: !!editingTicket?.id && formOpen,
    });

    const { data: ticketComments } = useQuery({
        queryKey: ['ticket-comments', editingTicket?.id],
        queryFn: () => getComments(editingTicket!.id, true),
        enabled: !!editingTicket?.id && formOpen,
    });

    // ── Mutations ────────────────────────────────────────────
    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: ['tickets'] });
        queryClient.invalidateQueries({ queryKey: ['ticket-stats'] });
    };

    const createMut = useMutation({
        mutationFn: addTicket,
        onSuccess: () => { invalidate(); toast.success('Ticket created'); form.reset(); setFormOpen(false); setEditingTicket(null); },
        onError: (e: Error) => toast.error(e.message),
    });

    const updateMut = useMutation({
        mutationFn: ({ id, data, previous }: { id: string; data: Partial<TicketType>; previous?: Partial<TicketType> }) =>
            updateTicket(id, data, previous),
        onSuccess: () => {
            invalidate();
            queryClient.invalidateQueries({ queryKey: ['ticket-activity', editingTicket?.id] });
            toast.success('Ticket updated');
            form.reset();
            setFormOpen(false);
            setEditingTicket(null);
        },
        onError: (e: Error) => toast.error(e.message),
    });

    const deleteMut = useMutation({
        mutationFn: deleteTicket,
        onSuccess: () => { invalidate(); toast.success('Ticket deleted'); },
    });

    const statusMut = useMutation({
        mutationFn: ({ id, status }: { id: string; status: TicketStatus }) => {
            const prev = tickets?.find(t => t.id === id);
            return updateTicket(id, { status }, prev ? { status: prev.status } : undefined);
        },
        onSuccess: () => { invalidate(); toast.success('Status updated'); },
    });

    const assignMut = useMutation({
        mutationFn: ({ id, assigned_to }: { id: string; assigned_to: string }) => {
            const prev = tickets?.find(t => t.id === id);
            return updateTicket(id, { assigned_to, status: 'in-progress' }, prev ? { assigned_to: prev.assigned_to, status: prev.status } : undefined);
        },
        onSuccess: () => { invalidate(); toast.success('Ticket assigned & In Progress'); },
    });

    const mergeMut = useMutation({
        mutationFn: ({ sourceId, targetId }: { sourceId: string; targetId: string }) => mergeTickets(sourceId, targetId),
        onSuccess: () => {
            invalidate();
            toast.success('Tickets merged successfully');
            setMergingTicket(null);
            setMergeTargetId('');
        },
        onError: (e: Error) => toast.error(e.message),
    });

    const addCommentMut = useMutation({
        mutationFn: (input: CreateCommentInput) => addComment(input, profile?.name ?? 'IT Staff'),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ticket-comments', editingTicket?.id] });
            setNewComment('');
            setIsInternal(false);
            toast.success('Comment posted');
        },
        onError: (e: Error) => toast.error(e.message),
    });

    const deleteCommentMut = useMutation({
        mutationFn: deleteComment,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ticket-comments', editingTicket?.id] });
            toast.success('Comment deleted');
        },
    });

    // Canned Response mutations
    const macroForm = useForm<{ title: string; content: string }>({ defaultValues: { title: '', content: '' } });

    const addMacroMut = useMutation({
        mutationFn: (data: { title: string; content: string }) => addCannedResponse(data.title, data.content),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['canned-responses'] }); toast.success('Macro added'); macroForm.reset(); },
        onError: (e: Error) => toast.error(e.message),
    });

    const deleteMacroMut = useMutation({
        mutationFn: deleteCannedResponse,
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['canned-responses'] }); toast.success('Macro deleted'); },
        onError: (e: Error) => toast.error(e.message),
    });

    // ── Edit state ───────────────────────────────────────────
    const [editStatus, setEditStatus] = useState<TicketStatus>('open');
    const [editResolution, setEditResolution] = useState('');
    const [editInternalNotes, setEditInternalNotes] = useState('');
    const [editAssignee, setEditAssignee] = useState<string>('unassigned');

    const form = useForm<CreateTicketInput>({
        resolver: zodResolver(ticketSchema),
        defaultValues: { ticket_date: new Date().toISOString().split('T')[0], employee_name: '', department: '', category: 'email', priority: 'medium', subject: '', description: '' },
    });

    const handleEdit = (ticket: TicketType) => {
        setEditingTicket(ticket);
        form.reset({
            ticket_date: ticket.ticket_date,
            employee_name: ticket.employee_name,
            department: ticket.department || '',
            category: ticket.category,
            priority: ticket.priority,
            subject: ticket.subject,
            description: ticket.description || '',
        });
        setEditStatus(ticket.status);
        setEditResolution(ticket.resolution_notes || '');
        setEditInternalNotes(ticket.internal_notes || '');
        setEditAssignee(ticket.assigned_to || 'unassigned');
        setAiSummary(null);
        setDialogTab('details');
        setFormOpen(true);
    };

    const handleGenerateSummary = async () => {
        if (!editingTicket?.description) return;
        setIsSummarizing(true);
        try {
            const sum = await generateTicketSummary(editingTicket.description, editResolution);
            setAiSummary(sum);
        } catch {
            toast.error('Failed to generate summary');
        } finally {
            setIsSummarizing(false);
        }
    };

    const handleSubmit = (data: CreateTicketInput) => {
        if (editingTicket) {
            updateMut.mutate({
                id: editingTicket.id,
                data: {
                    ...data,
                    status: editStatus,
                    resolution_notes: editResolution,
                    internal_notes: editInternalNotes,
                    assigned_to: editAssignee === 'unassigned' ? null : editAssignee,
                },
                previous: editingTicket,
            });
        } else {
            createMut.mutate({ ...data });
        }
    };

    useEffect(() => {
        if (!formOpen) {
            setEditingTicket(null);
            setEditResolution('');
            setEditInternalNotes('');
            setEditAssignee('unassigned');
            setAiSummary(null);
            setDialogTab('details');
            setNewComment('');
            setIsInternal(false);
        }
    }, [formOpen]);

    // ── Analytics ────────────────────────────────────────────
    const weeklyData = useMemo(() => {
        const days = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            days.push({
                day: d.toLocaleDateString('en', { weekday: 'short' }),
                count: tickets?.filter(t => t.ticket_date === dateStr).length ?? 0,
            });
        }
        return days;
    }, [tickets]);

    const overdueCount = useMemo(() => tickets?.filter(t => getSlaStatus(t) === 'overdue').length ?? 0, [tickets]);

    const slaCompliance = useMemo(() => {
        const resolved = tickets?.filter(t => t.status === 'resolved' || t.status === 'closed') ?? [];
        if (resolved.length === 0) return 100;
        const withinSLA = resolved.filter(t => !t.due_date || new Date(t.updated_at) <= new Date(t.due_date));
        return Math.round((withinSLA.length / resolved.length) * 100);
    }, [tickets]);

    const avgResolutionHours = useMemo(() => {
        const resolved = tickets?.filter(t => t.status === 'resolved' || t.status === 'closed') ?? [];
        if (resolved.length === 0) return null;
        const total = resolved.reduce((sum, t) => sum + (new Date(t.updated_at).getTime() - new Date(t.created_at).getTime()), 0);
        return Math.round(total / resolved.length / (1000 * 60 * 60));
    }, [tickets]);

    const statCards = [
        { label: 'Total', value: stats?.total ?? 0, icon: Ticket, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
        { label: 'Open', value: stats?.open ?? 0, icon: Clock, color: 'text-blue-500', bg: 'bg-blue-500/10' },
        { label: 'In Progress', value: stats?.inProgress ?? 0, icon: Loader2, color: 'text-amber-500', bg: 'bg-amber-500/10' },
        { label: 'Resolved', value: stats?.resolved ?? 0, icon: CheckCircle2, color: 'text-teal-500', bg: 'bg-teal-500/10' },
        { label: 'Overdue', value: overdueCount, icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-500/10' },
    ];

    const resolutionRate = stats && stats.total > 0 ? Math.round(((stats.resolved + stats.closed) / stats.total) * 100) : 0;

    const categoryBreakdown = tickets ? Object.entries(
        tickets.reduce((acc, t) => { acc[t.category] = (acc[t.category] || 0) + 1; return acc; }, {} as Record<string, number>)
    ).sort((a, b) => b[1] - a[1]) : [];

    const displayedTickets = useMemo(() => {
        if (!tickets) return [];
        if (showOverdueOnly) return tickets.filter(t => getSlaStatus(t) === 'overdue');
        return tickets;
    }, [tickets, showOverdueOnly]);

    // ── Render ───────────────────────────────────────────────
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-foreground">🎫 IT Ticketing</h1>
                    <p className="text-muted-foreground mt-1">Manage and assign IT support tickets</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={() => setCannedResponsesOpen(true)} className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950/30">
                        <BookTemplate className="h-4 w-4 mr-2" /> Macros
                    </Button>
                    <Button onClick={() => { setEditingTicket(null); form.reset(); setFormOpen(true); }} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                        <Plus className="h-4 w-4 mr-2" /> New Ticket
                    </Button>
                </div>
            </div>

            {/* View Toggle */}
            <div className="flex justify-center">
                <div className="flex items-center rounded-lg border p-1 gap-1">
                    <Button variant={view === 'dashboard' ? 'default' : 'ghost'} size="sm" onClick={() => setView('dashboard')} className={view === 'dashboard' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}>
                        <LayoutDashboard className="h-4 w-4 mr-1" /> Dashboard
                    </Button>
                    <Button variant={view === 'list' ? 'default' : 'ghost'} size="sm" onClick={() => setView('list')} className={view === 'list' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}>
                        <List className="h-4 w-4 mr-1" /> View Tickets
                    </Button>
                </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                {statCards.map((c) => (
                    <Card key={c.label} className={`border shadow-sm ${c.label === 'Overdue' && overdueCount > 0 ? 'border-red-200 dark:border-red-900' : ''}`}>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
                            <div className={`p-2 rounded-lg ${c.bg}`}><c.icon className={`h-5 w-5 ${c.color}`} /></div>
                        </CardHeader>
                        <CardContent>
                            {statsLoading ? <Skeleton className="h-9 w-16" /> : (
                                <p className={`text-3xl font-bold ${c.label === 'Overdue' && overdueCount > 0 ? 'text-red-500' : 'text-foreground'}`}>{c.value}</p>
                            )}
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* ===== DASHBOARD VIEW ===== */}
            {view === 'dashboard' && (
                <div className="space-y-6">
                    {/* Analytics cards row */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <Card className="border shadow-sm">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                    <TrendingUp className="h-4 w-4 text-emerald-500" /> SLA Compliance
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className={`text-3xl font-bold ${slaCompliance >= 80 ? 'text-emerald-500' : slaCompliance >= 60 ? 'text-amber-500' : 'text-red-500'}`}>{slaCompliance}%</p>
                                <p className="text-xs text-muted-foreground mt-1">Tickets resolved within SLA</p>
                            </CardContent>
                        </Card>
                        <Card className={`border shadow-sm ${overdueCount > 0 ? 'border-red-200 dark:border-red-900' : ''}`}>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                    <AlertTriangle className={`h-4 w-4 ${overdueCount > 0 ? 'text-red-500' : 'text-slate-400'}`} /> Overdue Tickets
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className={`text-3xl font-bold ${overdueCount > 0 ? 'text-red-500' : 'text-emerald-500'}`}>{overdueCount}</p>
                                <p className="text-xs text-muted-foreground mt-1">{overdueCount === 0 ? 'All tickets within SLA' : 'Require immediate attention'}</p>
                            </CardContent>
                        </Card>
                        <Card className="border shadow-sm">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                    <Timer className="h-4 w-4 text-blue-500" /> Avg Resolution Time
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-3xl font-bold text-foreground">{avgResolutionHours !== null ? `${avgResolutionHours}h` : '–'}</p>
                                <p className="text-xs text-muted-foreground mt-1">Based on resolved tickets</p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Resolution Rate */}
                    <Card className="border shadow-sm">
                        <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Resolution Rate</CardTitle></CardHeader>
                        <CardContent>
                            <div className="flex items-end gap-2 mb-3">
                                <span className="text-4xl font-bold text-foreground">{resolutionRate}%</span>
                                <span className="text-muted-foreground text-sm pb-1">{(stats?.resolved ?? 0) + (stats?.closed ?? 0)} of {stats?.total ?? 0} resolved</span>
                            </div>
                            <div className="h-3 bg-muted rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-1000" style={{ width: `${resolutionRate}%` }} />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Weekly Volume Chart */}
                    <Card className="border shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                <TrendingUp className="h-4 w-4" /> Ticket Volume — Last 7 Days
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={200}>
                                <LineChart data={weeklyData}>
                                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                                    <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                                    <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px' }} labelStyle={{ fontWeight: 600 }} />
                                    <Line type="monotone" dataKey="count" name="Tickets" stroke="#10b981" strokeWidth={2.5} dot={{ r: 4, fill: '#10b981' }} activeDot={{ r: 6 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>

                    {/* Category Breakdown */}
                    <Card className="border shadow-sm">
                        <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Tickets by Category</CardTitle></CardHeader>
                        <CardContent>
                            {categoryBreakdown.length === 0 ? (
                                <p className="text-muted-foreground text-center py-8">No tickets yet</p>
                            ) : (
                                <div className="space-y-3">
                                    {categoryBreakdown.map(([key, count]) => {
                                        const pct = tickets ? Math.round((count / tickets.length) * 100) : 0;
                                        const cfg = categoryConfig[key as TicketCategory];
                                        return (
                                            <div key={key} className="space-y-1">
                                                <div className="flex justify-between text-sm">
                                                    <span className="font-medium text-foreground">{cfg?.icon} {cfg?.label || key}</span>
                                                    <span className="text-muted-foreground">{count} ({pct}%)</span>
                                                </div>
                                                <div className="h-2 bg-muted rounded-full overflow-hidden">
                                                    <div className="h-full bg-emerald-500 rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* ===== LIST VIEW ===== */}
            {view === 'list' && (
                <>
                    <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
                        <div className="relative flex-1 min-w-[160px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Search tickets..." value={ticketSearch} onChange={(e) => setTicketSearch(e.target.value)} className="pl-10" />
                        </div>
                        <Button
                            variant={showOverdueOnly ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setShowOverdueOnly(v => !v)}
                            className={`h-10 ${showOverdueOnly ? 'bg-red-600 hover:bg-red-700 text-white' : 'border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/20'}`}
                        >
                            <AlertTriangle className="h-4 w-4 mr-1.5" /> Overdue Only
                        </Button>
                        <Select value={ticketCategory} onValueChange={(v) => setTicketCategory(v as TicketCategory | 'all')}>
                            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Categories</SelectItem>
                                {Object.entries(categoryConfig).map(([k, v]) => (
                                    <SelectItem key={k} value={k}>{v.icon} {v.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={ticketPriority} onValueChange={(v) => setTicketPriority(v as TicketPriority | 'all')}>
                            <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Priority</SelectItem>
                                <SelectItem value="critical">🔴 Critical</SelectItem>
                                <SelectItem value="high">🟠 High</SelectItem>
                                <SelectItem value="medium">🔵 Medium</SelectItem>
                                <SelectItem value="low">⚪ Low</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={ticketStatus} onValueChange={(v) => setTicketStatus(v as TicketStatus | 'all')}>
                            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Status</SelectItem>
                                <SelectItem value="open">Open</SelectItem>
                                <SelectItem value="in-progress">In Progress</SelectItem>
                                <SelectItem value="resolved">Resolved</SelectItem>
                                <SelectItem value="closed">Closed</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <Card className="border shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>#</TableHead>
                                        <TableHead>Date</TableHead>
                                        <TableHead>User / Dept</TableHead>
                                        <TableHead>Category</TableHead>
                                        <TableHead>Status / Priority / SLA</TableHead>
                                        <TableHead>Assigned To</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? Array.from({ length: 5 }).map((_, i) => (
                                        <TableRow key={i}>
                                            {Array.from({ length: 7 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}
                                        </TableRow>
                                    )) : displayedTickets.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">No tickets found</TableCell>
                                        </TableRow>
                                    ) : displayedTickets.map((ticket) => {
                                        const slaStatus = getSlaStatus(ticket);
                                        return (
                                            <TableRow key={ticket.id} className={`${ticket.status === 'closed' || ticket.merged_into ? 'opacity-60' : ''} ${slaStatus === 'overdue' ? 'bg-red-50/40 dark:bg-red-950/10' : ''}`}>
                                                <TableCell className="font-mono font-medium">
                                                    {ticket.merged_into ? <span className="line-through text-slate-400">{ticket.number}</span> : ticket.number}
                                                </TableCell>
                                                <TableCell className="text-muted-foreground whitespace-nowrap text-sm">{ticket.ticket_date}</TableCell>
                                                <TableCell>
                                                    <div className="font-medium" title={ticket.subject}>{ticket.employee_name}</div>
                                                    <div className="text-xs text-muted-foreground">{ticket.department || 'N/A'}</div>
                                                </TableCell>
                                                <TableCell>
                                                    <span className="text-sm whitespace-nowrap">{categoryConfig[ticket.category]?.icon} {categoryConfig[ticket.category]?.label}</span>
                                                    <div className="text-xs text-muted-foreground max-w-[120px] truncate flex items-center gap-1" title={ticket.subject}>
                                                        {ticket.sentiment && ticket.sentiment !== 'neutral' && ticket.sentiment !== 'positive' && (
                                                            <span title={`Sentiment: ${ticket.sentiment}`}>{sentimentConfig[ticket.sentiment]?.icon}</span>
                                                        )}
                                                        {ticket.subject}
                                                    </div>
                                                    {ticket.merged_into && (
                                                        <Badge variant="outline" className="text-[10px] mt-1 bg-slate-100 text-slate-500 dark:bg-slate-800">
                                                            <GitMerge className="h-2.5 w-2.5 mr-1" /> Merged
                                                        </Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell className="space-y-1">
                                                    <div>
                                                        <Badge variant="outline" className={statusConfig[ticket.status]?.color}>
                                                            {statusConfig[ticket.status]?.label}
                                                        </Badge>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <Badge variant="outline" className={priorityConfig[ticket.priority]?.color}>
                                                            {priorityConfig[ticket.priority]?.label}
                                                        </Badge>
                                                        {ticket.due_date && slaStatus !== 'done' && (
                                                            <span className={`text-[10px] font-medium flex items-center gap-0.5 px-1.5 py-0.5 rounded-full border ${slaStatus === 'overdue'
                                                                ? 'bg-red-100 text-red-600 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800'
                                                                : slaStatus === 'due-soon'
                                                                    ? 'bg-amber-100 text-amber-600 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800'
                                                                    : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400'
                                                                }`}>
                                                                {slaStatus === 'overdue' ? <AlertTriangle className="h-2.5 w-2.5" /> : <Clock className="h-2.5 w-2.5" />}
                                                                {slaStatus === 'overdue' ? 'OVERDUE' : slaStatus === 'due-soon' ? 'DUE SOON' : `Due ${new Date(ticket.due_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                                                            </span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <span className="text-sm font-medium">
                                                        {ticket.assigned_to && staffMap[ticket.assigned_to] ? staffMap[ticket.assigned_to] : <span className="text-slate-400 italic">Unassigned</span>}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        {profile?.id && ticket.assigned_to !== profile.id && ticket.status !== 'closed' && !ticket.merged_into && (
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500 hover:text-blue-400" onClick={() => assignMut.mutate({ id: ticket.id, assigned_to: profile.id })} title="Assign to me">
                                                                <UserPlus className="h-4 w-4" />
                                                            </Button>
                                                        )}
                                                        {ticket.status === 'open' && !ticket.merged_into && (
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-500 hover:text-amber-400" onClick={() => statusMut.mutate({ id: ticket.id, status: 'in-progress' })} title="Start Working">
                                                                <Loader2 className="h-4 w-4" />
                                                            </Button>
                                                        )}
                                                        {ticket.status === 'in-progress' && !ticket.merged_into && (
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-500 hover:text-emerald-400" onClick={() => statusMut.mutate({ id: ticket.id, status: 'resolved' })} title="Mark Resolved">
                                                                <CheckCircle2 className="h-4 w-4" />
                                                            </Button>
                                                        )}
                                                        {ticket.status !== 'closed' && ticket.status !== 'resolved' && !ticket.merged_into && (
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-purple-500 hover:text-purple-400" onClick={() => { setMergingTicket(ticket); setMergeTargetId(''); }} title="Merge into another ticket">
                                                                <GitMerge className="h-4 w-4" />
                                                            </Button>
                                                        )}
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300" onClick={() => handleEdit(ticket)} title="Edit">
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                        <AlertDialog>
                                                            <AlertDialogTrigger asChild>
                                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-400"><Trash2 className="h-4 w-4" /></Button>
                                                            </AlertDialogTrigger>
                                                            <AlertDialogContent>
                                                                <AlertDialogHeader>
                                                                    <AlertDialogTitle>Delete Ticket #{ticket.number}?</AlertDialogTitle>
                                                                    <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                                                                </AlertDialogHeader>
                                                                <AlertDialogFooter>
                                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                    <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => deleteMut.mutate(ticket.id)}>Delete</AlertDialogAction>
                                                                </AlertDialogFooter>
                                                            </AlertDialogContent>
                                                        </AlertDialog>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    </Card>
                </>
            )}

            {/* ===== CREATE / EDIT DIALOG ===== */}
            <Dialog open={formOpen} onOpenChange={setFormOpen}>
                <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pr-6">
                            <span>{editingTicket ? `Ticket #${editingTicket.number} Details` : 'New Ticket'}</span>
                            <div className="flex flex-wrap items-center gap-2">
                                {editingTicket?.sentiment && editingTicket.sentiment !== 'neutral' && (
                                    <Badge variant="outline" className={sentimentConfig[editingTicket.sentiment]?.color}>
                                        {sentimentConfig[editingTicket.sentiment]?.icon} {sentimentConfig[editingTicket.sentiment]?.label}
                                    </Badge>
                                )}
                                {editingTicket?.due_date && (() => {
                                    const s = getSlaStatus(editingTicket);
                                    return s !== 'done' ? (
                                        <Badge variant="outline" className={s === 'overdue' ? 'bg-red-50 text-red-600 border-red-200 dark:bg-red-950/30' : 'bg-slate-50 text-slate-500 dark:bg-slate-900'}>
                                            {s === 'overdue' ? '🚨 SLA OVERDUE' : `SLA: ${new Date(editingTicket.due_date).toLocaleString()}`}
                                        </Badge>
                                    ) : null;
                                })()}
                            </div>
                        </DialogTitle>
                    </DialogHeader>

                    {/* Tab bar — only when editing */}
                    {editingTicket && (
                        <div className="flex items-center gap-1 border-b pb-3 mt-2">
                            {(['details', 'comments', 'activity'] as const).map(tab => (
                                <Button
                                    key={tab}
                                    variant={dialogTab === tab ? 'default' : 'ghost'}
                                    size="sm"
                                    onClick={() => setDialogTab(tab)}
                                    className={`capitalize ${dialogTab === tab ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}`}
                                >
                                    {tab === 'comments' && <MessageSquare className="h-3.5 w-3.5 mr-1.5" />}
                                    {tab === 'activity' && <Activity className="h-3.5 w-3.5 mr-1.5" />}
                                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                                    {tab === 'comments' && ticketComments && ticketComments.length > 0 && (
                                        <span className="ml-1.5 text-[10px] bg-white/20 dark:bg-black/20 rounded-full px-1.5 py-0.5">{ticketComments.length}</span>
                                    )}
                                </Button>
                            ))}
                        </div>
                    )}

                    {/* ── DETAILS TAB ── */}
                    {(!editingTicket || dialogTab === 'details') && (
                        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 mt-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Date</Label>
                                    <Input type="date" {...form.register('ticket_date')} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Employee Name *</Label>
                                    <Input placeholder="Full name" {...form.register('employee_name')} />
                                    {form.formState.errors.employee_name && <p className="text-red-500 text-xs">{form.formState.errors.employee_name.message}</p>}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Department</Label>
                                    <Input placeholder="e.g. Finance, HR, IT..." {...form.register('department')} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Category *</Label>
                                    <Select onValueChange={(v) => form.setValue('category', v as TicketCategory)} defaultValue={form.getValues('category') || 'email'}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {Object.entries(categoryConfig).map(([k, v]) => (
                                                <SelectItem key={k} value={k}>{v.icon} {v.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Priority *</Label>
                                    <Select onValueChange={(v) => form.setValue('priority', v as TicketPriority)} defaultValue={form.getValues('priority') || 'medium'}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="critical">🔴 Critical</SelectItem>
                                            <SelectItem value="high">🟠 High</SelectItem>
                                            <SelectItem value="medium">🔵 Medium</SelectItem>
                                            <SelectItem value="low">⚪ Low</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Subject *</Label>
                                    <Input placeholder="Brief description" {...form.register('subject')} />
                                    {form.formState.errors.subject && <p className="text-red-500 text-xs">{form.formState.errors.subject.message}</p>}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <Label>Description</Label>
                                    {editingTicket && editingTicket.description && editingTicket.description.length > 50 && (
                                        <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-xs text-emerald-600 hover:text-emerald-700 bg-emerald-50 max-w-fit" onClick={handleGenerateSummary} disabled={isSummarizing}>
                                            {isSummarizing ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Sparkles className="w-3 h-3 mr-1" />}
                                            AI Summary
                                        </Button>
                                    )}
                                </div>
                                {aiSummary && (
                                    <div className="text-sm p-3 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-md mb-2 flex gap-2">
                                        <Sparkles className="w-4 h-4 shrink-0 mt-0.5" />
                                        <span>{aiSummary}</span>
                                    </div>
                                )}
                                <Textarea placeholder="Detailed description of the issue..." className="min-h-[80px]" {...form.register('description')} />
                            </div>

                            {editingTicket?.attachment_url && (
                                <div className="space-y-2 p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                                    <Label className="text-muted-foreground flex items-center gap-2"><Paperclip className="h-4 w-4" /> Attachment Provided</Label>
                                    <a href={editingTicket.attachment_url} target="_blank" rel="noreferrer" className="text-sm font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 underline underline-offset-4">View attached file</a>
                                </div>
                            )}

                            {editingTicket && (
                                <>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Assigned To</Label>
                                            <Select value={editAssignee} onValueChange={setEditAssignee}>
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="unassigned">Unassigned</SelectItem>
                                                    {staffList?.map(staff => (
                                                        <SelectItem key={staff.id} value={staff.id}>{staff.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Status</Label>
                                            <Select value={editStatus} onValueChange={(v) => setEditStatus(v as TicketStatus)}>
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="open">Open</SelectItem>
                                                    <SelectItem value="in-progress">In Progress</SelectItem>
                                                    <SelectItem value="resolved">Resolved</SelectItem>
                                                    <SelectItem value="closed">Closed</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="flex items-center text-amber-600 dark:text-amber-500">
                                            <AlertTriangle className="h-3 w-3 mr-1" /> Internal IT Notes (Hidden from Employee)
                                        </Label>
                                        <Textarea placeholder="Private staff notes, debugging steps, etc." className="min-h-[60px] bg-amber-50/50 dark:bg-amber-950/10 border-amber-200 dark:border-amber-900/50" value={editInternalNotes} onChange={(e) => setEditInternalNotes(e.target.value)} />
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center">
                                            <Label>Public Resolution Notes</Label>
                                            {cannedResponses && cannedResponses.length > 0 && (
                                                <Select onValueChange={(v) => {
                                                    const macro = cannedResponses.find(c => c.id === v);
                                                    if (macro) setEditResolution(prev => prev ? prev + '\n\n' + macro.content : macro.content);
                                                }}>
                                                    <SelectTrigger className="h-7 w-[180px] text-xs"><SelectValue placeholder="Insert canned response..." /></SelectTrigger>
                                                    <SelectContent>
                                                        {cannedResponses.map(c => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            )}
                                        </div>
                                        <Textarea placeholder="What was done to resolve this..." className="min-h-[60px]" value={editResolution} onChange={(e) => setEditResolution(e.target.value)} />
                                    </div>
                                </>
                            )}

                            <div className="flex justify-end gap-3 pt-4">
                                <Button type="button" variant="ghost" onClick={() => setFormOpen(false)}>Cancel</Button>
                                <Button type="submit" disabled={createMut.isPending || updateMut.isPending} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                                    {(createMut.isPending || updateMut.isPending) ? 'Saving...' : editingTicket ? 'Update Ticket' : 'Create Ticket'}
                                </Button>
                            </div>
                        </form>
                    )}

                    {/* ── COMMENTS TAB ── */}
                    {editingTicket && dialogTab === 'comments' && (
                        <div className="mt-4 space-y-4">
                            <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
                                {!ticketComments ? (
                                    <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}</div>
                                ) : ticketComments.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                                        <MessageSquare className="h-10 w-10 mb-2 opacity-30" />
                                        <p className="text-sm">No comments yet. Be the first to comment.</p>
                                    </div>
                                ) : ticketComments.map(comment => (
                                    <div key={comment.id} className={`p-3 rounded-lg border ${comment.is_internal ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/50' : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800'}`}>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <div className="flex items-center gap-2">
                                                <div className="h-6 w-6 rounded-full bg-emerald-500/20 flex items-center justify-center text-xs font-bold text-emerald-600 dark:text-emerald-400">
                                                    {comment.author_name.charAt(0).toUpperCase()}
                                                </div>
                                                <span className="text-sm font-medium text-foreground">{comment.author_name}</span>
                                                {comment.is_internal && (
                                                    <Badge variant="outline" className="text-[10px] py-0 h-4 bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800">
                                                        <Lock className="h-2.5 w-2.5 mr-0.5" /> Internal
                                                    </Badge>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}</span>
                                                {comment.user_id === profile?.id && (
                                                    <Button variant="ghost" size="icon" className="h-5 w-5 text-red-400 hover:text-red-500" onClick={() => deleteCommentMut.mutate(comment.id)}>
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                        <p className="text-sm text-foreground whitespace-pre-wrap">{comment.content}</p>
                                    </div>
                                ))}
                            </div>

                            {/* New comment form */}
                            <div className="border-t pt-4 space-y-3">
                                <Textarea placeholder="Write a comment..." className="min-h-[80px]" value={newComment} onChange={(e) => setNewComment(e.target.value)} />
                                <div className="flex items-center justify-between">
                                    <button
                                        type="button"
                                        onClick={() => setIsInternal(v => !v)}
                                        className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md border transition-colors ${isInternal ? 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800' : 'bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-900 dark:border-slate-700'}`}
                                    >
                                        <Lock className="h-3.5 w-3.5" />
                                        {isInternal ? 'Internal Note' : 'Public Reply'}
                                    </button>
                                    <Button
                                        type="button"
                                        size="sm"
                                        disabled={!newComment.trim() || addCommentMut.isPending}
                                        onClick={() => {
                                            if (!newComment.trim() || !editingTicket) return;
                                            addCommentMut.mutate({ ticket_id: editingTicket.id, content: newComment.trim(), is_internal: isInternal });
                                        }}
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                    >
                                        <Send className="h-3.5 w-3.5 mr-1.5" />
                                        {addCommentMut.isPending ? 'Posting...' : 'Post Comment'}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── ACTIVITY TAB ── */}
                    {editingTicket && dialogTab === 'activity' && (
                        <div className="mt-4 max-h-[400px] overflow-y-auto pr-1">
                            {!ticketActivity ? (
                                <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded" />)}</div>
                            ) : ticketActivity.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                                    <Activity className="h-10 w-10 mb-2 opacity-30" />
                                    <p className="text-sm">No activity recorded yet</p>
                                </div>
                            ) : (
                                <div className="relative">
                                    <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" />
                                    <div className="space-y-5">
                                        {ticketActivity.map((entry) => (
                                            <div key={entry.id} className="flex items-start gap-3 pl-9 relative">
                                                <div className="absolute left-2 w-4 h-4 rounded-full bg-background border-2 border-emerald-500 flex items-center justify-center">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm text-foreground">{getActivityLabel(entry.action, entry.metadata)}</p>
                                                    <p className="text-[11px] text-muted-foreground mt-0.5">
                                                        {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* ===== MERGE DIALOG ===== */}
            <Dialog open={!!mergingTicket} onOpenChange={(open) => { if (!open) { setMergingTicket(null); setMergeTargetId(''); } }}>
                <DialogContent className="sm:max-w-[480px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <GitMerge className="h-5 w-5 text-purple-500" /> Merge Ticket #{mergingTicket?.number}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="mt-4 space-y-4">
                        <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                            <p className="text-xs text-muted-foreground mb-1">Source ticket (will be closed)</p>
                            <p className="text-sm font-medium">{mergingTicket?.subject}</p>
                            <p className="text-xs text-muted-foreground">{mergingTicket?.employee_name} · #{mergingTicket?.number}</p>
                        </div>
                        <div className="space-y-2">
                            <Label>Merge into ticket</Label>
                            <Select value={mergeTargetId} onValueChange={setMergeTargetId}>
                                <SelectTrigger><SelectValue placeholder="Select target ticket..." /></SelectTrigger>
                                <SelectContent>
                                    {tickets?.filter(t => t.id !== mergingTicket?.id && t.status !== 'closed' && !t.merged_into).map(t => (
                                        <SelectItem key={t.id} value={t.id}>
                                            #{t.number} — {t.subject.length > 50 ? t.subject.slice(0, 50) + '...' : t.subject}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-700 dark:text-amber-400">
                            <AlertTriangle className="h-4 w-4 inline mr-1.5 mb-0.5" />
                            The source ticket will be closed and marked as merged. This cannot be undone.
                        </div>
                        <div className="flex justify-end gap-3 pt-2">
                            <Button variant="ghost" onClick={() => { setMergingTicket(null); setMergeTargetId(''); }}>Cancel</Button>
                            <Button
                                disabled={!mergeTargetId || mergeMut.isPending}
                                onClick={() => mergingTicket && mergeMut.mutate({ sourceId: mergingTicket.id, targetId: mergeTargetId })}
                                className="bg-purple-600 hover:bg-purple-700 text-white"
                            >
                                <GitMerge className="h-4 w-4 mr-1.5" />
                                {mergeMut.isPending ? 'Merging...' : 'Merge Tickets'}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* ===== CANNED RESPONSES DIALOG ===== */}
            <Dialog open={cannedResponsesOpen} onOpenChange={setCannedResponsesOpen}>
                <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>IT Macros (Canned Responses)</DialogTitle>
                    </DialogHeader>
                    <div className="mt-4 space-y-6">
                        <div className="space-y-3">
                            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Existing Macros</h4>
                            {cannedResponses?.length === 0 ? (
                                <p className="text-xs text-muted-foreground italic">No macros saved yet.</p>
                            ) : (
                                <div className="space-y-2">
                                    {cannedResponses?.map(macro => (
                                        <div key={macro.id} className="flex flex-col sm:flex-row gap-2 sm:items-center justify-between p-3 border rounded-md bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold text-foreground truncate">{macro.title}</p>
                                                <p className="text-xs text-muted-foreground truncate">{macro.content}</p>
                                            </div>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600" onClick={() => deleteMacroMut.mutate(macro.id)} disabled={deleteMacroMut.isPending}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Create New Macro</h4>
                            <form className="space-y-3" onSubmit={macroForm.handleSubmit((data) => addMacroMut.mutate(data))}>
                                <div className="space-y-1">
                                    <Label className="text-xs text-slate-500">Macro Title</Label>
                                    <Input placeholder="e.g. Printer Reset Instructions" {...macroForm.register('title', { required: true })} />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs text-slate-500">Response Content</Label>
                                    <Textarea placeholder="The actual text that will be pasted into the resolution box..." className="min-h-[80px]" {...macroForm.register('content', { required: true })} />
                                </div>
                                <div className="flex justify-end pt-2">
                                    <Button type="submit" disabled={addMacroMut.isPending} className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm h-8">
                                        {addMacroMut.isPending ? 'Saving...' : 'Save Macro'}
                                    </Button>
                                </div>
                            </form>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
