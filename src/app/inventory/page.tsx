'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMachines, addMachine, updateMachine, deleteMachine, getMachineStats } from '@/services/machines';
import { useUnreadComments } from '@/hooks/useUnreadComments';
import { ChatInterface } from '@/components/ChatInterface';
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
import { Plus, Search, Trash2, Monitor, Package, Clock, CheckCircle, XCircle, Pencil, LayoutDashboard, List, Laptop, MessageSquare, Circle } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { MachineReason, MachineStatus, CreateMachineInput, MachineRequest } from '@/types/database';

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
    resolution_notes: z.string().optional(),
    internal_notes: z.string().optional(),
    user_name: z.string().optional(),
    supply_name: z.string().optional(),
});

export default function InventoryPage() {
    const [formOpen, setFormOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [view, setView] = useState<'dashboard' | 'list'>('list');
    const [viewCommentsMachine, setViewCommentsMachine] = useState<MachineRequest | null>(null);
    const { machineStatus, machineSearch, setMachineStatus, setMachineSearch, profile } = useAppStore();
    const { readCounts, isInitialized } = useUnreadComments();
    const [typeFilter, setTypeFilter] = useState<'all' | 'hardware' | 'desktop' | 'laptop' | 'supplies'>('all');

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
            resolution_notes: m.resolution_notes || '',
            internal_notes: m.internal_notes || '',
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
                <div className="flex items-center rounded-lg border p-1 gap-1">
                    <Button variant={view === 'dashboard' ? 'default' : 'ghost'} size="sm" onClick={() => setView('dashboard')} className={view === 'dashboard' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}>
                        <LayoutDashboard className="h-4 w-4 mr-1" /> Dashboard
                    </Button>
                    <Button variant={view === 'list' ? 'default' : 'ghost'} size="sm" onClick={() => setView('list')} className={view === 'list' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}>
                        <List className="h-4 w-4 mr-1" /> List View
                    </Button>
                </div>
            </div>

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
                <>
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1 min-w-[160px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Search requester, item or email..." value={machineSearch} onChange={(e) => setMachineSearch(e.target.value)} className="pl-10" />
                        </div>
                        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as any)}>
                            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Category" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Items</SelectItem>
                                <SelectItem value="hardware">All Hardware</SelectItem>
                                <SelectItem value="desktop">Desktop PC</SelectItem>
                                <SelectItem value="laptop">Laptop PC</SelectItem>
                                <SelectItem value="supplies">Supplies Only</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={machineStatus} onValueChange={(v) => setMachineStatus(v as any)}>
                            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Status</SelectItem>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="approved">Approved</SelectItem>
                                <SelectItem value="fulfilled">Fulfilled</SelectItem>
                                <SelectItem value="rejected">Rejected</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <Card className="border shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
                                    <TableHead className="w-[110px] border-r border-slate-200/60 dark:border-slate-800/60">No. & Priority</TableHead>
                                    <TableHead className="border-r border-slate-200/60 dark:border-slate-800/60">Requester</TableHead>
                                    <TableHead className="border-r border-slate-200/60 dark:border-slate-800/60">Source</TableHead>
                                    <TableHead className="border-r border-slate-200/60 dark:border-slate-800/60">Item / Category</TableHead>
                                    <TableHead className="border-r border-slate-200/60 dark:border-slate-800/60">Email</TableHead>
                                    <TableHead className="border-r border-slate-200/60 dark:border-slate-800/60">Reason / Details</TableHead>
                                    <TableHead className="border-r border-slate-200/60 dark:border-slate-800/60">Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? Array.from({ length: 5 }).map((_, i) => (
                                    <TableRow key={i}>
                                        {Array.from({ length: 8 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}
                                    </TableRow>
                                )) : items?.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                                            <Package className="h-8 w-8 opacity-20 mx-auto mb-2" />
                                            No inventory requests found
                                        </TableCell>
                                    </TableRow>
                                ) : items?.map((m: MachineRequest) => (
                                    <TableRow key={m.id} className="group">
                                        <TableCell className="border-r border-slate-200/60 dark:border-slate-800/60 align-top">
                                            <div className="inline-flex items-center justify-center font-mono font-medium text-foreground border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-md px-2 py-1 shadow-sm mb-1.5 min-w-[40px]">
                                                #{m.number}
                                            </div>
                                            <div className="flex flex-col gap-0.5 mt-1">
                                                <span className="flex items-center gap-1.5 text-[11px] font-medium text-foreground w-fit">
                                                    <Circle className={cn("h-2.5 w-2.5 fill-current", m.importance === 'urgent' ? 'text-red-500' : m.importance === 'important' ? 'text-orange-500' : 'text-blue-500')} />
                                                    {m.importance.charAt(0).toUpperCase() + m.importance.slice(1)}
                                                </span>
                                                <div className="text-[10px] text-slate-500 mt-0.5">{m.date}</div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="border-r border-slate-200/60 dark:border-slate-800/60">
                                            <div className="font-medium text-sm text-foreground">{m.requester_name}</div>
                                            {m.user_name && <div className="text-[10px] text-slate-400">{m.user_name}</div>}
                                        </TableCell>
                                        <TableCell className="border-r border-slate-200/60 dark:border-slate-800/60">
                                            <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0.5 h-auto uppercase font-bold", m.requested_from === 'admin' ? 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/20' : 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/20')}>
                                                {m.requested_from || 'portal'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="border-r border-slate-200/60 dark:border-slate-800/60">
                                            <div className="flex items-center gap-2">
                                                {m.item_type === 'supplies' ? <Package className="h-3.5 w-3.5 text-amber-500" /> : m.item_type === 'laptop' ? <Laptop className="h-3.5 w-3.5 text-indigo-500" /> : <Monitor className="h-3.5 w-3.5 text-blue-500" />}
                                                <span className="font-medium text-sm text-foreground">{m.supply_name || (m.item_type === 'desktop' ? 'Desktop PC' : m.item_type === 'laptop' ? 'Laptop Computer' : m.item_type)}</span>
                                                <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono">x{m.item_count}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-xs text-slate-500 border-r border-slate-200/60 dark:border-slate-800/60">{m.work_email}</TableCell>
                                        <TableCell className="text-xs text-slate-500 border-r border-slate-200/60 dark:border-slate-800/60">
                                            {m.item_type === 'supplies' ? (m.supply_name || 'Supplies') : (m.reason ? reasonLabels[m.reason as MachineReason] : (m.notes || m.importance))}
                                        </TableCell>
                                        <TableCell className="border-r border-slate-200/60 dark:border-slate-800/60">
                                            <Select value={m.status} onValueChange={(v) => updateStatusMut.mutate({ id: m.id, status: v as MachineStatus })}>
                                                <SelectTrigger className={cn(
                                                    "h-7 w-[110px] text-[10px] font-bold uppercase border-0 shadow-none focus:ring-0",
                                                    m.status === 'pending' ? 'bg-amber-500/15 text-amber-600' :
                                                    m.status === 'approved' ? 'bg-blue-500/15 text-blue-600' :
                                                    m.status === 'fulfilled' ? 'bg-emerald-500/15 text-emerald-600' :
                                                    'bg-red-500/15 text-red-600'
                                                )}>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="pending">Pending</SelectItem>
                                                    <SelectItem value="approved">Approved</SelectItem>
                                                    <SelectItem value="fulfilled">Fulfilled</SelectItem>
                                                    <SelectItem value="rejected">Rejected</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                        <TableCell className="text-right w-[120px]">
                                            <div className="flex items-center justify-end gap-1">
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 relative" onClick={() => setViewCommentsMachine(m)}>
                                                    <MessageSquare className="h-3.5 w-3.5" />
                                                    {isInitialized && m.comment_count > (readCounts[m.id] || 0) && (
                                                        <span className="absolute top-1 right-1 flex h-2 w-2">
                                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                                                        </span>
                                                    )}
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => handleEdit(m)}>
                                                    <Pencil className="h-3.5 w-3.5" />
                                                </Button>
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"><Trash2 className="h-3.5 w-3.5" /></Button>
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
                    </Card>
                </>
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
                        <div className="space-y-2">
                            <Label className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-2">
                                <MessageSquare className="h-4 w-4" /> Resolution Notes (Public)
                            </Label>
                            <Textarea placeholder="Final response visible to the user..." className="border-emerald-100 dark:border-emerald-900/30" {...form.register('resolution_notes')} />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-2">
                                <Monitor className="h-4 w-4" /> Internal IT Notes
                            </Label>
                            <Textarea placeholder="IT only notes (not visible to users)..." className="border-emerald-100 dark:border-emerald-900/30" {...form.register('internal_notes')} />
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t mt-4">
                            <Button type="button" variant="ghost" onClick={() => { setFormOpen(false); form.reset(); setEditingId(null); }}>Cancel</Button>
                            <Button type="submit" disabled={createMut.isPending || updateMut.isPending} className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/20">
                                {(createMut.isPending || updateMut.isPending) ? 'Processing...' : editingId ? 'Update Inventory' : 'Create Entry'}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
            {/* ===== VIEW UPDATES / COMMENTS DIALOG (Simplified with ChatInterface) ===== */}
            <Dialog open={!!viewCommentsMachine} onOpenChange={(open) => !open && setViewCommentsMachine(null)}>
                <DialogContent className="sm:max-w-[500px] h-[600px] flex flex-col p-0 overflow-hidden">
                    <DialogHeader className="p-4 border-b">
                        <DialogTitle className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <MessageSquare className="h-5 w-5 text-emerald-500" />
                                <span>Updates for Request #{viewCommentsMachine?.number}</span>
                            </div>
                            <div className="mr-6">
                                <Badge variant="outline" className="text-[10px] uppercase font-bold">{viewCommentsMachine?.status}</Badge>
                            </div>
                        </DialogTitle>
                    </DialogHeader>

                    {viewCommentsMachine && (
                        <ChatInterface
                            id={viewCommentsMachine.id}
                            isMachine={true}
                            isAdmin={true}
                            profile={profile}
                            number={viewCommentsMachine.number}
                            status={viewCommentsMachine.status}
                        />
                    )}
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
