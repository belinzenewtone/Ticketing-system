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
import { Plus, Search, Trash2, CheckCircle, Circle, ListTodo, AlertTriangle, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { ImportanceLevel, CreateTaskInput } from '@/types/database';

const importanceConfig: Record<ImportanceLevel, { label: string; color: string; icon: string }> = {
    urgent: { label: 'Urgent', color: 'bg-red-600/20 text-red-400 border-red-600/30 hover:bg-red-600/20', icon: '🔴' },
    important: { label: 'Important', color: 'bg-orange-600/20 text-orange-400 border-orange-600/30 hover:bg-orange-600/20', icon: '🟠' },
    neutral: { label: 'Neutral', color: 'bg-blue-600/20 text-blue-400 border-blue-600/30 hover:bg-blue-600/20', icon: '🔵' },
};

const taskSchema = z.object({
    date: z.string().min(1, 'Date required'),
    text: z.string().min(3, 'Task description required'),
    importance: z.enum(['urgent', 'important', 'neutral']),
});

export default function TasksPage() {
    const [formOpen, setFormOpen] = useState(false);
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
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tasks'] }); queryClient.invalidateQueries({ queryKey: ['task-stats'] }); },
    });

    const form = useForm<CreateTaskInput>({
        resolver: zodResolver(taskSchema),
        defaultValues: { date: new Date().toISOString().split('T')[0], text: '', importance: 'neutral' },
    });

    const createMut = useMutation({
        mutationFn: addTask,
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tasks'] }); queryClient.invalidateQueries({ queryKey: ['task-stats'] }); toast.success('Task added'); form.reset(); setFormOpen(false); },
        onError: (e: Error) => toast.error(e.message),
    });

    const statCards = [
        { label: 'Total Tasks', value: stats?.total ?? 0, icon: ListTodo, color: 'text-indigo-400', bg: 'bg-indigo-600/10' },
        { label: 'Completed', value: stats?.completed ?? 0, icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-600/10' },
        { label: 'Pending', value: stats?.pending ?? 0, icon: Clock, color: 'text-amber-400', bg: 'bg-amber-600/10' },
        { label: 'Urgent', value: stats?.urgent ?? 0, icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-600/10' },
    ];

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white">📝 Task Management</h1>
                    <p className="text-slate-400 mt-1">Create, prioritize, and track daily tasks</p>
                </div>
                <Button onClick={() => setFormOpen(true)} className="bg-indigo-600 hover:bg-indigo-700">
                    <Plus className="h-4 w-4 mr-2" /> New Task
                </Button>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {statCards.map((c) => (
                    <Card key={c.label} className="bg-slate-900/60 border-slate-800">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-slate-400">{c.label}</CardTitle>
                            <div className={`p-2 rounded-lg ${c.bg}`}><c.icon className={`h-5 w-5 ${c.color}`} /></div>
                        </CardHeader>
                        <CardContent>
                            {statsLoading ? <Skeleton className="h-9 w-16" /> : <p className="text-3xl font-bold text-white">{c.value}</p>}
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Completion Progress */}
            {stats && stats.total > 0 && (
                <Card className="bg-slate-900/60 border-slate-800">
                    <CardContent className="pt-6">
                        <div className="flex justify-between text-sm mb-2">
                            <span className="text-slate-400">{stats.completed} of {stats.total} tasks completed</span>
                            <span className="text-white font-medium">{Math.round((stats.completed / stats.total) * 100)}%</span>
                        </div>
                        <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-1000"
                                style={{ width: `${(stats.completed / stats.total) * 100}%` }} />
                        </div>
                    </CardContent>
                </Card>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <Input placeholder="Search tasks..." value={taskSearch} onChange={(e) => setTaskSearch(e.target.value)} className="pl-10 bg-slate-900 border-slate-800 text-white" />
                </div>
                <Select value={taskFilter} onValueChange={(v) => setTaskFilter(v as 'all' | 'completed' | 'pending')}>
                    <SelectTrigger className="w-[150px] bg-slate-900 border-slate-800"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800">
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                    </SelectContent>
                </Select>
                <Select value={taskImportance} onValueChange={(v) => setTaskImportance(v as ImportanceLevel | 'all')}>
                    <SelectTrigger className="w-[150px] bg-slate-900 border-slate-800"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800">
                        <SelectItem value="all">All Priority</SelectItem>
                        <SelectItem value="urgent">🔴 Urgent</SelectItem>
                        <SelectItem value="important">🟠 Important</SelectItem>
                        <SelectItem value="neutral">🔵 Neutral</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <Card className="bg-slate-900/60 border-slate-800 overflow-hidden">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-slate-800 hover:bg-transparent">
                                <TableHead className="text-slate-400 w-12">Done</TableHead>
                                <TableHead className="text-slate-400">Date</TableHead>
                                <TableHead className="text-slate-400">Task</TableHead>
                                <TableHead className="text-slate-400">Priority</TableHead>
                                <TableHead className="text-slate-400 text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? Array.from({ length: 5 }).map((_, i) => (
                                <TableRow key={i} className="border-slate-800">
                                    {Array.from({ length: 5 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}
                                </TableRow>
                            )) : tasks?.length === 0 ? (
                                <TableRow className="border-slate-800">
                                    <TableCell colSpan={5} className="text-center py-12 text-slate-500">No tasks found</TableCell>
                                </TableRow>
                            ) : tasks?.map((task) => (
                                <TableRow key={task.id} className={`border-slate-800 hover:bg-slate-800/50 ${task.completed ? 'opacity-60' : ''}`}>
                                    <TableCell>
                                        <button onClick={() => toggleMut.mutate({ id: task.id, completed: !task.completed })} className="cursor-pointer">
                                            {task.completed ? <CheckCircle className="h-5 w-5 text-emerald-400" /> : <Circle className="h-5 w-5 text-slate-500" />}
                                        </button>
                                    </TableCell>
                                    <TableCell className="text-slate-300">{task.date}</TableCell>
                                    <TableCell className={`text-white ${task.completed ? 'line-through' : ''}`}>{task.text}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={importanceConfig[task.importance]?.color}>
                                            {importanceConfig[task.importance]?.icon} {importanceConfig[task.importance]?.label}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-300"><Trash2 className="h-4 w-4" /></Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent className="bg-slate-900 border-slate-800">
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle className="text-white">Delete this task?</AlertDialogTitle>
                                                    <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel className="bg-slate-800 border-slate-700 text-white">Cancel</AlertDialogCancel>
                                                    <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => deleteMut.mutate(task.id)}>Delete</AlertDialogAction>
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
                <DialogContent className="sm:max-w-[500px] bg-slate-900 border-slate-800 text-white">
                    <DialogHeader><DialogTitle>New Task</DialogTitle></DialogHeader>
                    <form onSubmit={form.handleSubmit((v) => createMut.mutate(v))} className="space-y-4 mt-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Date</Label>
                                <Input type="date" className="bg-slate-800 border-slate-700" {...form.register('date')} />
                            </div>
                            <div className="space-y-2">
                                <Label>Priority</Label>
                                <Select onValueChange={(v) => form.setValue('importance', v as ImportanceLevel)} defaultValue="neutral">
                                    <SelectTrigger className="bg-slate-800 border-slate-700"><SelectValue /></SelectTrigger>
                                    <SelectContent className="bg-slate-800 border-slate-700">
                                        <SelectItem value="urgent">🔴 Urgent</SelectItem>
                                        <SelectItem value="important">🟠 Important</SelectItem>
                                        <SelectItem value="neutral">🔵 Neutral</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Task Description *</Label>
                            <Textarea placeholder="What needs to be done..." className="bg-slate-800 border-slate-700 min-h-[80px]" {...form.register('text')} />
                            {form.formState.errors.text && <p className="text-red-400 text-xs">{form.formState.errors.text.message}</p>}
                        </div>
                        <div className="flex justify-end gap-3 pt-4">
                            <Button type="button" variant="ghost" onClick={() => setFormOpen(false)} className="text-slate-400">Cancel</Button>
                            <Button type="submit" disabled={createMut.isPending} className="bg-indigo-600 hover:bg-indigo-700">
                                {createMut.isPending ? 'Adding...' : 'Add Task'}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
