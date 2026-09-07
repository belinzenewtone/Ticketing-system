'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    getRequisitions, createRequisition, updateRequisition, deleteRequisition,
    getRequisitionItems, addRequisitionItem, deleteRequisitionItem,
    getRequisitionStages, recordApproval, recordRejection,
} from '@/services/procurement';
import { getLookupValues } from '@/services/lookup';
import { STAGE_ORDER } from '@/lib/procurement-utils';
import { PageTransition } from '@/components/PageTransition';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
// Card removed — using flat div tiles instead
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { cn } from '@/lib/utils';
import {
    Plus, Trash2, ClipboardList, CheckCircle2, XCircle, Clock,
    ChevronRight, Building2, Pencil, Search, TrendingUp, Package, Eye,
} from 'lucide-react';
import type {
    Requisition, RequisitionItem, RequisitionStageRecord,
    RequisitionStage, RequisitionType, CreateRequisitionItemInput,
} from '@/types/database';

// ─── Stage config ─────────────────────────────────────────────────────────────
const STAGE_CONFIG: Record<string, { label: string; short: string; icon: string }> = {
    draft:             { label: 'Draft',                short: 'Draft',     icon: '📝' },
    requestor:         { label: 'Requestor',            short: 'Req.',      icon: '👤' },
    head_department:   { label: 'Head of Department',   short: 'HoD',       icon: '👤' },
    cio:               { label: 'CIO',                  short: 'CIO',       icon: '👤' },
    head_hr:           { label: 'Head of HR',           short: 'HR',        icon: '👤' },
    general_manager:   { label: 'General Manager',      short: 'GM',        icon: '👤' },
    director_strategy: { label: 'Director Strategy',    short: 'Dir.',      icon: '👤' },
    head_finance:      { label: 'Head of Finance',      short: 'Finance',   icon: '👤' },
    chairman:          { label: 'Chairman',             short: 'Chairman',  icon: '👤' },
    procurement:       { label: 'Procurement / PO',     short: 'PO',        icon: '📋' },
    awaiting_delivery: { label: 'Awaiting Delivery',    short: 'Delivery',  icon: '🚚' },
    delivered:         { label: 'Delivered',            short: 'Done',      icon: '✅' },
    rejected:          { label: 'Rejected',             short: 'Rejected',  icon: '❌' },
};

const TYPE_CONFIG: Record<RequisitionType, string> = {
    'it-equipment':   'IT Equipment',
    'office-supplies': 'Office Supplies',
    'services':        'Services',
    'other':           'Other',
};

// ─── Stage badge ─────────────────────────────────────────────────────────────
function StageBadge({ stage }: { stage: RequisitionStage }) {
    const cfg = STAGE_CONFIG[stage];
    const color =
        stage === 'delivered'         ? 'bg-emerald-500/15 text-emerald-600 border-emerald-200/50' :
        stage === 'rejected'          ? 'bg-red-500/15 text-red-600 border-red-200/50' :
        stage === 'awaiting_delivery' ? 'bg-cyan-500/15 text-cyan-600 border-cyan-200/50' :
        stage === 'draft'             ? 'bg-slate-500/15 text-slate-500 border-slate-200/50' :
        stage === 'procurement'       ? 'bg-teal-500/15 text-teal-600 border-teal-200/50' :
                                        'bg-amber-500/15 text-amber-600 border-amber-200/50';
    return (
        <Badge variant="outline" className={cn('text-[10px] font-bold uppercase tracking-wide border px-2 py-0.5', color)}>
            {cfg?.icon} {cfg?.label}
        </Badge>
    );
}

// ─── Zod schemas ──────────────────────────────────────────────────────────────
const reqSchema = z.object({
    requisition_date: z.string().min(1, 'Date required'),
    title:            z.string().min(3, 'Title required'),
    type:             z.enum(['it-equipment', 'office-supplies', 'services', 'other']),
    item_quantity:    z.coerce.number().int().min(1, 'Minimum 1 item'),
    requested_for:    z.string().min(2, 'Please specify who this is for'),
    supplier_name:    z.string().min(2, 'Supplier name required'),
    supplier_contact: z.string().optional(),
    total_amount:     z.coerce.number().min(0, 'Amount must be positive'),
    notes:            z.string().optional(),
});

const itemSchema = z.object({
    po_reference: z.string().min(1, 'PO reference required'),
    description:  z.string().min(2, 'Description required'),
    quantity:     z.coerce.number().int().min(1, 'Min 1'),
    unit_price:   z.coerce.number().min(0, 'Price required'),
});

const approvalSchema = z.object({
    signed_date: z.string().min(1, 'Sign-off date required'),
    notes:       z.string().optional(),
});

const rejectionSchema = z.object({
    reason: z.string().min(5, 'Please provide a rejection reason'),
});

