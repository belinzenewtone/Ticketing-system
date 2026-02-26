'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getTickets, addTicket, updateTicket, deleteTicket, getTicketStats, getCannedResponses, addCannedResponse, deleteCannedResponse } from '@/services/tickets';
import { getITStaff } from '@/services/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useAppStore } from '@/store/useAppStore';
import { Plus, Search, Trash2, Pencil, LayoutDashboard, List, Ticket, Clock, CheckCircle2, Loader2, Archive, UserPlus, Paperclip, Sparkles, AlertTriangle, BookTemplate } from 'lucide-react';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { TicketCategory, TicketPriority, TicketStatus, CreateTicketInput, Ticket as TicketType, TicketSentiment } from '@/types/database';
import { generateTicketSummary } from '@/services/ai';

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
    const { ticketCategory, ticketPriority, ticketStatus, ticketSearch, ticketDateRange, setTicketCategory, setTicketPriority, setTicketStatus, setTicketSearch, setTicketDateRange } = useAppStore();
    const queryClient = useQueryClient();

    // AI Summary State
    const [isSummarizing, setIsSummarizing] = useState(false);
    const [aiSummary, setAiSummary] = useState<string | null>(null);

    // Queries
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

    // Mutations
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
        mutationFn: ({ id, data }: { id: string; data: Partial<TicketType> }) => updateTicket(id, data),
        onSuccess: () => { invalidate(); toast.success('Ticket updated'); form.reset(); setFormOpen(false); setEditingTicket(null); },
        onError: (e: Error) => toast.error(e.message),
    });

    const deleteMut = useMutation({
        mutationFn: deleteTicket,
        onSuccess: () => { invalidate(); toast.success('Ticket deleted'); },
    });

    const statusMut = useMutation({
        mutationFn: ({ id, status }: { id: string; status: TicketStatus }) => updateTicket(id, { status }),
        onSuccess: () => { invalidate(); toast.success('Status updated'); },
    });

    const assignMut = useMutation({
        mutationFn: ({ id, assigned_to }: { id: string; assigned_to: string }) => updateTicket(id, { assigned_to, status: 'in-progress' }),
        onSuccess: () => { invalidate(); toast.success('Ticket assigned & In Progress'); },
    });

    // Form
    const form = useForm<CreateTicketInput>({
        resolver: zodResolver(ticketSchema),
        defaultValues: { ticket_date: new Date().toISOString().split('T')[0], employee_name: '', department: '', category: 'email', priority: 'medium', subject: '', description: '' },
    });

    // Canned Response Form 
    const macroForm = useForm<{ title: string, content: string }>({
        defaultValues: { title: '', content: '' }
    });

    const addMacroMut = useMutation({
        mutationFn: (data: { title: string, content: string }) => addCannedResponse(data.title, data.content),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['canned-responses'] }); toast.success('Macro added'); macroForm.reset(); },
        onError: (e: Error) => toast.error(e.message),
    });

    const deleteMacroMut = useMutation({
        mutationFn: deleteCannedResponse,
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['canned-responses'] }); toast.success('Macro deleted'); },
        onError: (e: Error) => toast.error(e.message),
    });

    const [editStatus, setEditStatus] = useState<TicketStatus>('open');
    const [editResolution, setEditResolution] = useState('');
    const [editInternalNotes, setEditInternalNotes] = useState('');
    const [editAssignee, setEditAssignee] = useState<string>('unassigned');

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
        setAiSummary(null); // Reset summary
        setFormOpen(true);
    };

    const handleGenerateSummary = async () => {
        if (!editingTicket?.description) return;
        setIsSummarizing(true);
        try {
            const sum = await generateTicketSummary(editingTicket.description, editResolution);
            setAiSummary(sum);
        } catch (error) {
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
                    assigned_to: editAssignee === 'unassigned' ? null : editAssignee
                }
            });
        } else {
            createMut.mutate({
                ...data,
            });
        }
    };

    useEffect(() => {
        if (!formOpen) {
            setEditingTicket(null);
            setEditResolution('');
            setEditInternalNotes('');
            setEditAssignee('unassigned');
            setAiSummary(null);
        }
    }, [formOpen]);

    // Stats cards
    const statCards = [
        { label: 'Total', value: stats?.total ?? 0, icon: Ticket, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
        { label: 'Open', value: stats?.open ?? 0, icon: Clock, color: 'text-blue-500', bg: 'bg-blue-500/10' },
        { label: 'In Progress', value: stats?.inProgress ?? 0, icon: Loader2, color: 'text-amber-500', bg: 'bg-amber-500/10' },
        { label: 'Resolved', value: stats?.resolved ?? 0, icon: CheckCircle2, color: 'text-teal-500', bg: 'bg-teal-500/10' },
    ];

    const resolutionRate = stats && stats.total > 0 ? Math.round(((stats.resolved + stats.closed) / stats.total) * 100) : 0;

    // Category breakdown
    const categoryBreakdown = tickets ? Object.entries(
        tickets.reduce((acc, t) => { acc[t.category] = (acc[t.category] || 0) + 1; return acc; }, {} as Record<string, number>)
    ).sort((a, b) => b[1] - a[1]) : [];

    return (
        <div className="space-y-6">
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

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {statCards.map((c) => (
                    <Card key={c.label} className="border shadow-sm">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
                            <div className={`p-2 rounded-lg ${c.bg}`}><c.icon className={`h-5 w-5 ${c.color}`} /></div>
                        </CardHeader>
                        <CardContent>
                            {statsLoading ? <Skeleton className="h-9 w-16" /> : <p className="text-3xl font-bold text-foreground">{c.value}</p>}
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* ===== DASHBOARD VIEW ===== */}
            {view === 'dashboard' && (
                <div className="space-y-6">
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
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Search tickets..." value={ticketSearch} onChange={(e) => setTicketSearch(e.target.value)} className="pl-10" />
                        </div>
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
                                        <TableHead>Status / Priority</TableHead>
                                        <TableHead>Assigned To</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? Array.from({ length: 5 }).map((_, i) => (
                                        <TableRow key={i}>
                                            {Array.from({ length: 7 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}
                                        </TableRow>
                                    )) : tickets?.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">No tickets found</TableCell>
                                        </TableRow>
                                    ) : tickets?.map((ticket) => (
                                        <TableRow key={ticket.id} className={ticket.status === 'closed' ? 'opacity-60' : ''}>
                                            <TableCell className="font-mono font-medium">{ticket.number}</TableCell>
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
                                            </TableCell>
                                            <TableCell className="space-y-1">
                                                <div>
                                                    <Badge variant="outline" className={statusConfig[ticket.status]?.color}>
                                                        {statusConfig[ticket.status]?.label}
                                                    </Badge>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="outline" className={priorityConfig[ticket.priority]?.color}>
                                                        {priorityConfig[ticket.priority]?.label}
                                                    </Badge>
                                                    {ticket.due_date && ticket.status !== 'resolved' && ticket.status !== 'closed' && (
                                                        <span className={`text-[10px] font-mono flex items-center gap-1 leading-none ${new Date(ticket.due_date) < new Date() ? 'text-red-500 font-bold' : 'text-slate-500'}`} title={`SLA Due: ${new Date(ticket.due_date).toLocaleString()}`}>
                                                            {new Date(ticket.due_date) < new Date() ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                                                            {new Date(ticket.due_date) < new Date() ? 'SLA BREACHED' : 'Due ' + new Date(ticket.due_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <span className="text-sm font-medium text-foreground">
                                                    {ticket.assigned_to && staffMap[ticket.assigned_to] ? staffMap[ticket.assigned_to] : <span className="text-slate-400 italic">Unassigned</span>}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    {/* Quick Assing to Me button */}
                                                    {profile?.id && ticket.assigned_to !== profile.id && ticket.status !== 'closed' && (
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500 hover:text-blue-400" onClick={() => assignMut.mutate({ id: ticket.id, assigned_to: profile.id })} title="Assign to me">
                                                            <UserPlus className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                    {/* Quick status buttons */}
                                                    {ticket.status === 'open' && (
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-500 hover:text-amber-400" onClick={() => statusMut.mutate({ id: ticket.id, status: 'in-progress' })} title="Start Working">
                                                            <Loader2 className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                    {ticket.status === 'in-progress' && (
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-500 hover:text-emerald-400" onClick={() => statusMut.mutate({ id: ticket.id, status: 'resolved' })} title="Mark Resolved">
                                                            <CheckCircle2 className="h-4 w-4" />
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
                                    ))}
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
                                {editingTicket?.due_date && (
                                    <Badge variant="outline" className={new Date(editingTicket.due_date) < new Date() && editingTicket.status !== 'resolved' && editingTicket.status !== 'closed' ? 'bg-red-50 text-red-600 border-red-200' : 'bg-slate-50 text-slate-500'}>
                                        SLA Due: {new Date(editingTicket.due_date).toLocaleString()}
                                    </Badge>
                                )}
                            </div>
                        </DialogTitle>
                    </DialogHeader>
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
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        className="h-6 px-2 text-xs text-emerald-600 hover:text-emerald-700 bg-emerald-50 max-w-fit"
                                        onClick={handleGenerateSummary}
                                        disabled={isSummarizing}
                                    >
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
                                <Label className="text-muted-foreground flex items-center gap-2">
                                    <Paperclip className="h-4 w-4" />
                                    Attachment Provided
                                </Label>
                                <a
                                    href={editingTicket.attachment_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-sm font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline underline-offset-4"
                                >
                                    View attached file
                                </a>
                            </div>
                        )}

                        {/* Status + Assignee + Resolution Notes — only visible when editing */}
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
                                        <AlertTriangle className="h-3 w-3 mr-1" />
                                        Internal IT Notes (Hidden from Employee)
                                    </Label>
                                    <Textarea placeholder="Private staff notes, debugging steps, etc." className="min-h-[60px] bg-amber-50/50 dark:bg-amber-950/10 border-amber-200 dark:border-amber-900/50" value={editInternalNotes} onChange={(e) => setEditInternalNotes(e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <Label>Public Resolution Notes</Label>
                                        {cannedResponses && cannedResponses.length > 0 && (
                                            <Select onValueChange={(v) => {
                                                const macro = cannedResponses.find(c => c.id === v);
                                                if (macro) setEditResolution((prev) => prev ? prev + '\n\n' + macro.content : macro.content);
                                            }}>
                                                <SelectTrigger className="h-7 w-[180px] text-xs">
                                                    <SelectValue placeholder="Insert canned response..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {cannedResponses.map(c => (
                                                        <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                                                    ))}
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
                </DialogContent>
            </Dialog>

            {/* ===== CANNED RESPONSES (MACRO) DIALOG ===== */}
            <Dialog open={cannedResponsesOpen} onOpenChange={setCannedResponsesOpen}>
                <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>IT Macros (Canned Responses)</DialogTitle>
                    </DialogHeader>
                    <div className="mt-4 space-y-6">
                        {/* List Macros */}
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
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30" onClick={() => deleteMacroMut.mutate(macro.id)} disabled={deleteMacroMut.isPending}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Add New Macro Form */}
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
