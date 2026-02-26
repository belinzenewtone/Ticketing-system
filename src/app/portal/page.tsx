'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getTickets, addTicket } from '@/services/tickets';
import { getITStaff } from '@/services/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
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
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { useAppStore } from '@/store/useAppStore';
import { Plus, Search, Ticket, Clock, CheckCircle2, Loader2, Archive, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { TicketCategory, TicketPriority, TicketStatus, CreateTicketInput, Ticket as TicketType } from '@/types/database';

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
    critical: { label: 'Critical', color: 'bg-red-600/20 text-red-500 border-red-600/30' },
    high: { label: 'High', color: 'bg-orange-600/20 text-orange-500 border-orange-600/30' },
    medium: { label: 'Medium', color: 'bg-blue-600/20 text-blue-500 border-blue-600/30' },
    low: { label: 'Low', color: 'bg-slate-600/20 text-slate-400 border-slate-600/30' },
};

const statusConfig: Record<TicketStatus, { label: string; color: string; icon: React.ElementType }> = {
    open: { label: 'Open', color: 'bg-blue-600/20 text-blue-500 border-blue-600/30', icon: Ticket },
    'in-progress': { label: 'In Progress', color: 'bg-amber-600/20 text-amber-500 border-amber-600/30', icon: Loader2 },
    resolved: { label: 'Resolved', color: 'bg-emerald-600/20 text-emerald-500 border-emerald-600/30', icon: CheckCircle2 },
    closed: { label: 'Closed', color: 'bg-slate-600/20 text-slate-400 border-slate-600/30', icon: Archive },
};

// ── Validation ───────────────────────────────────────────────
const ticketSchema = z.object({
    category: z.enum(['email', 'account-login', 'password-reset', 'hardware', 'software', 'network-vpn', 'other']),
    priority: z.enum(['critical', 'high', 'medium', 'low']),
    subject: z.string().min(3, 'Subject required'),
    description: z.string().optional(),
});

type FormValues = z.infer<typeof ticketSchema>;

