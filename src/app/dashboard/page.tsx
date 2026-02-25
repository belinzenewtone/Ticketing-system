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
import { Plus, Search, Trash2, CheckCircle, Circle, Mail, Clock, BarChart3, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { ResolutionType, CreateEntryInput } from '@/types/database';

const resolutionConfig: Record<ResolutionType, { label: string; color: string }> = {
    sorted: { label: 'Sorted ✅', color: 'bg-emerald-600 text-white hover:bg-emerald-600' },
    'alt-email': { label: 'Alt Email', color: 'bg-red-600 text-white hover:bg-red-600' },
    'alt-phone': { label: 'Alt Phone', color: 'bg-orange-500 text-white hover:bg-orange-500' },
    'alt-both': { label: 'Alt Both', color: 'bg-amber-500 text-white hover:bg-amber-500' },
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

    // Reset form when dialog closes
    useEffect(() => {
        if (!formOpen) {
            setEditingId(null);
        }
    }, [formOpen]);

    const statCards = [
        { label: 'Total Entries', value: stats?.total ?? 0, icon: Mail, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
        { label: 'Sorted', value: stats?.sorted ?? 0, icon: CheckCircle, color: 'text-teal-500', bg: 'bg-teal-500/10' },
        { label: 'Pending', value: stats?.pending ?? 0, icon: Clock, color: 'text-amber-500', bg: 'bg-amber-500/10' },
        { label: 'Completed', value: stats?.completed ?? 0, icon: BarChart3, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    ];

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

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
                            <TableRow>
                                <TableHead>#</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Employee</TableHead>
                                <TableHead>Work Email</TableHead>
                                <TableHead>Phone</TableHead>
                                <TableHead>Resolution</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? Array.from({ length: 5 }).map((_, i) => (
                                <TableRow key={i}>
                                    {Array.from({ length: 8 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}
                                </TableRow>
                            )) : entries?.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">No entries found</TableCell>
                                </TableRow>
                            ) : entries?.map((entry) => (
                                <TableRow key={entry.id}>
                                    <TableCell className="font-mono font-medium">{entry.number}</TableCell>
                                    <TableCell className="text-muted-foreground">{entry.entry_date}</TableCell>
                                    <TableCell className="font-medium">{entry.employee_name}</TableCell>
                                    <TableCell className="text-muted-foreground">{entry.work_email}</TableCell>
                                    <TableCell className="text-muted-foreground">{entry.employee_phone}</TableCell>
                                    <TableCell>
                                        <Badge className={resolutionConfig[entry.resolution]?.color}>
                                            {resolutionConfig[entry.resolution]?.label}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <button onClick={() => toggleMut.mutate({ id: entry.id, completed: !entry.completed })} className="cursor-pointer">
                                            {entry.completed
                                                ? <CheckCircle className="h-5 w-5 text-emerald-500" />
                                                : <Circle className="h-5 w-5 text-muted-foreground" />}
                                        </button>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500 hover:text-blue-400" onClick={() => handleEdit(entry)} title="Edit">
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            {!entry.completed && (
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-500 hover:text-emerald-400" onClick={() => toggleMut.mutate({ id: entry.id, completed: true })} title="Mark Complete">
                                                    <CheckCircle className="h-4 w-4" />
                                                </Button>
                                            )}
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-400"><Trash2 className="h-4 w-4" /></Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Delete Entry #{entry.number}?</AlertDialogTitle>
                                                        <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                        <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => deleteMut.mutate(entry.id)}>Delete</AlertDialogAction>
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
                                <Label>Alt Email Status</Label>
                                <Select onValueChange={(v) => form.setValue('alt_email_status', v)} defaultValue={form.getValues('alt_email_status') || 'doesnt-exist'}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="exists">Exists</SelectItem>
                                        <SelectItem value="doesnt-exist">Doesn&apos;t Exist</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Alt Email</Label>
                                <Input placeholder="alt@gmail.com" {...form.register('alt_email')} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Resolution *</Label>
                            <Select onValueChange={(v) => form.setValue('resolution', v as ResolutionType)} defaultValue={form.getValues('resolution') || 'sorted'}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="sorted">✅ Sorted</SelectItem>
                                    <SelectItem value="alt-email">🔴 Alt Email</SelectItem>
                                    <SelectItem value="alt-phone">🟠 Alt Phone</SelectItem>
                                    <SelectItem value="alt-both">🟡 Alt Both</SelectItem>
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
