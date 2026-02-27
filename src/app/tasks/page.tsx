'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getTasks, addTask, updateTask, deleteTask, getTaskStats } from '@/services/tasks';
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
import { Plus, Search, Trash2, CheckCircle, Circle, ListTodo, Clock, Pencil, LayoutDashboard, List } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { ImportanceLevel, CreateTaskInput } from '@/types/database';

const importanceConfig: Record<ImportanceLevel, { label: string; color: string; icon: string }> = {
    urgent: { label: 'Urgent', color: 'bg-red-600/20 text-red-500 border-red-600/30 hover:bg-red-600/20', icon: '🔴' },
    important: { label: 'Important', color: 'bg-orange-600/20 text-orange-500 border-orange-600/30 hover:bg-orange-600/20', icon: '🟠' },
    neutral: { label: 'Neutral', color: 'bg-blue-600/20 text-blue-500 border-blue-600/30 hover:bg-blue-600/20', icon: '🔵' },
};

const taskSchema = z.object({
    date: z.string().min(1, 'Date required'),
    text: z.string().min(3, 'Task description required'),
    importance: z.enum(['urgent', 'important', 'neutral']),
});

export default function TasksPage() {
    const [formOpen, setFormOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [view, setView] = useState<'dashboard' | 'list'>('list');
    const { taskFilter, taskImportance, taskSearch, setTaskFilter, setTaskImportance, setTaskSearch } = useAppStore();
    const queryClient = useQueryClient();

    const { data: stats, isLoading: statsLoading } = useQuery({ queryKey: ['task-stats'], queryFn: getTaskStats });
    const { data: tasks, isLoading } = useQuery({
        queryKey: ['tasks', taskFilter, taskImportance, taskSearch],
        queryFn: () => getTasks({
            completed: taskFilter === 'completed' ? true : taskFilter === 'pending' ? false : undefined,
            importance: taskImportance === 'all' ? undefined : taskImportance,
            search: taskSearch || undefined,
        }),
    });

    const deleteMut = useMutation({
        mutationFn: deleteTask,
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tasks'] }); queryClient.invalidateQueries({ queryKey: ['task-stats'] }); toast.success('Task deleted'); },
    });

    const toggleMut = useMutation({
        mutationFn: ({ id, completed }: { id: string; completed: boolean }) => updateTask(id, { completed }),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tasks'] }); queryClient.invalidateQueries({ queryKey: ['task-stats'] }); toast.success('Status updated'); },
    });

    const form = useForm<CreateTaskInput>({
        resolver: zodResolver(taskSchema),
        defaultValues: { date: new Date().toISOString().split('T')[0], text: '', importance: 'neutral' },
    });

    const createMut = useMutation({
        mutationFn: addTask,
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tasks'] }); queryClient.invalidateQueries({ queryKey: ['task-stats'] }); toast.success('Task added'); form.reset(); setFormOpen(false); setEditingId(null); },
        onError: (e: Error) => toast.error(e.message),
    });

    const updateMut = useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<CreateTaskInput & { completed: boolean }> }) => updateTask(id, data),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tasks'] }); queryClient.invalidateQueries({ queryKey: ['task-stats'] }); toast.success('Task updated'); form.reset(); setFormOpen(false); setEditingId(null); },
        onError: (e: Error) => toast.error(e.message),
    });

    const handleEdit = (task: { id: string; date: string; text: string; importance: ImportanceLevel }) => {
        setEditingId(task.id);
        form.reset({ date: task.date, text: task.text, importance: task.importance });
        setFormOpen(true);
    };

    const handleSubmit = (data: CreateTaskInput) => {
        if (editingId) {
            updateMut.mutate({ id: editingId, data });
        } else {
            createMut.mutate(data);
        }
    };


    const statCards = [
        { label: 'Total Tasks', value: stats?.total ?? 0, icon: ListTodo, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
        { label: 'Completed', value: stats?.completed ?? 0, icon: CheckCircle, color: 'text-teal-500', bg: 'bg-teal-500/10' },
        { label: 'Pending', value: stats?.pending ?? 0, icon: Clock, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    ];

    const completionRate = stats && stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

    // Importance breakdown for dashboard
    const importanceBreakdown = tasks ? Object.entries(
        tasks.reduce((acc, t) => {
            acc[t.importance] = (acc[t.importance] || 0) + 1;
            return acc;
        }, {} as Record<string, number>)
    ).sort((a, b) => b[1] - a[1]) : [];

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-foreground">📝 Task Management</h1>
                    <p className="text-muted-foreground mt-1">Create, prioritize, and track daily tasks</p>
                </div>
                <Button onClick={() => { setEditingId(null); form.reset(); setFormOpen(true); }} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                    <Plus className="h-4 w-4 mr-2" /> New Task
                </Button>
            </div>

            {/* View Toggle */}
            <div className="flex justify-center">
                <div className="flex items-center rounded-lg border p-1 gap-1">
                    <Button variant={view === 'dashboard' ? 'default' : 'ghost'} size="sm" onClick={() => setView('dashboard')} className={view === 'dashboard' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}>
                        <LayoutDashboard className="h-4 w-4 mr-1" /> Dashboard
                    </Button>
                    <Button variant={view === 'list' ? 'default' : 'ghost'} size="sm" onClick={() => setView('list')} className={view === 'list' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}>
                        <List className="h-4 w-4 mr-1" /> View Tasks
                    </Button>
                </div>
            </div>

            {/* Stats */}
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
                    <Card className="border shadow-sm">
                        <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Completion Rate</CardTitle></CardHeader>
                        <CardContent>
                            <div className="flex items-end gap-2 mb-3">
                                <span className="text-4xl font-bold text-foreground">{completionRate}%</span>
                                <span className="text-muted-foreground text-sm pb-1">{stats?.completed ?? 0} of {stats?.total ?? 0} completed</span>
                            </div>
                            <div className="h-3 bg-muted rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-1000" style={{ width: `${completionRate}%` }} />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border shadow-sm">
                        <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Task Breakdown by Importance</CardTitle></CardHeader>
                        <CardContent>
                            {importanceBreakdown.length === 0 ? (
                                <p className="text-muted-foreground text-center py-8">No tasks yet</p>
                            ) : (
                                <div className="space-y-3">
                                    {importanceBreakdown.map(([key, count]) => {
                                        const pct = tasks ? Math.round((count / tasks.length) * 100) : 0;
                                        const config = importanceConfig[key as ImportanceLevel];
                                        return (
                                            <div key={key} className="space-y-1">
                                                <div className="flex justify-between text-sm">
                                                    <span className="font-medium text-foreground">{config?.icon} {config?.label || key}</span>
                                                    <span className="text-muted-foreground">{count} ({pct}%)</span>
                                                </div>
                                                <div className="h-2 bg-muted rounded-full overflow-hidden">
                                                    <div className={`h-full rounded-full transition-all duration-700 ${key === 'urgent' ? 'bg-red-500' : key === 'important' ? 'bg-orange-500' : 'bg-blue-500'}`}
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
                            <Input placeholder="Search tasks..." value={taskSearch} onChange={(e) => setTaskSearch(e.target.value)} className="pl-10" />
                        </div>
                        <Select value={taskFilter} onValueChange={(v) => setTaskFilter(v as 'all' | 'completed' | 'pending')}>
                            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All</SelectItem>
                                <SelectItem value="completed">Completed</SelectItem>
                                <SelectItem value="pending">Pending</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={taskImportance} onValueChange={(v) => setTaskImportance(v as ImportanceLevel | 'all')}>
                            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Priority</SelectItem>
                                <SelectItem value="urgent">🔴 Urgent</SelectItem>
                                <SelectItem value="important">🟠 Important</SelectItem>
                                <SelectItem value="neutral">🔵 Neutral</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <Card className="border shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-12">Mark Done</TableHead>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Task</TableHead>
                                        <TableHead>Priority</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? Array.from({ length: 5 }).map((_, i) => (
                                        <TableRow key={i}>
                                            {Array.from({ length: 5 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}
                                        </TableRow>
                                    )) : tasks?.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">No tasks found</TableCell>
                                        </TableRow>
                                    ) : tasks?.map((task) => (
                                        <TableRow key={task.id} className={task.completed ? 'opacity-60' : ''}>
                                            <TableCell>
                                                <button onClick={() => toggleMut.mutate({ id: task.id, completed: !task.completed })} className="cursor-pointer p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-md hover:bg-muted/50 transition-colors">
                                                    {task.completed ? <CheckCircle className="h-5 w-5 text-emerald-500" /> : <Circle className="h-5 w-5 text-muted-foreground" />}
                                                </button>
                                            </TableCell>
                                            <TableCell className="text-muted-foreground">{task.date}</TableCell>
                                            <TableCell className={`font-medium ${task.completed ? 'line-through' : ''}`}>{task.text}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={importanceConfig[task.importance]?.color}>
                                                    {importanceConfig[task.importance]?.icon} {importanceConfig[task.importance]?.label}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500 hover:text-blue-400" onClick={() => handleEdit(task)} title="Edit">
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-400"><Trash2 className="h-4 w-4" /></Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>Delete this task?</AlertDialogTitle>
                                                                <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => deleteMut.mutate(task.id)}>Delete</AlertDialogAction>
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
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader><DialogTitle>{editingId ? 'Edit Task' : 'New Task'}</DialogTitle></DialogHeader>
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 mt-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Date</Label>
                                <Input type="date" {...form.register('date')} />
                            </div>
                            <div className="space-y-2">
                                <Label>Priority</Label>
                                <Select onValueChange={(v) => form.setValue('importance', v as ImportanceLevel)} defaultValue={form.getValues('importance') || 'neutral'}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="urgent">🔴 Urgent</SelectItem>
                                        <SelectItem value="important">🟠 Important</SelectItem>
                                        <SelectItem value="neutral">🔵 Neutral</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Task Description *</Label>
                            <Textarea placeholder="What needs to be done..." className="min-h-[80px]" {...form.register('text')} />
                            {form.formState.errors.text && <p className="text-red-500 text-xs">{form.formState.errors.text.message}</p>}
                        </div>
                        <div className="flex justify-end gap-3 pt-4">
                            <Button type="button" variant="ghost" onClick={() => setFormOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={createMut.isPending || updateMut.isPending} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                                {(createMut.isPending || updateMut.isPending) ? 'Saving...' : editingId ? 'Update Task' : 'Add Task'}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
