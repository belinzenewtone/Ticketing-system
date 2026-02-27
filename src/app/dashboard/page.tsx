'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getEntries, addEntry, updateEntry, deleteEntry, getEntryStats } from '@/services/entries';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
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
import { Plus, Search, Trash2, CheckCircle, Circle, Mail, Clock, BarChart3, Pencil, LayoutDashboard, List } from 'lucide-react';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { ResolutionType, CreateEntryInput } from '@/types/database';

const resolutionConfig: Record<ResolutionType, { label: string; color: string }> = {
    sorted: { label: 'Sorted ✅', color: 'bg-emerald-600 text-white hover:bg-emerald-600' },
    'alt-email': { label: 'Alternative Email', color: 'bg-red-600 text-white hover:bg-red-600' },
    'alt-phone': { label: 'Alternative Phone', color: 'bg-orange-500 text-white hover:bg-orange-500' },
    'alt-both': { label: 'Alternative Both', color: 'bg-amber-500 text-white hover:bg-amber-500' },
    'never-used': { label: 'Never Used', color: 'bg-purple-600 text-white hover:bg-purple-600' },
    licensing: { label: 'Licensing', color: 'bg-blue-600 text-white hover:bg-blue-600' },
};

const entrySchema = z.object({
    entry_date: z.string().min(1, 'Date required'),
    employee_name: z.string().min(2, 'Name required'),
    work_email: z.string().email().refine(e => e.endsWith('@jtl.co.ke'), 'Must be @jtl.co.ke'),
    employee_phone: z.string().regex(/^\d{10}$/, 'Must be 10 digits'),
    alt_email_status: z.string(),
    alt_email: z.string().optional(),
    resolution: z.enum(['sorted', 'alt-email', 'alt-phone', 'alt-both', 'never-used', 'licensing']),
});

