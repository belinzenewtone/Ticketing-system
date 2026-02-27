'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMachines, addMachine, updateMachine, deleteMachine, getMachineStats } from '@/services/machines';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
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
import { Plus, Search, Trash2, Monitor, Clock, CheckCircle, XCircle, Pencil, LayoutDashboard, List } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { MachineReason, MachineStatus, CreateMachineInput } from '@/types/database';



const reasonLabels: Record<MachineReason, string> = {
    'old-hardware': 'Old Hardware',
    faulty: 'Faulty',
    'new-user': 'New User',
};

const machineSchema = z.object({
    date: z.string().min(1),
    requester_name: z.string().min(2, 'Name required'),
    user_name: z.string().min(2, 'User name required'),
    work_email: z.string().email().refine(e => e.endsWith('@jtl.co.ke'), 'Must be @jtl.co.ke'),
    reason: z.enum(['old-hardware', 'faulty', 'new-user']),
    importance: z.enum(['urgent', 'important', 'neutral']),
    notes: z.string().optional(),
});

export default function MachinesPage() {
    const [formOpen, setFormOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [view, setView] = useState<'dashboard' | 'list'>('list');
    const { machineReason, machineStatus, machineSearch, setMachineReason, setMachineStatus, setMachineSearch } = useAppStore();
    const queryClient = useQueryClient();

    const { data: stats, isLoading: statsLoading } = useQuery({ queryKey: ['machine-stats'], queryFn: getMachineStats });
    const { data: machines, isLoading } = useQuery({
        queryKey: ['machines', machineReason, machineStatus, machineSearch],
        queryFn: () => getMachines({
            reason: machineReason === 'all' ? undefined : machineReason,
            status: machineStatus === 'all' ? undefined : machineStatus,
            search: machineSearch || undefined,
        }),
    });

    const deleteMut = useMutation({
        mutationFn: deleteMachine,
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['machines'] }); queryClient.invalidateQueries({ queryKey: ['machine-stats'] }); toast.success('Request deleted'); },
    });

    const updateStatusMut = useMutation({
        mutationFn: ({ id, status }: { id: string; status: MachineStatus }) => updateMachine(id, { status }),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['machines'] }); queryClient.invalidateQueries({ queryKey: ['machine-stats'] }); toast.success('Status updated'); },
    });

    const form = useForm<CreateMachineInput>({
        resolver: zodResolver(machineSchema),
        defaultValues: { date: new Date().toISOString().split('T')[0], requester_name: '', user_name: '', work_email: '', reason: 'old-hardware', importance: 'neutral', notes: '' },
    });

    const createMut = useMutation({
        mutationFn: addMachine,
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['machines'] }); queryClient.invalidateQueries({ queryKey: ['machine-stats'] }); toast.success('Request added'); form.reset(); setFormOpen(false); setEditingId(null); },
        onError: (e: Error) => toast.error(e.message),
    });

    const updateMut = useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<CreateMachineInput> }) => updateMachine(id, data),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['machines'] }); queryClient.invalidateQueries({ queryKey: ['machine-stats'] }); toast.success('Request updated'); form.reset(); setFormOpen(false); setEditingId(null); },
        onError: (e: Error) => toast.error(e.message),
    });

    const handleEdit = (m: { id: string; date: string; requester_name: string; user_name: string; work_email: string; reason: MachineReason; importance: string; notes?: string }) => {
        setEditingId(m.id);
        form.reset({
            date: m.date, requester_name: m.requester_name, user_name: m.user_name,
            work_email: m.work_email, reason: m.reason,
            importance: m.importance as 'urgent' | 'important' | 'neutral', notes: m.notes || '',
        });
        setFormOpen(true);
    };

    const handleSubmit = (data: CreateMachineInput) => {
        if (editingId) { updateMut.mutate({ id: editingId, data }); }
        else { createMut.mutate(data); }
    };


    const statCards = [
        { label: 'Total', value: stats?.total ?? 0, icon: Monitor, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
        { label: 'Pending', value: stats?.pending ?? 0, icon: Clock, color: 'text-amber-500', bg: 'bg-amber-500/10' },
        { label: 'Fulfilled', value: stats?.fulfilled ?? 0, icon: CheckCircle, color: 'text-teal-500', bg: 'bg-teal-500/10' },
        { label: 'Rejected', value: stats?.rejected ?? 0, icon: XCircle, color: 'text-red-500', bg: 'bg-red-500/10' },
    ];

    const fulfilledRate = stats && stats.total > 0 ? Math.round((stats.fulfilled / stats.total) * 100) : 0;

    // Reason breakdown for dashboard
    const reasonBreakdown = machines ? Object.entries(
        machines.reduce((acc, m) => {
            acc[m.reason] = (acc[m.reason] || 0) + 1;
            return acc;
        }, {} as Record<string, number>)
    ).sort((a, b) => b[1] - a[1]) : [];

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-foreground">💻 Machine Requests</h1>
                    <p className="text-muted-foreground mt-1">Track hardware requests for employees</p>
                </div>
                <Button onClick={() => { setEditingId(null); form.reset(); setFormOpen(true); }} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                    <Plus className="h-4 w-4 mr-2" /> New Request
                </Button>
            </div>

            {/* View Toggle */}
            <div className="flex justify-center">
                <div className="flex items-center rounded-lg border p-1 gap-1">
                    <Button variant={view === 'dashboard' ? 'default' : 'ghost'} size="sm" onClick={() => setView('dashboard')} className={view === 'dashboard' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}>
                        <LayoutDashboard className="h-4 w-4 mr-1" /> Dashboard
                    </Button>
                    <Button variant={view === 'list' ? 'default' : 'ghost'} size="sm" onClick={() => setView('list')} className={view === 'list' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}>
                        <List className="h-4 w-4 mr-1" /> View Requests
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
                        <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Fulfillment Rate</CardTitle></CardHeader>
                        <CardContent>
                            <div className="flex items-end gap-2 mb-3">
                                <span className="text-4xl font-bold text-foreground">{fulfilledRate}%</span>
                                <span className="text-muted-foreground text-sm pb-1">{stats?.fulfilled ?? 0} of {stats?.total ?? 0} fulfilled</span>
                            </div>
                            <div className="h-3 bg-muted rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-1000" style={{ width: `${fulfilledRate}%` }} />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border shadow-sm">
                        <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Request Breakdown by Reason</CardTitle></CardHeader>
                        <CardContent>
                            {reasonBreakdown.length === 0 ? (
                                <p className="text-muted-foreground text-center py-8">No requests yet</p>
                            ) : (
                                <div className="space-y-3">
                                    {reasonBreakdown.map(([key, count]) => {
                                        const pct = machines ? Math.round((count / machines.length) * 100) : 0;
                                        return (
                                            <div key={key} className="space-y-1">
                                                <div className="flex justify-between text-sm">
                                                    <span className="font-medium text-foreground">{reasonLabels[key as MachineReason] || key}</span>
                                                    <span className="text-muted-foreground">{count} ({pct}%)</span>
                                                </div>
                                                <div className="h-2 bg-muted rounded-full overflow-hidden">
                                                    <div className={`h-full rounded-full transition-all duration-700 ${key === 'old-hardware' ? 'bg-orange-500' : key === 'faulty' ? 'bg-red-500' : 'bg-blue-500'}`}
                                                        style={{ width: `${pct}%` }} />
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
                            <Input placeholder="Search requests..." value={machineSearch} onChange={(e) => setMachineSearch(e.target.value)} className="pl-10" />
                        </div>
                        <Select value={machineReason} onValueChange={(v) => setMachineReason(v as MachineReason | 'all')}>
                            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Reasons</SelectItem>
                                <SelectItem value="old-hardware">Old Hardware</SelectItem>
                                <SelectItem value="faulty">Faulty</SelectItem>
                                <SelectItem value="new-user">New User</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={machineStatus} onValueChange={(v) => setMachineStatus(v as MachineStatus | 'all')}>
                            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Status</SelectItem>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="fulfilled">Fulfilled</SelectItem>
                                <SelectItem value="rejected">Rejected</SelectItem>
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
                                        <TableHead>Requester</TableHead>
                                        <TableHead>User</TableHead>
                                        <TableHead>Email</TableHead>
                                        <TableHead>Reason</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? Array.from({ length: 5 }).map((_, i) => (
                                        <TableRow key={i}>
                                            {Array.from({ length: 8 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}
                                        </TableRow>
                                    )) : machines?.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">No requests found</TableCell>
                                        </TableRow>
                                    ) : machines?.map((m) => (
                                        <TableRow key={m.id}>
                                            <TableCell className="font-mono font-medium">{m.number}</TableCell>
                                            <TableCell className="text-muted-foreground">{m.date}</TableCell>
                                            <TableCell className="font-medium">{m.requester_name}</TableCell>
                                            <TableCell className="text-muted-foreground">{m.user_name}</TableCell>
                                            <TableCell className="text-muted-foreground">{m.work_email}</TableCell>
                                            <TableCell className="text-muted-foreground">{reasonLabels[m.reason]}</TableCell>
                                            <TableCell>
                                                <Select
                                                    value={m.status}
                                                    onValueChange={(v) => updateStatusMut.mutate({ id: m.id, status: v as MachineStatus })}
                                                >
                                                    <SelectTrigger className={`h-8 w-[130px] text-xs font-semibold ${m.status === 'pending' ? 'text-slate-600 dark:text-slate-300' : m.status === 'fulfilled' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="pending">⏳ Pending</SelectItem>
                                                        <SelectItem value="fulfilled">📦 Fulfilled</SelectItem>
                                                        <SelectItem value="rejected">❌ Rejected</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500 hover:text-blue-400" onClick={() => handleEdit(m)} title="Edit">
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-400"><Trash2 className="h-4 w-4" /></Button>
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
                    <DialogHeader><DialogTitle>{editingId ? 'Edit Machine Request' : 'New Machine Request'}</DialogTitle></DialogHeader>
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 mt-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2"><Label>Date</Label><Input type="date" {...form.register('date')} /></div>
                            <div className="space-y-2"><Label>Requester Name *</Label><Input {...form.register('requester_name')} />
                                {form.formState.errors.requester_name && <p className="text-red-500 text-xs">{form.formState.errors.requester_name.message}</p>}</div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2"><Label>User Name *</Label><Input {...form.register('user_name')} />
                                {form.formState.errors.user_name && <p className="text-red-500 text-xs">{form.formState.errors.user_name.message}</p>}</div>
                            <div className="space-y-2"><Label>Work Email *</Label><Input placeholder="name@jtl.co.ke" {...form.register('work_email')} />
                                {form.formState.errors.work_email && <p className="text-red-500 text-xs">{form.formState.errors.work_email.message}</p>}</div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2"><Label>Reason *</Label>
                                <Select onValueChange={(v) => form.setValue('reason', v as MachineReason)} defaultValue={form.getValues('reason') || 'old-hardware'}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="old-hardware">Old Hardware</SelectItem>
                                        <SelectItem value="faulty">Faulty</SelectItem>
                                        <SelectItem value="new-user">New User</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2"><Label>Importance *</Label>
                                <Select onValueChange={(v) => form.setValue('importance', v as 'urgent' | 'important' | 'neutral')} defaultValue={form.getValues('importance') || 'neutral'}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="urgent">🔴 Urgent</SelectItem>
                                        <SelectItem value="important">🟠 Important</SelectItem>
                                        <SelectItem value="neutral">🔵 Neutral</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="space-y-2"><Label>Notes</Label><Textarea placeholder="Optional details..." {...form.register('notes')} /></div>
                        <div className="flex justify-end gap-3 pt-4">
                            <Button type="button" variant="ghost" onClick={() => setFormOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={createMut.isPending || updateMut.isPending} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                                {(createMut.isPending || updateMut.isPending) ? 'Saving...' : editingId ? 'Update Request' : 'Add Request'}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