// ── Page ─────────────────────────────────────────────────────
export default function PortalPage() {
    const { profile } = useAppStore();
    const [formOpen, setFormOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [viewNotesTicket, setViewNotesTicket] = useState<TicketType | null>(null);
    const queryClient = useQueryClient();

    // Fetch IT Staff mapping
    const { data: staffList } = useQuery({ queryKey: ['staff'], queryFn: getITStaff });
    const staffMap = staffList?.reduce((acc, s) => { acc[s.id] = s.name; return acc; }, {} as Record<string, string>) || {};

    // Only fetch tickets created by this user
    const { data: tickets, isLoading } = useQuery({
        queryKey: ['portal-tickets', profile?.id, search],
        queryFn: () => getTickets({ created_by: profile?.id, search: search || undefined }),
        enabled: !!profile?.id,
    });

    const createMut = useMutation({
        mutationFn: addTicket,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['portal-tickets'] });
            toast.success('Ticket submitted successfully');
            form.reset();
            setFormOpen(false);
        },
        onError: (e: Error) => toast.error(e.message),
    });

    // Form
    const form = useForm<FormValues>({
        resolver: zodResolver(ticketSchema),
        defaultValues: { category: 'email', priority: 'medium', subject: '', description: '' },
    });

    const handleSubmit = (data: FormValues) => {
        if (!profile) return toast.error('Profile not loaded');

        const fullData: CreateTicketInput = {
            ticket_date: new Date().toISOString().split('T')[0],
            employee_name: profile.name,
            department: 'Employee Portal', // Simplified
            ...data
        };
        createMut.mutate(fullData);
    };

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            {/* Header Area */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-6 shadow-sm border border-slate-200 dark:border-slate-800 rounded-2xl">
                <div>
                    <h2 className="text-2xl font-bold text-foreground">Welcome, {profile?.name}</h2>
                    <p className="text-muted-foreground mt-1 text-sm">Need help? Report an issue to the IT department.</p>
                </div>
                <Button onClick={() => setFormOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white h-11 px-6 shadow-md shadow-emerald-500/20">
                    <Plus className="h-4 w-4 mr-2" /> Report Issue
                </Button>
            </div>

            {/* List View */}
            <div>
                <div className="flex justify-between items-end mb-4">
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Your Tickets</h3>
                    <div className="relative w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Search your tickets..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 h-9" />
                    </div>
                </div>

                <Card className="border shadow-sm overflow-hidden bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-slate-50/50 dark:bg-slate-800/50">
                                    <TableHead>Ticket #</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Subject</TableHead>
                                    <TableHead>Category</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Handler</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? Array.from({ length: 3 }).map((_, i) => (
                                    <TableRow key={i}>
                                        {Array.from({ length: 7 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}
                                    </TableRow>
                                )) : tickets?.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-16">
                                            <div className="flex flex-col items-center text-muted-foreground space-y-3">
                                                <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center">
                                                    <Ticket className="h-6 w-6 opacity-50" />
                                                </div>
                                                <p>You haven't reported any issues yet.</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : tickets?.map((ticket) => (
                                    <TableRow key={ticket.id}>
                                        <TableCell className="font-mono font-medium">#{ticket.number}</TableCell>
                                        <TableCell className="text-muted-foreground whitespace-nowrap text-sm">{ticket.ticket_date}</TableCell>
                                        <TableCell className="font-medium max-w-[200px] truncate" title={ticket.subject}>{ticket.subject}</TableCell>
                                        <TableCell>
                                            <span className="text-sm whitespace-nowrap flex items-center gap-1.5">
                                                <span>{categoryConfig[ticket.category]?.icon}</span>
                                                {categoryConfig[ticket.category]?.label}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={statusConfig[ticket.status]?.color}>
                                                {statusConfig[ticket.status]?.label}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                                                {ticket.assigned_to && staffMap[ticket.assigned_to] ? staffMap[ticket.assigned_to] : <span className="text-slate-400 italic font-normal">Unassigned</span>}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {ticket.resolution_notes && (
                                                <Button variant="ghost" size="sm" className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30" onClick={() => setViewNotesTicket(ticket)}>
                                                    <MessageSquare className="h-4 w-4 mr-2" /> View Notes
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </Card>
            </div>

            {/* ===== REPORT ISSUE DIALOG ===== */}
            <Dialog open={formOpen} onOpenChange={setFormOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Report an Issue</DialogTitle>
                        <DialogDescription>Describe the problem you are experiencing. IT will investigate and resolve it.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Category</Label>
                            <Select onValueChange={(v) => form.setValue('category', v as TicketCategory)} defaultValue={form.getValues('category')}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {Object.entries(categoryConfig).map(([k, v]) => (
                                        <SelectItem key={k} value={k}>{v.icon} {v.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Urgency</Label>
                            <Select onValueChange={(v) => form.setValue('priority', v as TicketPriority)} defaultValue={form.getValues('priority')}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="critical">🔴 Critical (Blocks entirely)</SelectItem>
                                    <SelectItem value="high">🟠 High (Major inconvenience)</SelectItem>
                                    <SelectItem value="medium">🔵 Medium (Normal issue)</SelectItem>
                                    <SelectItem value="low">⚪ Low (Minor request)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Subject</Label>
                            <Input placeholder="Short summary of the issue" {...form.register('subject')} />
                            {form.formState.errors.subject && <p className="text-red-500 text-xs">{form.formState.errors.subject.message}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label>Description</Label>
                            <Textarea placeholder="More details about what's going wrong..." className="min-h-[100px]" {...form.register('description')} />
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t border-border mt-6">
                            <Button type="button" variant="ghost" onClick={() => setFormOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={createMut.isPending} className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-500/20">
                                {createMut.isPending ? 'Submitting...' : 'Submit Ticket'}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* ===== VIEW NOTES DIALOG ===== */}
            <Dialog open={!!viewNotesTicket} onOpenChange={(open) => !open && setViewNotesTicket(null)}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>IT Response</DialogTitle>
                        <DialogDescription>Ticket #{viewNotesTicket?.number}: {viewNotesTicket?.subject}</DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed shadow-inner">
                            {viewNotesTicket?.resolution_notes}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Badge variant="outline" className={viewNotesTicket ? statusConfig[viewNotesTicket.status]?.color : ''}>
                                {viewNotesTicket ? statusConfig[viewNotesTicket.status]?.label : ''}
                            </Badge>
                            <span>— Resolved by {viewNotesTicket?.assigned_to && staffMap[viewNotesTicket.assigned_to] ? staffMap[viewNotesTicket.assigned_to] : 'IT Support'}</span>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