export default function DashboardPage() {
    const [formOpen, setFormOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [view, setView] = useState<'dashboard' | 'list'>('list');
    const { entryFilter, entryDateRange, entrySearch, setEntryFilter, setEntryDateRange, setEntrySearch } = useAppStore();
    const queryClient = useQueryClient();

    const { data: stats, isLoading: statsLoading } = useQuery({
        queryKey: ['entry-stats'],
        queryFn: getEntryStats,
    });

    const { data: entries, isLoading } = useQuery({
        queryKey: ['entries', entryFilter, entryDateRange, entrySearch],
        queryFn: () => getEntries({
            completed: entryFilter === 'sorted' ? true : entryFilter === 'pending' ? false : undefined,
            search: entrySearch || undefined,
            dateRange: entryDateRange,
        }),
    });

    const deleteMut = useMutation({
        mutationFn: deleteEntry,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['entries'] });
            queryClient.invalidateQueries({ queryKey: ['entry-stats'] });
            toast.success('Entry deleted');
        },
    });

    const toggleMut = useMutation({
        mutationFn: ({ id, completed }: { id: string; completed: boolean }) =>
            updateEntry(id, { completed }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['entries'] });
            queryClient.invalidateQueries({ queryKey: ['entry-stats'] });
            toast.success('Status updated');
        },
    });

    const form = useForm<CreateEntryInput>({
        resolver: zodResolver(entrySchema),
        defaultValues: {
            entry_date: new Date().toISOString().split('T')[0],
            employee_name: '', work_email: '', employee_phone: '',
            alt_email_status: 'doesnt-exist', alt_email: '', resolution: 'sorted',
        },
    });

    const createMut = useMutation({
        mutationFn: addEntry,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['entries'] });
            queryClient.invalidateQueries({ queryKey: ['entry-stats'] });
            toast.success('Entry added');
            form.reset();
            setFormOpen(false);
            setEditingId(null);
        },
        onError: (e: Error) => toast.error(e.message),
    });

    const updateMut = useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<CreateEntryInput> }) =>
            updateEntry(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['entries'] });
            queryClient.invalidateQueries({ queryKey: ['entry-stats'] });
            toast.success('Entry updated');
            form.reset();
            setFormOpen(false);
            setEditingId(null);
        },
        onError: (e: Error) => toast.error(e.message),
    });

    const handleEdit = (entry: { id: string; entry_date: string; employee_name: string; work_email: string; employee_phone: string; alt_email_status?: string; alt_email?: string; resolution: ResolutionType }) => {
        setEditingId(entry.id);
        form.reset({
            entry_date: entry.entry_date,
            employee_name: entry.employee_name,
            work_email: entry.work_email,
            employee_phone: entry.employee_phone,
            alt_email_status: entry.alt_email_status || 'doesnt-exist',
            alt_email: entry.alt_email || '',
            resolution: entry.resolution,
        });
        setFormOpen(true);
    };

    const handleSubmit = (data: CreateEntryInput) => {
        if (editingId) {
            updateMut.mutate({ id: editingId, data });
        } else {
            createMut.mutate(data);
        }
    };

    useEffect(() => { if (!formOpen) setEditingId(null); }, [formOpen]);

    const statCards = [
        { label: 'Total Entries', value: stats?.total ?? 0, icon: Mail, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
        { label: 'Sorted', value: stats?.sorted ?? 0, icon: CheckCircle, color: 'text-teal-500', bg: 'bg-teal-500/10' },
        { label: 'Pending', value: stats?.pending ?? 0, icon: Clock, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    ];

    // Resolution breakdown for dashboard view
    const resolutionBreakdown = entries ? Object.entries(
        entries.reduce((acc, e) => {
            acc[e.resolution] = (acc[e.resolution] || 0) + 1;
            return acc;
        }, {} as Record<string, number>)
    ).sort((a, b) => b[1] - a[1]) : [];

    const resolutionRate = stats && stats.total > 0 ? Math.round((stats.sorted / stats.total) * 100) : 0;

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-foreground">📧 Email Dashboard</h1>
                    <p className="text-muted-foreground mt-1">Track and resolve employee email issues</p>
                </div>
                <Button onClick={() => { setEditingId(null); form.reset(); setFormOpen(true); }} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                    <Plus className="h-4 w-4 mr-2" /> New Entry
                </Button>
            </div>

            {/* View Toggle */}
            <div className="flex justify-center">
                <div className="flex items-center rounded-lg border p-1 gap-1">
                    <Button variant={view === 'dashboard' ? 'default' : 'ghost'} size="sm" onClick={() => setView('dashboard')} className={view === 'dashboard' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}>
                        <LayoutDashboard className="h-4 w-4 mr-1" /> Dashboard
                    </Button>
                    <Button variant={view === 'list' ? 'default' : 'ghost'} size="sm" onClick={() => setView('list')} className={view === 'list' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}>
                        <List className="h-4 w-4 mr-1" /> View Emails
                    </Button>
                </div>
            </div>

            {/* Stats — shown on both views */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                    {/* Resolution Rate */}
                    <Card className="border shadow-sm">
                        <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Resolution Rate</CardTitle></CardHeader>
                        <CardContent>
                            <div className="flex items-end gap-2 mb-3">
                                <span className="text-4xl font-bold text-foreground">{resolutionRate}%</span>
                                <span className="text-muted-foreground text-sm pb-1">{stats?.sorted ?? 0} of {stats?.total ?? 0} resolved</span>
                            </div>
                            <div className="h-3 bg-muted rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-1000" style={{ width: `${resolutionRate}%` }} />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Resolution Breakdown */}
                    <Card className="border shadow-sm">
                        <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Resolution Status Breakdown</CardTitle></CardHeader>
                        <CardContent>
                            {resolutionBreakdown.length === 0 ? (
                                <p className="text-muted-foreground text-center py-8">No entries yet</p>
                            ) : (
                                <div className="space-y-3">
                                    {resolutionBreakdown.map(([key, count]) => {
                                        const pct = entries ? Math.round((count / entries.length) * 100) : 0;
                                        const config = resolutionConfig[key as ResolutionType];
                                        return (
                                            <div key={key} className="space-y-1">
                                                <div className="flex justify-between text-sm">
                                                    <span className="font-medium text-foreground">{config?.label || key}</span>
                                                    <span className="text-muted-foreground">{count} ({pct}%)</span>
                                                </div>
                                                <div className="h-2 bg-muted rounded-full overflow-hidden">
                                                    <div className={`h-full rounded-full transition-all duration-700 ${key === 'sorted' ? 'bg-emerald-500' : key === 'alt-email' ? 'bg-red-500' : key === 'alt-phone' ? 'bg-orange-500' : key === 'alt-both' ? 'bg-amber-500' : key === 'never-used' ? 'bg-purple-500' : 'bg-blue-500'}`}
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
                    {/* Filters */}
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Search entries..." value={entrySearch} onChange={(e) => setEntrySearch(e.target.value)} className="pl-10" />
                        </div>
                        <Select value={entryFilter} onValueChange={(v) => setEntryFilter(v as 'all' | 'sorted' | 'pending')}>
                            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All</SelectItem>
                                <SelectItem value="sorted">Sorted</SelectItem>
                                <SelectItem value="pending">Pending</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={entryDateRange ?? 'none'} onValueChange={(v) => setEntryDateRange(v === 'none' ? undefined : v as 'today' | 'week' | 'month' | 'year')}>
                            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Time Range" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">All Time</SelectItem>
                                <SelectItem value="today">Today</SelectItem>
                                <SelectItem value="week">This Week</SelectItem>
                                <SelectItem value="month">This Month</SelectItem>
                                <SelectItem value="year">This Year</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Table */}
                    <Card className="border shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
                                        <TableHead className="w-[120px] border-r border-slate-200/60 dark:border-slate-800/60">Entry</TableHead>
                                        <TableHead className="border-r border-slate-200/60 dark:border-slate-800/60">Employee & Contact</TableHead>
                                        <TableHead className="border-r border-slate-200/60 dark:border-slate-800/60">Resolution</TableHead>
                                        <TableHead className="text-center w-[100px] border-r border-slate-200/60 dark:border-slate-800/60">Complete</TableHead>
                                        <TableHead className="text-right w-[160px]">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? Array.from({ length: 5 }).map((_, i) => (
                                        <TableRow key={i}>
                                            {Array.from({ length: 5 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}
                                        </TableRow>
                                    )) : entries?.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">No entries found</TableCell>
                                        </TableRow>
                                    ) : entries?.map((entry) => (
                                        <TableRow key={entry.id} className={entry.completed ? 'opacity-60 bg-emerald-50/10 dark:bg-emerald-950/5' : ''}>
                                            <TableCell className="border-r border-slate-200/60 dark:border-slate-800/60 align-top">
                                                <div className="inline-flex items-center justify-center font-mono font-medium text-foreground border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-md px-2 py-1 shadow-sm mb-1.5 min-w-[50px]">
                                                    #{entry.number}
                                                </div>
                                                <div className="text-[10px] text-slate-500 mt-1">
                                                    {entry.entry_date}
                                                </div>
                                            </TableCell>
                                            <TableCell className="border-r border-slate-200/60 dark:border-slate-800/60">
                                                <div className="font-medium text-sm text-foreground">{entry.employee_name}</div>
                                                <div className="text-xs text-muted-foreground mt-0.5 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                                                    <span className="flex items-center gap-1 truncate"><Mail className="h-3 w-3" /> {entry.work_email}</span>
                                                    <span className="flex items-center gap-1 font-mono"><span className="text-[10px]">📱</span> {entry.employee_phone}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="border-r border-slate-200/60 dark:border-slate-800/60">
                                                <Badge variant="outline" className={`h-6 px-2 text-[11px] font-medium border-0 ${resolutionConfig[entry.resolution]?.color.replace('bg-', 'text-').replace('text-white', 'bg-opacity-10 dark:bg-opacity-20 ')} bg-current`}>
                                                    {resolutionConfig[entry.resolution]?.label.replace('✅', '').trim()}
                                                    {entry.resolution === 'sorted' && <CheckCircle className="h-3 w-3 ml-1" />}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-center border-r border-slate-200/60 dark:border-slate-800/60">
                                                <button onClick={() => toggleMut.mutate({ id: entry.id, completed: !entry.completed })} className="cursor-pointer mx-auto p-1.5 flex items-center justify-center rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                                                    {entry.completed
                                                        ? <CheckCircle className="h-5 w-5 text-emerald-500" />
                                                        : <Circle className="h-5 w-5 text-slate-300 dark:text-slate-600" />}
                                                </button>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30" onClick={() => handleEdit(entry)} title="Edit">
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    {!entry.completed && (
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30" onClick={() => toggleMut.mutate({ id: entry.id, completed: true })} title="Mark Complete">
                                                            <CheckCircle className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"><Trash2 className="h-4 w-4" /></Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>Delete Entry #{entry.number}?</AlertDialogTitle>
                                                                <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white" onClick={() => deleteMut.mutate(entry.id)}>Delete</AlertDialogAction>
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

            {/* Create/Edit Entry Form */}
            <Dialog open={formOpen} onOpenChange={setFormOpen}>
                <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader><DialogTitle>{editingId ? 'Edit Entry' : 'New Email Entry'}</DialogTitle></DialogHeader>
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 mt-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Date</Label>
                                <Input type="date" {...form.register('entry_date')} />
                            </div>
                            <div className="space-y-2">
                                <Label>Employee Name *</Label>
                                <Input placeholder="Full name" {...form.register('employee_name')} />
                                {form.formState.errors.employee_name && <p className="text-red-500 text-xs">{form.formState.errors.employee_name.message}</p>}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Work Email *</Label>
                                <Input placeholder="name@jtl.co.ke" {...form.register('work_email')} />
                                {form.formState.errors.work_email && <p className="text-red-500 text-xs">{form.formState.errors.work_email.message}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label>Phone *</Label>
                                <Input placeholder="0712345678" {...form.register('employee_phone')} />
                                {form.formState.errors.employee_phone && <p className="text-red-500 text-xs">{form.formState.errors.employee_phone.message}</p>}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Alternative Email Status</Label>
                                <Select onValueChange={(v) => form.setValue('alt_email_status', v)} defaultValue={form.getValues('alt_email_status') || 'doesnt-exist'}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="exists">Exists</SelectItem>
                                        <SelectItem value="doesnt-exist">Doesn&apos;t Exist</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            {form.watch('alt_email_status') !== 'exists' && (
                                <div className="space-y-2">
                                    <Label>Alternative Email</Label>
                                    <Input placeholder="alt@gmail.com" {...form.register('alt_email')} />
                                </div>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label>Resolution *</Label>
                            <Select onValueChange={(v) => form.setValue('resolution', v as ResolutionType)} defaultValue={form.getValues('resolution') || 'sorted'}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="sorted">✅ Sorted</SelectItem>
                                    <SelectItem value="alt-email">🔴 Alternative Email</SelectItem>
                                    <SelectItem value="alt-phone">🟠 Alternative Phone</SelectItem>
                                    <SelectItem value="alt-both">🟡 Alternative Both</SelectItem>
                                    <SelectItem value="never-used">🟣 Never Used</SelectItem>
                                    <SelectItem value="licensing">🔵 Licensing</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex justify-end gap-3 pt-4">
                            <Button type="button" variant="ghost" onClick={() => setFormOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={createMut.isPending || updateMut.isPending} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                                {(createMut.isPending || updateMut.isPending) ? 'Saving...' : editingId ? 'Update Entry' : 'Add Entry'}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
