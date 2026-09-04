'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getLookupValues, addLookupValue, removeLookupValue } from '@/services/lookup';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Settings2, Plus, Trash2, Tag, Ticket, Package, ClipboardList } from 'lucide-react';
import { PageTransition } from '@/components/PageTransition';
import { cn } from '@/lib/utils';

// ─── Module / category config ─────────────────────────────────────────────────
const MODULES = [
    {
        key: 'ticketing',
        label: 'Ticketing',
        icon: Ticket,
        color: 'text-blue-500',
        bg: 'bg-blue-500/10',
        border: 'border-blue-200/40',
        lists: [
            { category: 'ticket_priority',   label: 'Priority Levels',   description: 'Ticket urgency options (e.g. Critical, High)' },
            { category: 'ticket_category',   label: 'Categories',        description: 'Ticket type / category options' },
            { category: 'ticket_department', label: 'Departments',       description: 'Department list for ticket assignment' },
        ],
    },
    {
        key: 'inventory',
        label: 'Inventory',
        icon: Package,
        color: 'text-purple-500',
        bg: 'bg-purple-500/10',
        border: 'border-purple-200/40',
        lists: [
            { category: 'inventory_category', label: 'Categories', description: 'Inventory item category options' },
        ],
    },
    {
        key: 'procurement',
        label: 'Procurement',
        icon: ClipboardList,
        color: 'text-emerald-500',
        bg: 'bg-emerald-500/10',
        border: 'border-emerald-200/40',
        lists: [
            { category: 'procurement_type',     label: 'Requisition Types', description: 'Type of procurement (e.g. IT Equipment)' },
            { category: 'procurement_supplier', label: 'Suppliers',         description: 'Approved supplier names for the supplier dropdown' },
        ],
    },
];

// ─── Single list editor ───────────────────────────────────────────────────────
function ListEditor({ category, label, description, accentColor }: {
    category: string; label: string; description: string; accentColor: string;
}) {
    const qc = useQueryClient();
    const [newValue, setNewValue] = useState('');

    const { data: items = [], isLoading } = useQuery({
        queryKey: ['lookup', category],
        queryFn: () => getLookupValues(category),
    });

    const addMut = useMutation({
        mutationFn: () => addLookupValue(category, newValue.trim()),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['lookup', category] });
            qc.invalidateQueries({ queryKey: ['lookup-all'] });
            toast.success(`"${newValue.trim()}" added to ${label}`);
            setNewValue('');
        },
        onError: (e: Error) => toast.error(e.message),
    });

    const removeMut = useMutation({
        mutationFn: (id: string) => removeLookupValue(id),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['lookup', category] });
            qc.invalidateQueries({ queryKey: ['lookup-all'] });
            toast.success('Item removed');
        },
        onError: (e: Error) => toast.error(e.message),
    });

    const isFallback = (id: string) => id.startsWith('fallback-');

    return (
        <div className="space-y-3">
            <div>
                <p className="font-semibold text-sm text-foreground">{label}</p>
                <p className="text-xs text-muted-foreground">{description}</p>
            </div>

            {/* Current items */}
            <div className="flex flex-wrap gap-2 min-h-[36px]">
                {isLoading ? (
                    Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-7 w-20 rounded-full" />)
                ) : items.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No items yet</p>
                ) : items.map(item => (
                    <div key={item.id}
                        className={cn(
                            'flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border',
                            isFallback(item.id)
                                ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
                                : 'bg-white dark:bg-slate-900 text-foreground border-slate-200 dark:border-slate-700'
                        )}>
                        <span>{item.label}</span>
                        {isFallback(item.id) ? (
                            <span className="text-[9px] text-slate-400 ml-0.5">(default)</span>
                        ) : (
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <button className="text-slate-400 hover:text-red-500 transition-colors ml-0.5 rounded-full">
                                        <Trash2 className="h-3 w-3" />
                                    </button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Remove "{item.label}"?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This will hide it from dropdowns. Existing records using this value are not affected.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction className="bg-red-600 hover:bg-red-700"
                                            onClick={() => removeMut.mutate(item.id)}>
                                            Remove
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        )}
                    </div>
                ))}
            </div>

            {/* Add new */}
            <div className="flex gap-2">
                <Input
                    placeholder={`Add new ${label.toLowerCase().replace(/s$/, '')}…`}
                    value={newValue}
                    onChange={e => setNewValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && newValue.trim()) { e.preventDefault(); addMut.mutate(); } }}
                    className="h-8 text-sm"
                />
                <Button size="sm" className="h-8 px-3 shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white"
                    disabled={!newValue.trim() || addMut.isPending}
                    onClick={() => addMut.mutate()}>
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Add
                </Button>
            </div>
        </div>
    );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function SettingsPage() {
    const [activeModule, setActiveModule] = useState('ticketing');

    const module = MODULES.find(m => m.key === activeModule)!;

    return (
        <PageTransition>
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0">
                    <Settings2 className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-foreground tracking-tight">Settings</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Manage dropdown options used across the system</p>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-6">
                {/* Left: module tabs */}
                <div className="lg:w-52 shrink-0 space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-2 mb-2">Modules</p>
                    {MODULES.map(m => (
                        <button key={m.key} onClick={() => setActiveModule(m.key)}
                            className={cn(
                                'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left',
                                activeModule === m.key
                                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-foreground'
                            )}>
                            <div className={cn('p-1.5 rounded-lg', activeModule === m.key ? 'bg-white/20' : m.bg)}>
                                <m.icon className={cn('h-4 w-4', activeModule === m.key ? 'text-white' : m.color)} />
                            </div>
                            {m.label}
                        </button>
                    ))}
                </div>

                {/* Right: list editors */}
                <div className="flex-1 space-y-4">
                    <div className="flex items-center gap-3 mb-2">
                        <div className={cn('p-2 rounded-xl', module.bg)}>
                            <module.icon className={cn('h-5 w-5', module.color)} />
                        </div>
                        <div>
                            <h2 className="font-bold text-lg text-foreground">{module.label} Lists</h2>
                            <p className="text-xs text-muted-foreground">
                                Changes take effect immediately in all forms
                            </p>
                        </div>
                    </div>

                    {module.lists.map((list, idx) => (
                        <Card key={list.category} className={cn('border shadow-sm', idx > 0 && '')}>
                            <CardHeader className="pb-3 pt-5">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Tag className="h-4 w-4 text-slate-400" />
                                    {list.label}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-0">
                                <ListEditor
                                    category={list.category}
                                    label={list.label}
                                    description={list.description}
                                    accentColor={module.color}
                                />
                            </CardContent>
                        </Card>
                    ))}

                    <p className="text-[11px] text-slate-400 px-1">
                        💡 Default items (shown as "default") are built-in fallbacks used when the database is unavailable.
                        Add your own items to override them. To remove a default, connect your database and the custom list will take precedence.
                    </p>
                </div>
            </div>
        </div>
        </PageTransition>
    );
}