type ReqForm   = z.infer<typeof reqSchema>;
type ItemForm  = z.infer<typeof itemSchema>;
type ApprForm  = z.infer<typeof approvalSchema>;
type RejForm   = z.infer<typeof rejectionSchema>;

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ProcurementPage() {
    const qc = useQueryClient();
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<'all' | 'active' | 'delivered' | 'rejected'>('all');

    // Dialog state
    const [createOpen, setCreateOpen]   = useState(false);
    const [detailReq, setDetailReq]     = useState<Requisition | null>(null);
    const [detailTab, setDetailTab]     = useState<'overview' | 'pipeline' | 'items'>('overview');
    const [editMode, setEditMode]       = useState(false);
    const [addItemOpen, setAddItemOpen] = useState(false);
    const [approvalStage, setApprovalStage]   = useState<RequisitionStage | null>(null);
    const [approvalAction, setApprovalAction] = useState<'approve' | 'reject'>('approve');

    // Data
    const { data: requisitions = [], isLoading } = useQuery({
        queryKey: ['requisitions'],
        queryFn: getRequisitions,
    });

    const { data: supplierOptions = [] } = useQuery({
        queryKey: ['lookup', 'procurement_supplier'],
        queryFn: () => getLookupValues('procurement_supplier'),
    });

    const { data: typeOptions = [] } = useQuery({
        queryKey: ['lookup', 'procurement_type'],
        queryFn: () => getLookupValues('procurement_type'),
    });

    const { data: detailItems = [] } = useQuery({
        queryKey: ['req-items', detailReq?.id],
        queryFn: () => getRequisitionItems(detailReq!.id),
        enabled: !!detailReq?.id,
    });

    const { data: detailStages = [] } = useQuery({
        queryKey: ['req-stages', detailReq?.id],
        queryFn: () => getRequisitionStages(detailReq!.id),
        enabled: !!detailReq?.id,
    });

    // Mutations
    const createMut = useMutation({
        mutationFn: createRequisition,
        onSuccess: (r) => {
            qc.invalidateQueries({ queryKey: ['requisitions'] });
            toast.success(`REQ-${String(r.number).padStart(3, '0')} created`);
            setCreateOpen(false);
            createForm.reset();
        },
        onError: (e: Error) => toast.error(e.message),
    });

    const updateMut = useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<ReqForm> }) => updateRequisition(id, data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['requisitions'] });
            toast.success('Requisition updated');
            setEditMode(false);
            // Refresh detailReq
            getRequisitions().then(list => {
                const updated = list.find(r => r.id === detailReq?.id);
                if (updated) setDetailReq(updated);
            });
        },
        onError: (e: Error) => toast.error(e.message),
    });

    const deleteMut = useMutation({
        mutationFn: deleteRequisition,
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['requisitions'] });
            toast.success('Requisition deleted');
            setDetailReq(null);
        },
        onError: (e: Error) => toast.error(e.message),
    });

    const addItemMut = useMutation({
        mutationFn: addRequisitionItem,
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['req-items', detailReq?.id] });
            toast.success('PO line item added');
            setAddItemOpen(false);
            itemForm.reset();
        },
        onError: (e: Error) => toast.error(e.message),
    });

    const delItemMut = useMutation({
        mutationFn: deleteRequisitionItem,
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['req-items', detailReq?.id] });
            toast.success('Item removed');
        },
    });

    const approveMut = useMutation({
        mutationFn: ({ stage, date, notes }: { stage: RequisitionStage; date: string; notes?: string }) =>
            recordApproval(detailReq!.id, stage, date, notes),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['requisitions'] });
            qc.invalidateQueries({ queryKey: ['req-stages', detailReq?.id] });
            toast.success('Stage approved ✅');
            setApprovalStage(null);
            getRequisitions().then(list => {
                const updated = list.find(r => r.id === detailReq?.id);
                if (updated) setDetailReq(updated);
            });
        },
        onError: (e: Error) => toast.error(e.message),
    });

    const rejectMut = useMutation({
        mutationFn: ({ stage, reason }: { stage: RequisitionStage; reason: string }) =>
            recordRejection(detailReq!.id, stage, reason),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['requisitions'] });
            qc.invalidateQueries({ queryKey: ['req-stages', detailReq?.id] });
            toast.success('Stage rejected — requisition sent back to Draft');
            setApprovalStage(null);
            getRequisitions().then(list => {
                const updated = list.find(r => r.id === detailReq?.id);
                if (updated) setDetailReq(updated);
            });
        },
        onError: (e: Error) => toast.error(e.message),
    });

    // Forms
    const today = new Date().toISOString().split('T')[0];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Zod v4 coerce fields infer as `unknown` for input; safe at runtime
    const createForm = useForm<ReqForm>({ resolver: zodResolver(reqSchema) as any, defaultValues: { requisition_date: today, type: 'it-equipment', total_amount: 0 } });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const editForm   = useForm<ReqForm>({ resolver: zodResolver(reqSchema) as any });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const itemForm   = useForm<ItemForm>({ resolver: zodResolver(itemSchema) as any, defaultValues: { quantity: 1, unit_price: 0 } });
    const apprForm   = useForm<ApprForm>({ resolver: zodResolver(approvalSchema), defaultValues: { signed_date: new Date().toISOString().split('T')[0] } });
    const rejForm    = useForm<RejForm>({ resolver: zodResolver(rejectionSchema) });

    // Memoised filtered list — avoids re-filtering on every unrelated render
    const filtered = useMemo(() => requisitions.filter(r => {
        const q = search.toLowerCase();
        const matchSearch = !q ||
            r.title.toLowerCase().includes(q) ||
            r.supplier_name.toLowerCase().includes(q) ||
            (r.requested_for ?? '').toLowerCase().includes(q);
        const matchFilter =
            filter === 'all'       ? true :
            filter === 'delivered' ? r.current_stage === 'delivered' :
            filter === 'rejected'  ? r.current_stage === 'rejected' :
            /* active */             !['delivered', 'rejected'].includes(r.current_stage);
        return matchSearch && matchFilter;
    }), [requisitions, search, filter]);

    // Stats
    const total     = requisitions.length;
    const active    = requisitions.filter(r => !['delivered', 'rejected', 'draft'].includes(r.current_stage)).length;
    const delivered = requisitions.filter(r => r.current_stage === 'delivered').length;
    const rejected  = requisitions.filter(r => r.current_stage === 'rejected').length;

    // Stage record helpers
    const stageRecord = (stage: RequisitionStage): RequisitionStageRecord | undefined =>
        detailStages.filter(s => s.stage === stage).slice(-1)[0];

    const openDetail = (req: Requisition) => {
        setDetailReq(req);
        setDetailTab('overview');
        setEditMode(false);
        editForm.reset({
            requisition_date: req.requisition_date?.split('T')[0] ?? today,
            title: req.title, type: req.type,
            item_quantity: req.item_quantity ?? 1,
            requested_for: req.requested_for ?? '',
            supplier_name: req.supplier_name,
            supplier_contact: req.supplier_contact ?? '', total_amount: req.total_amount,
            notes: req.notes ?? '',
        });
    };

    const openApproval = (stage: RequisitionStage, action: 'approve' | 'reject') => {
        setApprovalStage(stage);
        setApprovalAction(action);
        apprForm.reset({ signed_date: new Date().toISOString().split('T')[0] });
        rejForm.reset();
    };

    const fmtKES = (n: number) =>
        new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(n);

    const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

    return (
        <PageTransition>
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                        <ClipboardList className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-foreground tracking-tight">Procurement Requisitions</h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Track approval chains for all procurement requisitions</p>
                    </div>
                </div>
                <Button onClick={() => { createForm.reset({ requisition_date: today, type: 'it-equipment', item_quantity: 1, total_amount: 0, requested_for: '', supplier_name: '', supplier_contact: '', notes: '', title: '' }); setCreateOpen(true); }} className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0">
                    <Plus className="h-4 w-4 mr-2" /> New Requisition
                </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    { label: 'Total', value: total, icon: ClipboardList, color: 'text-slate-500',  bg: 'bg-slate-500/10' },
                    { label: 'In Progress', value: active, icon: TrendingUp, color: 'text-amber-500',  bg: 'bg-amber-500/10' },
                    { label: 'Delivered', value: delivered, icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
                    { label: 'Rejected', value: rejected, icon: XCircle, color: 'text-red-500', bg: 'bg-red-500/10' },
                ].map(s => (
                    <div key={s.label} className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-5">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">{s.label}</p>
                                {isLoading ? <Skeleton className="h-8 w-12" /> :
                                    <p className="text-3xl font-bold text-foreground tabular-nums">{s.value}</p>}
                            </div>
                            <div className={`p-2.5 rounded-xl ${s.bg} shrink-0`}>
                                <s.icon className={`h-5 w-5 ${s.color}`} />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search by title or supplier…" value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
                </div>
                <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/60 w-fit">
                    {(['all', 'active', 'delivered', 'rejected'] as const).map(f => (
                        <button key={f} onClick={() => setFilter(f)}
                            className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all duration-150',
                                filter === f ? 'bg-white dark:bg-slate-900 text-foreground shadow-sm' : 'text-slate-500 hover:text-foreground'
                            )}>
                            {f}
                        </button>
                    ))}
                </div>
            </div>

            {/* Table */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <Table>

                        <TableHeader>
                            <TableRow className="bg-slate-50/50 dark:bg-slate-900/50">
                                <TableHead className="font-bold uppercase text-[11px] tracking-wider w-[90px]">REQ #</TableHead>
                                <TableHead className="font-bold uppercase text-[11px] tracking-wider">Title</TableHead>
                                <TableHead className="font-bold uppercase text-[11px] tracking-wider">Supplier</TableHead>
                                <TableHead className="font-bold uppercase text-[11px] tracking-wider">Type</TableHead>
                                <TableHead className="font-bold uppercase text-[11px] tracking-wider text-right">Amount</TableHead>
                                <TableHead className="font-bold uppercase text-[11px] tracking-wider">Stage</TableHead>
                                <TableHead className="font-bold uppercase text-[11px] tracking-wider">Date</TableHead>
                                <TableHead className="font-bold uppercase text-[11px] tracking-wider text-right w-[80px]">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                Array.from({ length: 4 }).map((_, i) => (
                                    <TableRow key={i}>
                                        {Array.from({ length: 8 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}
                                    </TableRow>
                                ))
                            ) : filtered.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center py-16 text-muted-foreground">
                                        <div className="flex flex-col items-center gap-3">
                                            <ClipboardList className="h-10 w-10 opacity-20" />
                                            <p className="font-medium">No requisitions found</p>
                                            <Button size="sm" variant="outline" onClick={() => { createForm.reset({ requisition_date: today, type: 'it-equipment', item_quantity: 1, total_amount: 0, requested_for: '', supplier_name: '', supplier_contact: '', notes: '', title: '' }); setCreateOpen(true); }}>
                                                <Plus className="h-4 w-4 mr-1" /> Create your first requisition
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : filtered.map(r => (
                                <TableRow key={r.id}
                                    className={cn('cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/30 border-l-2',
                                        r.current_stage === 'delivered'         ? 'border-l-emerald-500' :
                                        r.current_stage === 'rejected'          ? 'border-l-red-500' :
                                        r.current_stage === 'awaiting_delivery' ? 'border-l-cyan-400' :
                                        r.current_stage === 'draft'             ? 'border-l-slate-300 dark:border-l-slate-600' :
                                                                                  'border-l-amber-400'
                                    )}
                                    onClick={() => openDetail(r)}>
                                    <TableCell className="font-mono font-bold text-sm">
                                        REQ-{String(r.number).padStart(3, '0')}
                                    </TableCell>
                                    <TableCell className="font-medium max-w-[200px] truncate">{r.title}</TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                        <div className="flex items-center gap-1.5">
                                            <Building2 className="h-3.5 w-3.5 shrink-0" />
                                            <span className="truncate max-w-[140px]">{r.supplier_name}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="text-[10px]">{TYPE_CONFIG[r.type as RequisitionType]}</Badge>
                                    </TableCell>
                                    <TableCell className="text-right font-semibold text-sm">{fmtKES(r.total_amount)}</TableCell>
                                    <TableCell><StageBadge stage={r.current_stage} /></TableCell>
                                    <TableCell className="text-xs text-muted-foreground">{fmtDate(r.requisition_date)}</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-emerald-600"
                                            onClick={e => { e.stopPropagation(); openDetail(r); }}>
                                            <Eye className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════════
                CREATE REQUISITION DIALOG
            ════════════════════════════════════════════════════════ */}
            <Dialog open={createOpen} onOpenChange={open => { setCreateOpen(open); if (!open) createForm.reset(); }}>
                <DialogContent className="sm:max-w-[560px] p-0 overflow-hidden gap-0">
                    <div className="bg-gradient-to-r from-emerald-600 to-teal-700 px-6 py-5 shrink-0">
                        <DialogTitle className="text-white text-lg font-bold">New Requisition</DialogTitle>
                        <p className="text-emerald-100 text-sm mt-0.5">Fill in the details. PO line items can be added after creation.</p>
                    </div>
                    <div className="max-h-[75vh] overflow-y-auto">
                    <form onSubmit={createForm.handleSubmit(d => createMut.mutate(d as ReqForm))} className="space-y-5 px-6 py-5">

                        {/* Title + Date */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5 col-span-2 sm:col-span-1">
                                <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Requisition Title <span className="text-red-400">*</span></Label>
                                <Input className="h-10" placeholder="e.g. Laptop Procurement Q3 2026" {...createForm.register('title')} />
                                {createForm.formState.errors.title && <p className="text-red-500 text-xs">{createForm.formState.errors.title.message}</p>}
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Date <span className="text-red-400">*</span></Label>
                                <Input className="h-10" type="date"
                                    value={createForm.watch('requisition_date') || today}
                                    onChange={e => createForm.setValue('requisition_date', e.target.value, { shouldValidate: true })}
                                />
                            </div>
                        </div>

                        {/* Requested For + Item Count */}
                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-1.5 col-span-2">
                                <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Requested For <span className="text-red-400">*</span></Label>
                                <Input className="h-10" placeholder="e.g. John Doe — Finance Dept" {...createForm.register('requested_for')} />
                                {createForm.formState.errors.requested_for && <p className="text-red-500 text-xs">{createForm.formState.errors.requested_for.message}</p>}
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">No. of Items <span className="text-red-400">*</span></Label>
                                <Input className="h-10" type="number" min="1" placeholder="1" {...createForm.register('item_quantity')} />
                                {createForm.formState.errors.item_quantity && <p className="text-red-500 text-xs">{createForm.formState.errors.item_quantity.message}</p>}
                            </div>
                        </div>

                        {/* Type — visual tile picker */}
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Requisition Type <span className="text-red-400">*</span></Label>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {typeOptions.map(opt => {
                                    const icons: Record<string, string> = {
                                        'it-equipment': '💻', 'office-supplies': '🖊️', 'services': '🛠️', 'other': '📋',
                                    };
                                    const active = createForm.watch('type') === opt.value;
                                    return (
                                        <button key={opt.value} type="button"
                                            onClick={() => createForm.setValue('type', opt.value as RequisitionType)}
                                            className={cn(
                                                'flex flex-col items-center gap-1.5 rounded-xl border-2 py-3 text-center transition-all duration-150',
                                                active
                                                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400'
                                                    : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-300'
                                            )}>
                                            <span className="text-xl leading-none">{icons[opt.value] || '📋'}</span>
                                            <span className="text-[10px] font-bold leading-tight">{opt.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Amount + Supplier */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Amount (KES) <span className="text-red-400">*</span></Label>
                                <Input className="h-10" type="number" min="0" step="0.01" placeholder="0.00" {...createForm.register('total_amount')} />
                                {createForm.formState.errors.total_amount && <p className="text-red-500 text-xs">{createForm.formState.errors.total_amount.message}</p>}
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Supplier <span className="text-red-400">*</span></Label>
                                <Select onValueChange={v => createForm.setValue('supplier_name', v)}>
                                    <SelectTrigger className="h-10"><SelectValue placeholder="Select supplier…" /></SelectTrigger>
                                    <SelectContent>
                                        {supplierOptions.map(opt => (
                                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {createForm.formState.errors.supplier_name && <p className="text-red-500 text-xs">{createForm.formState.errors.supplier_name.message}</p>}
                            </div>
                        </div>

                        {/* Supplier Contact + Notes */}
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Supplier Contact <span className="text-slate-400 font-normal normal-case">(optional)</span></Label>
                            <Input className="h-10" placeholder="Phone or email" {...createForm.register('supplier_contact')} />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Notes <span className="text-slate-400 font-normal normal-case">(optional)</span></Label>
                            <Textarea className="resize-none min-h-[70px]" placeholder="Any additional details about this requisition…" {...createForm.register('notes')} />
                        </div>

                        <div className="flex justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800 mt-2">
                            <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)} className="h-9 text-sm">Cancel</Button>
                            <Button type="submit" disabled={createMut.isPending} className="bg-emerald-600 hover:bg-emerald-700 text-white h-9 px-5 text-sm font-semibold shadow-sm shadow-emerald-600/30">
                                {createMut.isPending ? 'Creating…' : 'Create Requisition'}
                            </Button>
                        </div>
                    </form>
                    </div>
                </DialogContent>
            </Dialog>

            {/* ═══════════════════════════════════════════════════════
                DETAIL DIALOG
            ════════════════════════════════════════════════════════ */}
            <Dialog open={!!detailReq} onOpenChange={open => { if (!open) { setDetailReq(null); setEditMode(false); } }}>
                <DialogContent className="sm:max-w-[700px] max-h-[92vh] p-0 overflow-hidden gap-0 flex flex-col">
                    {detailReq && (
                        <>
                            {/* Gradient header */}
                            <div className={cn('px-6 py-5 shrink-0',
                                detailReq.current_stage === 'delivered' ? 'bg-gradient-to-r from-emerald-600 to-teal-700' :
                                detailReq.current_stage === 'rejected'  ? 'bg-gradient-to-r from-red-600 to-red-700' :
                                detailReq.current_stage === 'draft'     ? 'bg-gradient-to-r from-slate-600 to-slate-800' :
                                                                          'bg-gradient-to-r from-amber-600 to-orange-700'
                            )}>
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-mono text-sm font-bold text-white/70">
                                                REQ-{String(detailReq.number).padStart(3, '0')}
                                            </span>
                                            <StageBadge stage={detailReq.current_stage} />
                                        </div>
                                        <DialogTitle className="text-white text-xl font-bold leading-tight">{detailReq.title}</DialogTitle>
                                        <p className="text-white/70 text-sm flex items-center gap-1.5 mt-1">
                                            <Building2 className="h-3.5 w-3.5" />
                                            {detailReq.supplier_name}
                                            {detailReq.supplier_contact && <span>· {detailReq.supplier_contact}</span>}
                                        </p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="text-2xl font-bold text-white">{fmtKES(detailReq.total_amount)}</p>
                                        <p className="text-xs text-white/60">{TYPE_CONFIG[detailReq.type as RequisitionType]}</p>
                                    </div>
                                </div>

                                {/* Tab bar */}
                                <div className="flex gap-1 mt-4">
                                    {(['overview', 'pipeline', 'items'] as const).map(tab => (
                                        <button key={tab} onClick={() => setDetailTab(tab)}
                                            className={cn('flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all duration-150',
                                                detailTab === tab
                                                    ? 'bg-white/20 text-white'
                                                    : 'text-white/60 hover:text-white hover:bg-white/10'
                                            )}>
                                            {tab === 'overview' ? 'Overview' : tab === 'pipeline' ? 'Approval Pipeline' : 'PO Items'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="p-6 overflow-y-auto flex-1">
                                {/* ── OVERVIEW TAB ── */}
                                {detailTab === 'overview' && (
                                    <div className="space-y-4">
                                        {!editMode ? (
                                            <>
                                                <div className="grid grid-cols-2 gap-4 text-sm">
                                                    <div><p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1">Logged By (Admin)</p><p className="font-medium">{detailReq.requestor_name || '—'}</p></div>
                                                    <div><p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1">Admin Email</p><p className="font-medium text-sm">{detailReq.requestor_email || '—'}</p></div>
                                                    <div><p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1">Requested For</p><p className="font-semibold text-foreground">{detailReq.requested_for || '—'}</p></div>
                                                    <div><p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1">No. of Items</p><p className="font-semibold text-foreground">{detailReq.item_quantity ?? '—'}</p></div>
                                                    <div><p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1">Supplier</p><p className="font-medium">{detailReq.supplier_name}</p></div>
                                                    <div><p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1">Supplier Contact</p><p className="font-medium">{detailReq.supplier_contact || '—'}</p></div>
                                                    <div><p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1">Type</p><p className="font-medium">{TYPE_CONFIG[detailReq.type as RequisitionType]}</p></div>
                                                    <div><p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1">Total Amount</p><p className="font-bold text-emerald-600">{fmtKES(detailReq.total_amount)}</p></div>
                                                    <div><p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1">Requisition Date</p><p className="font-medium">{fmtDate(detailReq.requisition_date)}</p></div>
                                                    <div><p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1">Last Updated</p><p className="font-medium">{fmtDate(detailReq.updated_at)}</p></div>
                                                </div>
                                                {detailReq.notes && (
                                                    <div>
                                                        <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1">Notes</p>
                                                        <p className="text-sm bg-slate-50 dark:bg-slate-900 rounded-lg p-3 border">{detailReq.notes}</p>
                                                    </div>
                                                )}
                                                <div className="flex gap-2 pt-2">
                                                    <Button size="sm" variant="outline" onClick={() => setEditMode(true)}>
                                                        <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
                                                    </Button>
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-600 hover:bg-red-50">
                                                                <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete
                                                            </Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>Delete REQ-{String(detailReq.number).padStart(3, '0')}?</AlertDialogTitle>
                                                                <AlertDialogDescription>This will permanently delete the requisition, all PO items, and approval records.</AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => deleteMut.mutate(detailReq.id)}>Delete</AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                </div>
                                            </>
                                        ) : (
                                            /* Edit form */
                                            <form onSubmit={editForm.handleSubmit(d => updateMut.mutate({ id: detailReq.id, data: d }))} className="space-y-4">
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <Label>Title</Label>
                                                        <Input {...editForm.register('title')} />
                                                        {editForm.formState.errors.title && <p className="text-red-500 text-xs">{editForm.formState.errors.title.message}</p>}
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label>Requisition Date</Label>
                                                        <Input
                                                            type="date"
                                                            value={editForm.watch('requisition_date') || today}
                                                            onChange={e => editForm.setValue('requisition_date', e.target.value, { shouldValidate: true })}
                                                        />
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-3 gap-4">
                                                    <div className="space-y-2 col-span-2">
                                                        <Label>Requested For</Label>
                                                        <Input placeholder="Employee or department" {...editForm.register('requested_for')} />
                                                        {editForm.formState.errors.requested_for && <p className="text-red-500 text-xs">{editForm.formState.errors.requested_for.message}</p>}
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label>No. of Items</Label>
                                                        <Input type="number" min="1" {...editForm.register('item_quantity')} />
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <Label>Type</Label>
                                                        <Select onValueChange={v => editForm.setValue('type', v as RequisitionType)} defaultValue={detailReq.type}>
                                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                                            <SelectContent>
                                                                {typeOptions.map(opt => (
                                                                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label>Total Amount (KES)</Label>
                                                        <Input type="number" step="0.01" {...editForm.register('total_amount')} />
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <Label>Supplier</Label>
                                                        <Select onValueChange={v => editForm.setValue('supplier_name', v)} defaultValue={detailReq.supplier_name}>
                                                            <SelectTrigger><SelectValue placeholder="Select supplier…" /></SelectTrigger>
                                                            <SelectContent>
                                                                {supplierOptions.map(opt => (
                                                                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label>Supplier Contact</Label>
                                                        <Input {...editForm.register('supplier_contact')} />
                                                    </div>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Notes</Label>
                                                    <Textarea rows={3} {...editForm.register('notes')} />
                                                </div>
                                                <div className="flex gap-2">
                                                    <Button type="submit" disabled={updateMut.isPending} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                                                        {updateMut.isPending ? 'Saving…' : 'Save Changes'}
                                                    </Button>
                                                    <Button type="button" variant="ghost" onClick={() => setEditMode(false)}>Cancel</Button>
                                                </div>
                                            </form>
                                        )}
                                    </div>
                                )}

                                {/* ── PIPELINE TAB ── */}
                                {detailTab === 'pipeline' && (
                                    <div className="space-y-3">
                                        <p className="text-xs text-muted-foreground mb-4">
                                            Current stage: <span className="font-bold text-foreground">{STAGE_CONFIG[detailReq.current_stage]?.label}</span>
                                            {detailReq.current_stage === 'draft' && <span className="ml-2 text-amber-600">— submit to Requestor to begin the approval chain</span>}
                                        </p>

                                        {/* Skip 'draft' in the visual — it's just the starting point */}
                                        {STAGE_ORDER.filter(s => s !== 'draft').map((stage, idx) => {
                                            const rec = stageRecord(stage);
                                            const currentStageIdx = STAGE_ORDER.indexOf(detailReq.current_stage);
                                            const thisStageIdx    = STAGE_ORDER.indexOf(stage);
                                            const isPast    = thisStageIdx < currentStageIdx && detailReq.current_stage !== 'rejected';
                                            const isCurrent = stage === detailReq.current_stage;
                                            const isFuture  = thisStageIdx > currentStageIdx;
                                            const isRejected = detailReq.current_stage === 'rejected' && rec?.status === 'rejected';

                                            return (
                                                <div key={stage} className={cn(
                                                    'flex gap-4 p-4 rounded-xl border transition-all',
                                                    isPast    ? 'bg-emerald-50/50 dark:bg-emerald-950/10 border-emerald-100 dark:border-emerald-900/30' :
                                                    isCurrent ? 'bg-amber-50/50 dark:bg-amber-950/10 border-amber-200 dark:border-amber-800/40 shadow-sm' :
                                                    isRejected ? 'bg-red-50/30 dark:bg-red-950/10 border-red-100 dark:border-red-900/30' :
                                                    'bg-slate-50/30 dark:bg-slate-900/20 border-slate-100 dark:border-slate-800/40 opacity-60'
                                                )}>
                                                    {/* Step number / icon */}
                                                    <div className={cn(
                                                        'h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 border-2',
                                                        isPast    ? 'bg-emerald-500 text-white border-emerald-500' :
                                                        isCurrent ? 'bg-amber-500 text-white border-amber-500' :
                                                        isRejected ? 'bg-red-500 text-white border-red-500' :
                                                        'bg-white dark:bg-slate-900 text-slate-400 border-slate-200 dark:border-slate-700'
                                                    )}>
                                                        {isPast ? <CheckCircle2 className="h-4 w-4" /> :
                                                         isRejected ? <XCircle className="h-4 w-4" /> :
                                                         isCurrent ? <Clock className="h-4 w-4" /> :
                                                         <span className="text-xs">{idx + 1}</span>}
                                                    </div>

                                                    {/* Content */}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center justify-between gap-2">
                                                            <p className={cn('font-semibold text-sm', isFuture ? 'text-slate-400' : 'text-foreground')}>
                                                                {STAGE_CONFIG[stage]?.label}
                                                            </p>
                                                            {rec?.signed_date && (
                                                                <span className="text-[10px] text-emerald-600 font-bold bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 rounded">
                                                                    Signed {fmtDate(rec.signed_date)}
                                                                </span>
                                                            )}
                                                            {isRejected && rec && (
                                                                <span className="text-[10px] text-red-600 font-bold bg-red-100 dark:bg-red-900/30 px-2 py-0.5 rounded">Rejected</span>
                                                            )}
                                                        </div>
                                                        {rec?.notes && (
                                                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{rec.notes}</p>
                                                        )}

                                                        {/* Action buttons for current stage */}
                                                        {isCurrent && !['delivered', 'rejected'].includes(stage) && (
                                                            <div className="flex gap-2 mt-3">
                                                                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white h-7 text-xs"
                                                                    onClick={() => openApproval(stage, 'approve')}>
                                                                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Record Approval
                                                                </Button>
                                                                <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-600 hover:bg-red-50 h-7 text-xs"
                                                                    onClick={() => openApproval(stage, 'reject')}>
                                                                    <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
                                                                </Button>
                                                            </div>
                                                        )}

                                                        {/* Draft: show "Submit to Requestor" button */}
                                                        {detailReq.current_stage === 'draft' && stage === 'requestor' && (
                                                            <div className="mt-3">
                                                                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white h-7 text-xs"
                                                                    onClick={() => openApproval('draft' as RequisitionStage, 'approve')}>
                                                                    <ChevronRight className="h-3.5 w-3.5 mr-1" /> Submit to Requestor
                                                                </Button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* ── PO ITEMS TAB ── */}
                                {detailTab === 'items' && (
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center">
                                            <p className="text-sm text-muted-foreground">Individual PO / item reference numbers for this requisition</p>
                                            <Button size="sm" onClick={() => setAddItemOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                                                <Plus className="h-3.5 w-3.5 mr-1.5" /> Add PO Item
                                            </Button>
                                        </div>

                                        {detailItems.length === 0 ? (
                                            <div className="text-center py-12 border rounded-xl border-dashed text-muted-foreground">
                                                <Package className="h-8 w-8 mx-auto mb-2 opacity-30" />
                                                <p className="text-sm">No PO items yet — add individual item reference numbers</p>
                                            </div>
                                        ) : (
                                            <div className="overflow-x-auto rounded-xl border">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow className="bg-slate-50/50 dark:bg-slate-900/50">
                                                            <TableHead className="text-[11px] font-bold uppercase tracking-wider">PO Reference</TableHead>
                                                            <TableHead className="text-[11px] font-bold uppercase tracking-wider">Description</TableHead>
                                                            <TableHead className="text-[11px] font-bold uppercase tracking-wider text-right">Qty</TableHead>
                                                            <TableHead className="text-[11px] font-bold uppercase tracking-wider text-right">Unit Price</TableHead>
                                                            <TableHead className="text-[11px] font-bold uppercase tracking-wider text-right">Total</TableHead>
                                                            <TableHead className="w-10" />
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {detailItems.map((item: RequisitionItem) => (
                                                            <TableRow key={item.id}>
                                                                <TableCell className="font-mono font-bold text-sm text-emerald-600">{item.po_reference}</TableCell>
                                                                <TableCell className="text-sm">{item.description}</TableCell>
                                                                <TableCell className="text-right text-sm">{item.quantity}</TableCell>
                                                                <TableCell className="text-right text-sm">{fmtKES(item.unit_price)}</TableCell>
                                                                <TableCell className="text-right font-semibold text-sm">{fmtKES(item.total_price)}</TableCell>
                                                                <TableCell>
                                                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-500"
                                                                        onClick={() => delItemMut.mutate(item.id)}>
                                                                        <Trash2 className="h-3.5 w-3.5" />
                                                                    </Button>
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                                {/* Totals row */}
                                                <div className="flex justify-end px-4 py-3 border-t bg-slate-50/50 dark:bg-slate-900/30">
                                                    <p className="text-sm font-bold text-foreground">
                                                        Grand Total: <span className="text-emerald-600 ml-2">
                                                            {fmtKES(detailItems.reduce((s: number, i: RequisitionItem) => s + Number(i.total_price), 0))}
                                                        </span>
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            {/* ═══════════════════════════════════════════════════════
                ADD PO ITEM DIALOG
            ════════════════════════════════════════════════════════ */}
            <Dialog open={addItemOpen} onOpenChange={open => { setAddItemOpen(open); if (!open) itemForm.reset(); }}>
                <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden gap-0">
                    <div className="bg-gradient-to-r from-teal-600 to-emerald-700 px-6 py-5">
                        <DialogTitle className="text-white text-lg font-bold">Add PO Line Item</DialogTitle>
                        <p className="text-teal-100 text-sm mt-0.5">Each item gets a unique PO / item reference number.</p>
                    </div>
                    <form onSubmit={itemForm.handleSubmit(d => addItemMut.mutate({ ...d, requisition_id: detailReq!.id } as unknown as CreateRequisitionItemInput))}
                        className="space-y-5 px-6 py-5">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">PO / Item Reference <span className="text-red-400">*</span></Label>
                                <Input className="h-10 font-mono" placeholder="e.g. PO-2026-001" {...itemForm.register('po_reference')} />
                                {itemForm.formState.errors.po_reference && <p className="text-red-500 text-xs">{itemForm.formState.errors.po_reference.message}</p>}
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Quantity <span className="text-red-400">*</span></Label>
                                <Input className="h-10" type="number" min="1" {...itemForm.register('quantity')} />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Description <span className="text-red-400">*</span></Label>
                            <Input className="h-10" placeholder="e.g. Dell Latitude 5540 Laptop" {...itemForm.register('description')} />
                            {itemForm.formState.errors.description && <p className="text-red-500 text-xs">{itemForm.formState.errors.description.message}</p>}
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Unit Price (KES) <span className="text-red-400">*</span></Label>
                            <Input className="h-10" type="number" min="0" step="0.01" placeholder="0.00" {...itemForm.register('unit_price')} />
                            {itemForm.formState.errors.unit_price && <p className="text-red-500 text-xs">{itemForm.formState.errors.unit_price.message}</p>}
                        </div>
                        {/* Live total preview */}
                        {itemForm.watch('quantity') > 0 && itemForm.watch('unit_price') > 0 && (
                            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30">
                                <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Line Total</span>
                                <span className="ml-auto text-base font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">
                                    {fmtKES(itemForm.watch('quantity') * itemForm.watch('unit_price'))}
                                </span>
                            </div>
                        )}
                        <div className="flex justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800 mt-2">
                            <Button type="button" variant="ghost" onClick={() => setAddItemOpen(false)} className="h-9 text-sm">Cancel</Button>
                            <Button type="submit" disabled={addItemMut.isPending} className="bg-emerald-600 hover:bg-emerald-700 text-white h-9 px-5 text-sm font-semibold shadow-sm shadow-emerald-600/30">
                                {addItemMut.isPending ? 'Adding…' : 'Add Item'}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* ═══════════════════════════════════════════════════════
                RECORD APPROVAL / REJECTION DIALOG
            ════════════════════════════════════════════════════════ */}
            <Dialog open={!!approvalStage} onOpenChange={open => { if (!open) setApprovalStage(null); }}>
                <DialogContent className="sm:max-w-[420px] p-0 overflow-hidden gap-0">
                    <div className={cn('px-6 py-5',
                        approvalAction === 'approve'
                            ? 'bg-gradient-to-r from-emerald-600 to-teal-700'
                            : 'bg-gradient-to-r from-red-600 to-red-700'
                    )}>
                        <DialogTitle className="text-white text-lg font-bold flex items-center gap-2">
                            {approvalAction === 'approve'
                                ? <><CheckCircle2 className="h-5 w-5" /> Record Approval</>
                                : <><XCircle className="h-5 w-5" /> Record Rejection</>}
                        </DialogTitle>
                        <p className="text-white/70 text-sm mt-0.5">
                            Stage: <strong className="text-white">{approvalStage ? STAGE_CONFIG[approvalStage]?.label : ''}</strong>
                            {approvalAction === 'reject' && ' — Rejected requisitions return to Draft.'}
                        </p>
                    </div>

                    {approvalAction === 'approve' ? (
                        <form onSubmit={apprForm.handleSubmit(d =>
                            approveMut.mutate({ stage: approvalStage!, date: d.signed_date, notes: d.notes })
                        )} className="space-y-4 px-6 py-5">
                            <div className="space-y-2">
                                <Label>Date Signed <span className="text-red-500">*</span></Label>
                                <Input type="date" {...apprForm.register('signed_date')} />
                                <p className="text-[11px] text-slate-400">Enter the date the executive actually signed the form</p>
                                {apprForm.formState.errors.signed_date && <p className="text-red-500 text-xs">{apprForm.formState.errors.signed_date.message}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label>Notes <span className="text-slate-400 font-normal text-xs">(optional)</span></Label>
                                <Textarea placeholder="Any comments from this stage…" rows={3} {...apprForm.register('notes')} />
                            </div>
                            <div className="flex justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                                <Button type="button" variant="ghost" onClick={() => setApprovalStage(null)}>Cancel</Button>
                                <Button type="submit" disabled={approveMut.isPending} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                                    {approveMut.isPending ? 'Recording…' : 'Confirm Approval'}
                                </Button>
                            </div>
                        </form>
                    ) : (
                        <form onSubmit={rejForm.handleSubmit(d =>
                            rejectMut.mutate({ stage: approvalStage!, reason: d.reason })
                        )} className="space-y-4 px-6 py-5">
                            <div className="space-y-2">
                                <Label>Rejection Reason <span className="text-red-500">*</span></Label>
                                <Textarea placeholder="Why was this rejected? e.g. Budget exceeded, wrong vendor…" rows={4} {...rejForm.register('reason')} />
                                {rejForm.formState.errors.reason && <p className="text-red-500 text-xs">{rejForm.formState.errors.reason.message}</p>}
                            </div>
                            <div className="flex justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                                <Button type="button" variant="ghost" onClick={() => setApprovalStage(null)}>Cancel</Button>
                                <Button type="submit" disabled={rejectMut.isPending} className="bg-red-600 hover:bg-red-700 text-white">
                                    {rejectMut.isPending ? 'Recording…' : 'Confirm Rejection'}
                                </Button>
                            </div>
                        </form>
                    )}
                </DialogContent>
            </Dialog>
        </div>
        </PageTransition>
    );
}
