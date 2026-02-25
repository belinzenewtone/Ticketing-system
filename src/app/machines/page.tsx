'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMachines, addMachine, updateMachine, deleteMachine, getMachineStats } from '@/services/machines';
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
import { Plus, Search, Trash2, Monitor, Clock, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { MachineReason, MachineStatus, CreateMachineInput } from '@/types/database';

const statusConfig: Record<MachineStatus, { label: string; color: string }> = {
    pending: { label: 'Pending', color: 'bg-slate-600 text-white hover:bg-slate-600' },
    approved: { label: 'Approved', color: 'bg-blue-600 text-white hover:bg-blue-600' },
    fulfilled: { label: 'Fulfilled', color: 'bg-emerald-600 text-white hover:bg-emerald-600' },
    rejected: { label: 'Rejected', color: 'bg-red-600 text-white hover:bg-red-600' },
};

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
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['machines'] }); queryClient.invalidateQueries({ queryKey: ['machine-stats'] }); toast.success('Request added'); form.reset(); setFormOpen(false); },
        onError: (e: Error) => toast.error(e.message),
    });

    const statCards = [
        { label: 'Total', value: stats?.total ?? 0, icon: Monitor, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
        { label: 'Pending', value: stats?.pending ?? 0, icon: Clock, color: 'text-amber-500', bg: 'bg-amber-500/10' },
        { label: 'Fulfilled', value: stats?.fulfilled ?? 0, icon: CheckCircle, color: 'text-teal-500', bg: 'bg-teal-500/10' },
        { label: 'Rejected', value: stats?.rejected ?? 0, icon: XCircle, color: 'text-red-500', bg: 'bg-red-500/10' },
    ];

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-foreground">💻 Machine Requests</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">Track hardware requests for employees</p>
                </div>
                <Button onClick={() => setFormOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                    <Plus className="h-4 w-4 mr-2" /> New Request
                </Button>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {statCards.map((c) => (
                    <Card key={c.label} className="bg-white/60 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-slate-500 dark:text-slate-400">{c.label}</CardTitle>
                            <div className={`p-2 rounded-lg ${c.bg}`}><c.icon className={`h-5 w-5 ${c.color}`} /></div>
                        </CardHeader>
                        <CardContent>
                            {statsLoading ? <Skeleton className="h-9 w-16" /> : <p className="text-3xl font-bold text-foreground">{c.value}</p>}
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input placeholder="Search requests..." value={machineSearch} onChange={(e) => setMachineSearch(e.target.value)} className="pl-10 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-foreground" />
                </div>
                <Select value={machineReason} onValueChange={(v) => setMachineReason(v as MachineReason | 'all')}>
                    <SelectTrigger className="w-[160px] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                        <SelectItem value="all">All Reasons</SelectItem>
                        <SelectItem value="old-hardware">Old Hardware</SelectItem>
                        <SelectItem value="faulty">Faulty</SelectItem>
                        <SelectItem value="new-user">New User</SelectItem>
                    </SelectContent>
                </Select>
                <Select value={machineStatus} onValueChange={(v) => setMachineStatus(v as MachineStatus | 'all')}>
                    <SelectTrigger className="w-[160px] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="fulfilled">Fulfilled</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <Card className="bg-white/60 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-slate-200 dark:border-slate-800 hover:bg-transparent">
                                <TableHead className="text-slate-500 dark:text-slate-400">#</TableHead>
                                <TableHead className="text-slate-500 dark:text-slate-400">Date</TableHead>
                                <TableHead className="text-slate-500 dark:text-slate-400">Requester</TableHead>
                                <TableHead className="text-slate-500 dark:text-slate-400">User</TableHead>
                                <TableHead className="text-slate-500 dark:text-slate-400">Email</TableHead>
                                <TableHead className="text-slate-500 dark:text-slate-400">Reason</TableHead>
                                <TableHead className="text-slate-500 dark:text-slate-400">Status</TableHead>
                                <TableHead className="text-slate-500 dark:text-slate-400 text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? Array.from({ length: 5 }).map((_, i) => (
                                <TableRow key={i} className="border-slate-200 dark:border-slate-800">
                                    {Array.from({ length: 8 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}
                                </TableRow>
                            )) : machines?.length === 0 ? (
                                <TableRow className="border-slate-200 dark:border-slate-800">
                                    <TableCell colSpan={8} className="text-center py-12 text-slate-400">No requests found</TableCell>
                                </TableRow>
                            ) : machines?.map((m) => (
                                <TableRow key={m.id} className="border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                    <TableCell className="text-foreground font-mono font-medium">{m.number}</TableCell>
                                    <TableCell className="text-slate-600 dark:text-slate-300">{m.date}</TableCell>
                                    <TableCell className="text-foreground">{m.requester_name}</TableCell>
                                    <TableCell className="text-slate-600 dark:text-slate-300">{m.user_name}</TableCell>
                                    <TableCell className="text-slate-600 dark:text-slate-300">{m.work_email}</TableCell>
                                    <TableCell className="text-slate-600 dark:text-slate-300">{reasonLabels[m.reason]}</TableCell>
                                    <TableCell>
                                        <Select value={m.status} onValueChange={(v) => updateStatusMut.mutate({ id: m.id, status: v as MachineStatus })}>
                                            <SelectTrigger className="h-7 w-[110px] bg-transparent border-0 p-0">
                                                <Badge className={statusConfig[m.status]?.color}>{statusConfig[m.status]?.label}</Badge>
                                            </SelectTrigger>
                                            <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                                                <SelectItem value="pending">Pending</SelectItem>
                                                <SelectItem value="approved">Approved</SelectItem>
                                                <SelectItem value="fulfilled">Fulfilled</SelectItem>
                                                <SelectItem value="rejected">Rejected</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-400"><Trash2 className="h-4 w-4" /></Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle className="text-foreground">Delete Request #{m.number}?</AlertDialogTitle>
                                                    <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel className="bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-foreground">Cancel</AlertDialogCancel>
                                                    <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => deleteMut.mutate(m.id)}>Delete</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </Card>

            <Dialog open={formOpen} onOpenChange={setFormOpen}>
                <DialogContent className="sm:max-w-[600px] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-foreground max-h-[90vh] overflow-y-auto">
                    <DialogHeader><DialogTitle>New Machine Request</DialogTitle></DialogHeader>
                    <form onSubmit={form.handleSubmit((v) => createMut.mutate(v))} className="space-y-4 mt-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2"><Label>Date</Label><Input type="date" className="bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700" {...form.register('date')} /></div>
                            <div className="space-y-2"><Label>Requester Name *</Label><Input className="bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700" {...form.register('requester_name')} />
                                {form.formState.errors.requester_name && <p className="text-red-500 text-xs">{form.formState.errors.requester_name.message}</p>}</div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2"><Label>User Name *</Label><Input className="bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700" {...form.register('user_name')} />
                                {form.formState.errors.user_name && <p className="text-red-500 text-xs">{form.formState.errors.user_name.message}</p>}</div>
                            <div className="space-y-2"><Label>Work Email *</Label><Input placeholder="name@jtl.co.ke" className="bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700" {...form.register('work_email')} />
                                {form.formState.errors.work_email && <p className="text-red-500 text-xs">{form.formState.errors.work_email.message}</p>}</div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2"><Label>Reason *</Label>
                                <Select onValueChange={(v) => form.setValue('reason', v as MachineReason)} defaultValue="old-hardware">
                                    <SelectTrigger className="bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700"><SelectValue /></SelectTrigger>
                                    <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                                        <SelectItem value="old-hardware">Old Hardware</SelectItem>
                                        <SelectItem value="faulty">Faulty</SelectItem>
                                        <SelectItem value="new-user">New User</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2"><Label>Importance *</Label>
                                <Select onValueChange={(v) => form.setValue('importance', v as 'urgent' | 'important' | 'neutral')} defaultValue="neutral">
                                    <SelectTrigger className="bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700"><SelectValue /></SelectTrigger>
                                    <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                                        <SelectItem value="urgent">🔴 Urgent</SelectItem>
                                        <SelectItem value="important">🟠 Important</SelectItem>
                                        <SelectItem value="neutral">🔵 Neutral</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="space-y-2"><Label>Notes</Label><Textarea placeholder="Optional details..." className="bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700" {...form.register('notes')} /></div>
                        <div className="flex justify-end gap-3 pt-4">
                            <Button type="button" variant="ghost" onClick={() => setFormOpen(false)} className="text-slate-500">Cancel</Button>
                            <Button type="submit" disabled={createMut.isPending} className="bg-emerald-600 hover:bg-emerald-700 text-white">{createMut.isPending ? 'Adding...' : 'Add Request'}</Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
