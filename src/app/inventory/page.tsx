'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMachines, addMachine, updateMachine, deleteMachine, getMachineStats } from '@/services/machines';
import { getComments, addComment } from '@/services/comments';
import { useUnreadComments } from '@/hooks/useUnreadComments';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
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
import { cn } from '@/lib/utils';
import { Plus, Search, Trash2, Monitor, Package, Clock, CheckCircle, XCircle, Pencil, LayoutDashboard, List, Laptop, MessageSquare, Send, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useState, useRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { MachineReason, MachineStatus, CreateMachineInput } from '@/types/database';

const reasonLabels: Record<MachineReason, string> = {
    'old-hardware': 'Old Hardware',
    faulty: 'Faulty',
    'new-user': 'New User',
};

const inventorySchema = z.object({
    date: z.string().min(1),
    requester_name: z.string().min(2, 'Name required'),
    work_email: z.string().email().refine(e => e.endsWith('@jtl.co.ke'), 'Must be @jtl.co.ke'),
    reason: z.enum(['old-hardware', 'faulty', 'new-user']).optional(),
    importance: z.enum(['urgent', 'important', 'neutral']),
    item_type: z.enum(['desktop', 'laptop', 'supplies']),
    item_count: z.coerce.number().int().min(1, 'Quantity must be at least 1').max(999, 'Quantity cannot exceed 999'),
    notes: z.string().optional(),
    user_name: z.string().optional(),
    supply_name: z.string().optional(),
});

export default function InventoryPage() {
    const [formOpen, setFormOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [view, setView] = useState<'dashboard' | 'list'>('list');
    const { machineStatus, machineSearch, setMachineStatus, setMachineSearch, profile } = useAppStore();
    const [typeFilter, setTypeFilter] = useState<'all' | 'hardware' | 'supplies' | 'desktop' | 'laptop'>('all');
    const { readCounts, markTicketAsRead, isInitialized } = useUnreadComments();
    const [viewCommentsMachine, setViewCommentsMachine] = useState<any | null>(null);
    const [newComment, setNewComment] = useState('');
    const [isPostingComment, setIsPostingComment] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const queryClient = useQueryClient();

    const { data: stats, isLoading: statsLoading } = useQuery({
        queryKey: ['inventory-stats', typeFilter],
        queryFn: () => getMachineStats(typeFilter === 'all' ? undefined : typeFilter as any)
    });

    const { data: items, isLoading } = useQuery({
        queryKey: ['inventory-list', typeFilter, machineStatus, machineSearch],
        queryFn: () => getMachines({
            status: machineStatus === 'all' ? undefined : machineStatus,
            search: machineSearch || undefined,
            item_type: typeFilter === 'all' ? undefined :
                typeFilter === 'hardware' ? 'hardware' :
                    typeFilter === 'supplies' ? 'supplies' :
                        typeFilter === 'desktop' ? 'desktop' :
                            typeFilter === 'laptop' ? 'laptop' : undefined
        }),
    });

    const { data: viewComments, refetch: refetchComments } = useQuery({
        queryKey: ['machine-comments', viewCommentsMachine?.id],
        queryFn: () => getComments(viewCommentsMachine!.id, true, true),
        enabled: !!viewCommentsMachine?.id,
    });

    useEffect(() => {
        if (viewCommentsMachine && viewComments) {
            markTicketAsRead(viewCommentsMachine.id, viewComments.length);
        }
    }, [viewCommentsMachine, viewComments, markTicketAsRead]);

    useEffect(() => {
        if (viewComments) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [viewComments]);

    const handleSendComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newComment.trim() || !viewCommentsMachine || !profile) return;
        setIsPostingComment(true);
        try {
            await addComment({ machine_id: viewCommentsMachine.id, content: newComment, is_internal: false }, profile.name || 'Admin');
            setNewComment('');
            refetchComments();
            queryClient.invalidateQueries({ queryKey: ['inventory-list'] });
        } catch (error: any) {
            toast.error(error.message || 'Failed to post comment');
        } finally {
            setIsPostingComment(false);
        }
    };

    const deleteMut = useMutation({
        mutationFn: deleteMachine,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['inventory-list'] });
            queryClient.invalidateQueries({ queryKey: ['inventory-stats'] });
            toast.success('Request deleted');
        },
    });

    const updateStatusMut = useMutation({
        mutationFn: ({ id, status }: { id: string; status: MachineStatus }) => updateMachine(id, { status }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['inventory-list'] });
            queryClient.invalidateQueries({ queryKey: ['inventory-stats'] });
            toast.success('Status updated');
        },
    });

    const form = useForm<CreateMachineInput>({
        resolver: zodResolver(inventorySchema) as any,
        defaultValues: {
            date: new Date().toISOString().split('T')[0],
            requester_name: '',
            work_email: '',
            reason: 'old-hardware',
            importance: 'neutral',
            notes: '',
            item_count: 1,
            item_type: 'supplies'
        },
    });

    const createMut = useMutation({
        mutationFn: addMachine,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['inventory-list'] });
            queryClient.invalidateQueries({ queryKey: ['inventory-stats'] });
            toast.success('Request added'); form.reset(); setFormOpen(false); setEditingId(null);
        },
        onError: (e: Error) => toast.error(e.message),
    });

    const updateMut = useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<CreateMachineInput> }) => updateMachine(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['inventory-list'] });
            queryClient.invalidateQueries({ queryKey: ['inventory-stats'] });
            toast.success('Request updated'); form.reset(); setFormOpen(false); setEditingId(null);
        },
        onError: (e: Error) => toast.error(e.message),
    });

    const handleEdit = (m: any) => {
        setEditingId(m.id as string);
        form.reset({
            date: m.date,
            requester_name: m.requester_name,
            work_email: m.work_email,
            reason: m.reason || 'old-hardware',
            importance: m.importance as 'urgent' | 'important' | 'neutral',
            notes: m.notes || '',
            item_count: m.item_count || 1,
            item_type: m.item_type as any,
            user_name: m.user_name || undefined,
            supply_name: m.supply_name || undefined
        });
        setFormOpen(true);
    };

    const handleSubmit = (data: CreateMachineInput) => {
        if (editingId) {
            updateMut.mutate({ id: editingId, data });
        } else {
            createMut.mutate({ ...data, requested_from: 'admin' });
        }
    };

    const statCards = [
        { label: 'Total Requests', value: stats?.total ?? 0, icon: Package, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
        { label: 'Pending', value: stats?.pending ?? 0, icon: Clock, color: 'text-amber-500', bg: 'bg-amber-500/10' },
        { label: 'Fulfilled', value: stats?.fulfilled ?? 0, icon: CheckCircle, color: 'text-teal-500', bg: 'bg-teal-500/10' },
        { label: 'Rejected', value: stats?.rejected ?? 0, icon: XCircle, color: 'text-red-500', bg: 'bg-red-500/10' },
    ];

    const fulfilledRate = stats && stats.total > 0 ? Math.round((stats.fulfilled / stats.total) * 100) : 0;

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-foreground">📦 Inventory Management</h1>
                    <p className="text-muted-foreground mt-1">Manage hardware and supplies requests</p>
                </div>
                <Button onClick={() => { setEditingId(null); form.reset(); setFormOpen(true); }} className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/20">
                    <Plus className="h-4 w-4 mr-2" /> New Request
                </Button>
            </div>

            <div className="flex justify-center">
                <div className="flex items-center rounded-xl bg-slate-100 dark:bg-slate-900 p-1.5 gap-1.5 border border-slate-200 dark:border-slate-800">
                    <Button variant={view === 'dashboard' ? 'default' : 'ghost'} size="sm" onClick={() => setView('dashboard')} className={cn("rounded-lg", view === 'dashboard' ? 'bg-white dark:bg-emerald-600 text-emerald-600 dark:text-white shadow-sm' : '')}>
                        <LayoutDashboard className="h-4 w-4 mr-1.5" /> Dashboard
                    </Button>
                    <Button variant={view === 'list' ? 'default' : 'ghost'} size="sm" onClick={() => setView('list')} className={cn("rounded-lg", view === 'list' ? 'bg-white dark:bg-emerald-600 text-emerald-600 dark:text-white shadow-sm' : '')}>
                        <List className="h-4 w-4 mr-1.5" /> List View
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {statCards.map((c) => (
                    <Card key={c.label} className="border-none bg-white dark:bg-slate-900 shadow-sm overflow-hidden relative">
                        <div className={`absolute top-0 left-0 w-1 h-full ${c.bg.replace('/10', '')}`} />
                        <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
                            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">{c.label}</CardTitle>
                            <c.icon className={`h-4 w-4 ${c.color}`} />
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                            {statsLoading ? <Skeleton className="h-8 w-16" /> : <p className="text-2xl font-bold text-foreground">{c.value}</p>}
                        </CardContent>
                    </Card>
                ))}
            </div>

            {view === 'dashboard' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card className="border shadow-sm">
                        <CardHeader><CardTitle className="text-base">Fulfillment Status</CardTitle></CardHeader>
                        <CardContent className="pt-0">
                            <div className="flex items-center justify-center p-6">
                                <div className="relative h-40 w-40 flex items-center justify-center">
                                    <svg className="h-full w-full transform -rotate-90">
                                        <circle cx="80" cy="80" r="70" fill="transparent" stroke="currentColor" strokeWidth="12" className="text-slate-100 dark:text-slate-800" />
                                        <circle cx="80" cy="80" r="70" fill="transparent" stroke="currentColor" strokeWidth="12" strokeDasharray={440} strokeDashoffset={440 - (440 * fulfilledRate) / 100} className="text-emerald-500 transition-all duration-1000" strokeLinecap="round" />
                                    </svg>
                                    <div className="absolute text-center">
                                        <p className="text-3xl font-bold">{fulfilledRate}%</p>
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-tight">Success Rate</p>
                                    </div>
                                </div>
                            </div>
                            <div className="flex justify-between text-sm text-muted-foreground border-t pt-4">
                                <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                    <span>{stats?.fulfilled ?? 0} Fulfilled</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full bg-slate-200 dark:bg-slate-700" />
                                    <span>{stats?.total ?? 0} Total</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border shadow-sm">
                        <CardHeader><CardTitle className="text-base">Distribution by Type</CardTitle></CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <DistributionRow label="Supplies" count={stats?.supplies || 0} total={stats?.total || 0} color="bg-amber-500" />
                                <DistributionRow label="Desktops" count={stats?.desktop || 0} total={stats?.total || 0} color="bg-blue-500" />
                                <DistributionRow label="Laptops" count={stats?.laptop || 0} total={stats?.total || 0} color="bg-indigo-500" />
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {view === 'list' && (
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input placeholder="Search requester, item or email..." value={machineSearch} onChange={(e) => setMachineSearch(e.target.value)} className="pl-10 h-10 border-slate-200 dark:border-slate-800" />
                        </div>
                        <div className="flex gap-2">
                            <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as any)}>
                                <SelectTrigger className="w-[140px] h-10 border-slate-200 dark:border-slate-800"><SelectValue placeholder="Category" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Items</SelectItem>
                                    <SelectItem value="hardware">All Hardware</SelectItem>
                                    <SelectItem value="desktop">Desktop PC</SelectItem>
                                    <SelectItem value="laptop">Laptop PC</SelectItem>
                                    <SelectItem value="supplies">Supplies Only</SelectItem>
                                </SelectContent>
                            </Select>
                            <Select value={machineStatus} onValueChange={(v) => setMachineStatus(v as any)}>
                                <SelectTrigger className="w-[140px] h-10 border-slate-200 dark:border-slate-800"><SelectValue placeholder="Status" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Status</SelectItem>
                                    <SelectItem value="pending">⏳ Pending</SelectItem>
                                    <SelectItem value="fulfilled">📦 Fulfilled</SelectItem>
                                    <SelectItem value="rejected">❌ Rejected</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
                                <TableRow>
                                    <TableHead className="w-16">No.</TableHead>
                                    <TableHead>Requester</TableHead>
                                    <TableHead>Source</TableHead>
                                    <TableHead>Item / Category</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Reason / Details</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? Array.from({ length: 5 }).map((_, i) => (
                                    <TableRow key={i}>
                                        {Array.from({ length: 7 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}
                                    </TableRow>
                                )) : items?.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-12 text-muted-foreground flex flex-col items-center gap-2">
                                            <Package className="h-8 w-8 opacity-20" />
                                            <span>No inventory requests found</span>
                                        </TableCell>
                                    </TableRow>
                                ) : items?.map((m) => (
                                    <TableRow key={m.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                                        <TableCell>
                                            <div className="font-mono text-[11px] font-bold text-slate-400 mb-1">{m.number}</div>
                                            <Badge variant="outline" className={cn(
                                                "text-[9px] px-1.5 py-0 h-4 w-fit font-bold uppercase",
                                                m.importance === 'urgent' ? 'text-red-600 border-red-100 bg-red-50' : m.importance === 'important' ? 'text-orange-600 border-orange-100 bg-orange-50' : 'text-slate-500 border-slate-100 bg-slate-50'
                                            )}>
                                                {m.importance}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="font-medium text-foreground">{m.requester_name}</div>
                                            <div className="text-[10px] text-slate-400">{m.date}</div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0.5 h-auto uppercase font-bold", m.requested_from === 'admin' ? 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/20' : 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/20')}>
                                                {m.requested_from || 'portal'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                {m.item_type === 'supplies' ? <Package className="h-3.5 w-3.5 text-amber-500" /> : m.item_type === 'laptop' ? <Laptop className="h-3.5 w-3.5 text-indigo-500" /> : <Monitor className="h-3.5 w-3.5 text-blue-500" />}
                                                <span className="capitalize">{m.supply_name || (m.item_type === 'desktop' ? 'Desktop PC' : m.item_type === 'laptop' ? 'Laptop Computer' : m.item_type)}</span>
                                                <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono">x{m.item_count}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-xs text-slate-500">{m.work_email}</TableCell>
                                        <TableCell className="text-xs text-slate-500">
                                            {m.item_type === 'supplies' ? (m.supply_name || 'Supplies') : (m.reason ? reasonLabels[m.reason as MachineReason] : (m.notes || m.importance))}
                                        </TableCell>
                                        <TableCell>
                                            <Select value={m.status} onValueChange={(v) => updateStatusMut.mutate({ id: m.id, status: v as MachineStatus })}>
                                                <SelectTrigger className={cn("h-7 w-[110px] text-[10px] font-bold uppercase", m.status === 'pending' ? 'text-slate-500 border-slate-200' : m.status === 'fulfilled' ? 'text-emerald-500 border-emerald-100 bg-emerald-50' : 'text-red-500 border-red-100 bg-red-50')}>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="pending">Pending</SelectItem>
                                                    <SelectItem value="fulfilled">Fulfilled</SelectItem>
                                                    <SelectItem value="rejected">Rejected</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-500 relative" onClick={() => setViewCommentsMachine(m)}>
                                                    <MessageSquare className="h-3.5 w-3.5" />
                                                    {isInitialized && m.public_comment_count > (readCounts[m.id] || 0) && (
                                                        <span className="absolute top-1 right-1 flex h-2 w-2">
                                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                                                        </span>
                                                    )}
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500 hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20" onClick={() => handleEdit(m)}>
                                                    <Pencil className="h-3.5 w-3.5" />
                                                </Button>
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 className="h-3.5 w-3.5" /></Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Delete Request #{m.number}?</AlertDialogTitle>
                                                            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => deleteMut.mutate(m.id)}>Delete</AlertDialogAction>
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
                </div>
            )}

            <Dialog open={formOpen} onOpenChange={(open) => { setFormOpen(open); if (!open) setEditingId(null); }}>
                <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader><DialogTitle>{editingId ? 'Edit Inventory Request' : 'New Inventory Entry'}</DialogTitle></DialogHeader>
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 mt-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2"><Label>Date</Label><Input type="date" {...form.register('date')} /></div>
                            <div className="space-y-2"><Label>Requester Name *</Label><Input placeholder="Full name" {...form.register('requester_name')} /></div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2"><Label>Category *</Label>
                                <Select onValueChange={(v) => form.setValue('item_type', v as any)} value={form.watch('item_type')}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="supplies">Supplies</SelectItem>
                                        <SelectItem value="desktop">Desktop PC</SelectItem>
                                        <SelectItem value="laptop">Laptop Computer</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2"><Label>Work Email *</Label><Input placeholder="name@jtl.co.ke" {...form.register('work_email')} /></div>
                        </div>

                        {form.watch('item_type') === 'supplies' ? (
                            <div className="space-y-2">
                                <Label>Supply Name *</Label>
                                <Input placeholder="e.g. Printer Toners, HP Laserjet M102" {...form.register('supply_name')} maxLength={20} />
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <Label>Reason for Request *</Label>
                                <Select onValueChange={(v) => form.setValue('reason', v as MachineReason)} value={form.watch('reason')}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="old-hardware">Old Hardware Replacement</SelectItem>
                                        <SelectItem value="faulty">Faulty Equipment</SelectItem>
                                        <SelectItem value="new-user">New User Onboarding</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2"><Label>Importance *</Label>
                                <Select onValueChange={(v) => form.setValue('importance', v as 'urgent' | 'important' | 'neutral')} value={form.watch('importance')}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="urgent">🔴 Urgent</SelectItem>
                                        <SelectItem value="important">🟠 Important</SelectItem>
                                        <SelectItem value="neutral">🔵 Neutral</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2"><Label>Quantity *</Label><Input type="number" min="1" max="999" required {...form.register('item_count')} /></div>
                        </div>

                        <div className="space-y-2"><Label>Notes</Label><Textarea placeholder="Additional context (optional)..." {...form.register('notes')} /></div>

                        <div className="flex justify-end gap-3 pt-4 border-t mt-4">
                            <Button type="button" variant="ghost" onClick={() => { setFormOpen(false); form.reset(); setEditingId(null); }}>Cancel</Button>
                            <Button type="submit" disabled={createMut.isPending || updateMut.isPending} className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/20">
                                {(createMut.isPending || updateMut.isPending) ? 'Processing...' : editingId ? 'Update Inventory' : 'Create Entry'}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
            {/* Comments Dialog */}
            <Dialog open={!!viewCommentsMachine} onOpenChange={(open) => { if (!open) setViewCommentsMachine(null); }}>
                <DialogContent className="sm:max-w-[500px] h-[600px] flex flex-col p-0">
                    <div className="p-4 border-b pb-4">
                        <DialogTitle className="flex items-center justify-between">
                            <span>Updates for REQ #{viewCommentsMachine?.number}</span>
                            <Badge variant="outline" className="text-[10px] uppercase">{viewCommentsMachine?.status}</Badge>
                        </DialogTitle>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {viewComments?.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2">
                                <MessageSquare className="h-8 w-8 opacity-20" />
                                <p className="text-xs">No updates yet. Send a message to the user.</p>
                            </div>
                        ) : (
                            viewComments?.map((c: any) => (
                                <div key={c.id} className={cn("flex flex-col max-w-[85%]", c.author_name === 'Admin' ? "ml-auto items-end" : "items-start")}>
                                    <div className={cn("px-4 py-2 rounded-2xl text-sm", c.author_name === 'Admin' ? "bg-emerald-600 text-white rounded-br-none" : "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-bl-none")}>
                                        {c.content}
                                    </div>
                                    <span className="text-[10px] text-slate-400 mt-1">
                                        {c.author_name} • {new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            ))
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                    <form onSubmit={handleSendComment} className="p-4 border-t flex gap-2">
                        <Input placeholder="Type your update here..." value={newComment} onChange={(e) => setNewComment(e.target.value)} />
                        <Button type="submit" size="icon" disabled={isPostingComment || !newComment.trim()} className="bg-emerald-600 hover:bg-emerald-700">
                            {isPostingComment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        </Button>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function DistributionRow({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    return (
        <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-medium">
                <span className="text-slate-600 dark:text-slate-400">{label}</span>
                <span className="text-slate-900 dark:text-slate-100">{count} ({pct}%)</span>
            </div>
            <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className={`h-full ${color} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
            </div>
        </div>
    );
}
