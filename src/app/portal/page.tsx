'use client';

import { useUnreadComments } from '@/hooks/useUnreadComments';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { getTickets, addTicket, updateTicket, deleteTicket } from '@/services/tickets';
import { uploadTicketAttachment } from '@/services/storage';
import { getITStaff } from '@/services/auth-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useAppStore } from '@/store/useAppStore';
import { Plus, Search, Ticket, CheckCircle2, Loader2, Archive, MessageSquare, Paperclip, Pencil, Trash2, BookOpen, Send, X, Bot, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useState, useCallback, useRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { TicketCategory, TicketPriority, TicketStatus, CreateTicketInput, Ticket as TicketType, KbArticle } from '@/types/database';
import { generateDeflectionSuggestions, categorizeAndPrioritizeTicket, type DeflectionSuggestion } from '@/services/ai';
import { getKbArticles } from '@/services/knowledgeBase';
import { getComments, addComment } from '@/services/comments';
import { formatDistanceToNow } from 'date-fns';
import { Package, Monitor as MonitorIcon, Laptop as LaptopIcon } from 'lucide-react';
import { addMachine, getMachines } from '@/services/machines';

// ── Config maps ──────────────────────────────────────────────
const categoryConfig: Record<TicketCategory, { label: string; icon: string }> = {
    email: { label: 'Email', icon: '📧' },
    'account-login': { label: 'Account / Login', icon: '🔐' },
    'password-reset': { label: 'Password Reset', icon: '🔑' },
    hardware: { label: 'Hardware', icon: '💻' },
    software: { label: 'Software', icon: '📦' },
    'network-vpn': { label: 'Network / VPN', icon: '🌐' },
    other: { label: 'Other', icon: '📋' },
};



const statusConfig: Record<TicketStatus, { label: string; color: string; icon: React.ElementType }> = {
    open: { label: 'Open', color: 'bg-blue-600/20 text-blue-500 border-blue-600/30', icon: Ticket },
    'in-progress': { label: 'In Progress', color: 'bg-amber-600/20 text-amber-500 border-amber-600/30', icon: Loader2 },
    resolved: { label: 'Resolved', color: 'bg-emerald-600/20 text-emerald-500 border-emerald-600/30', icon: CheckCircle2 },
    closed: { label: 'Closed', color: 'bg-slate-600/20 text-slate-400 border-slate-600/30', icon: Archive },
};

const reasonLabels: Record<string, string> = {
    'old-hardware': 'Old Hardware',
    faulty: 'Faulty',
    'new-user': 'New User Onboarding',
};

// ── Validation ───────────────────────────────────────────────
const ticketSchema = z.object({
    category: z.enum(['email', 'account-login', 'password-reset', 'hardware', 'software', 'network-vpn', 'other']),
    subject: z.string().min(3, 'Subject required'),
    description: z.string().optional(),
});

const requestItemSchema = z.object({
    item_type: z.enum(['supplies', 'desktop', 'laptop']),
    date: z.string().min(1, 'Date required'),
    requester_name: z.string().min(2, 'Name required'),
    work_email: z.string().email().refine(e => e.endsWith('@jtl.co.ke'), 'Must be @jtl.co.ke'),
    importance: z.enum(['urgent', 'important', 'neutral']),
    item_count: z.coerce.number().int().min(1, 'Quantity must be at least 1').max(999, 'Quantity cannot exceed 999'),
    supply_name: z.string().optional(), // validated conditionally in submit
    reason: z.enum(['old-hardware', 'faulty', 'new-user']).optional(), // validated conditionally in submit
    notes: z.string().optional(),
});

type FormValues = z.infer<typeof ticketSchema>;
type RequestItemValues = z.infer<typeof requestItemSchema>;

// ── Page ─────────────────────────────────────────────────────
export default function PortalPage() {
    const { profile } = useAppStore();
    const { readCounts, isInitialized, markTicketAsRead } = useUnreadComments();
    const [formOpen, setFormOpen] = useState(false);
    const [requestItemOpen, setRequestItemOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [viewNotesTicket, setViewNotesTicket] = useState<TicketType | null>(null);
    const [editingTicketId, setEditingTicketId] = useState<string | null>(null);
    const [attachment, setAttachment] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // AI State
    const [deflections, setDeflections] = useState<DeflectionSuggestion[]>([]);
    const [isCheckingDeflection, setIsCheckingDeflection] = useState(false);
    const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);
    const [aiCooldown, setAiCooldown] = useState(false);

    // KB article suggestions
    const [kbArticles, setKbArticles] = useState<KbArticle[]>([]);
    const [expandedKbId, setExpandedKbId] = useState<string | null>(null);

    // Comments (for viewing public replies per ticket/machine)
    const [viewCommentsTicket, setViewCommentsTicket] = useState<TicketType | null>(null);
    const [viewCommentsMachine, setViewCommentsMachine] = useState<any | null>(null);
    const [newComment, setNewComment] = useState('');
    const [isPostingComment, setIsPostingComment] = useState(false);

    const queryClient = useQueryClient();

    // Fetch IT Staff mapping
    const { data: staffList } = useQuery({ queryKey: ['staff'], queryFn: getITStaff });
    const staffMap = staffList?.reduce((acc, s) => { acc[s.id] = s.name ?? ''; return acc; }, {} as Record<string, string>) || {};

    // Only fetch tickets created by this user
    const { data: tickets, isLoading } = useQuery({
        queryKey: ['portal-tickets', profile?.id, search],
        queryFn: () => getTickets({ created_by: profile?.id, search: search || undefined }),
        enabled: !!profile?.id,
        refetchOnWindowFocus: true,
    });

    // Requests for this user
    const { data: userRequests, isLoading: requestsLoading } = useQuery({
        queryKey: ['portal-requests', profile?.id],
        queryFn: () => getMachines({ search: profile?.email || undefined }), // We'll refine this if needed
        enabled: !!profile?.id,
    });

    const createMut = useMutation({
        mutationFn: addTicket,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['portal-tickets'] });
            toast.success('Ticket submitted successfully');
            handleOpenChange(false);
        },
        onError: (e: Error) => toast.error(e.message),
    });

    const updateMut = useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<TicketType> }) => updateTicket(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['portal-tickets'] });
            toast.success('Ticket updated successfully');
            handleOpenChange(false);
        },
        onError: (e: Error) => toast.error(e.message),
    });

    const deleteMut = useMutation({
        mutationFn: deleteTicket,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['portal-tickets'] });
            toast.success('Ticket deleted successfully');
        },
        onError: (e: Error) => toast.error(e.message),
    });

    // Form — must be declared before any hook/callback that references it
    const form = useForm<FormValues>({
        resolver: zodResolver(ticketSchema),
        defaultValues: { category: 'email', subject: '', description: '' },
    });

    const itemForm = useForm<RequestItemValues>({
        resolver: zodResolver(requestItemSchema) as any,
        defaultValues: {
            item_type: 'supplies',
            date: new Date().toISOString().split('T')[0],
            requester_name: '',
            work_email: '',
            importance: 'neutral',
            item_count: 1,
            notes: '',
        },
    });


    // KB article search (triggered on subject blur)
    const handleSubjectBlur = useCallback(async () => {
        const subject = form.getValues('subject');
        if (!subject || subject.length < 3) return;
        try {
            const results = await getKbArticles({ search: subject });
            setKbArticles(results.slice(0, 3));
        } catch {
            // silently ignore
        }
    }, [form]);

    // Comments query for viewing public replies (Tickets)
    const { data: viewComments, refetch: refetchComments } = useQuery({
        queryKey: ['portal-comments', viewCommentsTicket?.id],
        queryFn: () => getComments(viewCommentsTicket!.id, false, false),
        enabled: !!viewCommentsTicket?.id,
        staleTime: 0,
    });

    // Comments query for viewing public replies (Machines)
    const { data: viewCommentsM, refetch: refetchCommentsM } = useQuery({
        queryKey: ['portal-machine-comments', viewCommentsMachine?.id],
        queryFn: () => getComments(viewCommentsMachine!.id, true, false),
        enabled: !!viewCommentsMachine?.id,
        staleTime: 0,
    });

    const activeComments = viewCommentsTicket ? viewComments : viewCommentsM;
    const refetchActiveComments = viewCommentsTicket ? refetchComments : refetchCommentsM;
    const activeItem = viewCommentsTicket || viewCommentsMachine;

    // Clear unread indicator ONLY when the user explicitly views the comments dialog
    useEffect(() => {
        if (viewCommentsTicket && viewComments) {
            markTicketAsRead(viewCommentsTicket.id, viewComments.length);
        } else if (viewCommentsMachine && viewCommentsM) {
            markTicketAsRead(viewCommentsMachine.id, viewCommentsM.length);
        }
    }, [viewCommentsTicket, viewComments, viewCommentsMachine, viewCommentsM, markTicketAsRead]);

    // Scroll to first unread comment (or bottom if all read) when comments dialog opens or updates
    const unreadStartRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (activeComments && activeItem) {
            setTimeout(() => {
                if (unreadStartRef.current) {
                    unreadStartRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                } else {
                    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                }
            }, 250);
        }
    }, [activeComments?.length, activeItem]);

    const handleOpenChange = (open: boolean) => {
        setFormOpen(open);
        if (!open) {
            setEditingTicketId(null);
            setAttachment(null);
            setKbArticles([]);
            setExpandedKbId(null);
            form.reset({ category: 'email', subject: '', description: '' });
        }
    };

    const handleEdit = (ticket: TicketType) => {
        setEditingTicketId(ticket.id);
        form.reset({
            category: ticket.category,
            subject: ticket.subject,
            description: ticket.description || '',
        });
        setFormOpen(true);
    };

    const handleCheckSolutions = async (e: React.MouseEvent) => {
        e.preventDefault();
        const subject = form.getValues('subject');
        const description = form.getValues('description');
        if (!subject && !description) {
            toast.error('Please enter a subject or description first.');
            return;
        }

        if (aiCooldown) {
            toast.info('Please wait a moment before asking AI again.');
            return;
        }

        setIsCheckingDeflection(true);
        setAiCooldown(true);

        // Cooldown timer (10 seconds)
        setTimeout(() => setAiCooldown(false), 10000);
        try {
            const suggestions = await generateDeflectionSuggestions(subject, description || '');
            setDeflections(suggestions);
            if (suggestions.length === 0) {
                toast.info('No immediate solutions found. Please submit your ticket.');
            }
        } catch {
            toast.error('AI analysis failed.');
        } finally {
            setIsCheckingDeflection(false);
        }
    };

    const handleSubmit = async (data: FormValues) => {
        if (!profile) return toast.error('Profile not loaded');

        // AI Auto-Categorization
        setIsAiAnalyzing(true);
        let aiResult;
        try {
            aiResult = await categorizeAndPrioritizeTicket(data.subject, data.description || '');
        } catch {
            toast.error('AI analysis failed, falling back to defaults.');
            aiResult = { category: 'other' as TicketCategory, priority: 'medium' as TicketPriority, sentiment: 'neutral' as const };
        }
        setIsAiAnalyzing(false);

        let attachment_url = null;
        if (attachment) {
            setIsUploading(true);
            try {
                attachment_url = await uploadTicketAttachment(attachment);
            } catch (error: unknown) {
                setIsUploading(false);
                const msg = error instanceof Error ? error.message : "Upload failed";
                return toast.error(`Attachment failed: ${msg}`);
            }
            setIsUploading(false);
        }

        const fullData: CreateTicketInput = {
            ticket_date: new Date().toISOString().split('T')[0],
            employee_name: profile.name || '',
            department: 'Employee Portal', // Simplified
            created_by: profile.id,
            attachment_url,
            category: data.category,
            priority: aiResult.priority,
            sentiment: aiResult.sentiment,
            subject: data.subject,
            description: data.description,
        };

        if (editingTicketId) {
            updateMut.mutate({ id: editingTicketId, data: fullData });
        } else {
            createMut.mutate(fullData);
        }
    };

    const handleItemSubmit = async (data: RequestItemValues) => {
        if (!profile) return toast.error('Profile not loaded');

        // Extra validation for mandatory conditional fields
        if (data.item_type === 'supplies' && !data.supply_name) {
            return toast.error('Please specify the supply name');
        }
        if (data.item_type !== 'supplies' && !data.reason) {
            return toast.error('Please specify the reason for the machine request');
        }
        if (data.supply_name && data.supply_name.length > 20) {
            return toast.error('Supply name cannot exceed 20 characters');
        }

        const mutationData = {
            ...data,
            item_count: data.item_count,
            requested_from: 'portal' as const,
            reason: data.item_type === 'supplies' ? undefined : (data.reason as any),
        };

        try {
            await addMachine(mutationData as any);
            toast.success('Request submitted successfully');
            setRequestItemOpen(false);
            itemForm.reset();
        } catch (error: any) {
            toast.error(error.message || 'Failed to submit request');
        }
    };

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            {/* Header Area */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-6 shadow-sm border border-slate-200 dark:border-slate-800 rounded-2xl">
                <div>
                    <h2 className="text-2xl font-bold text-foreground">Welcome, {profile?.name}</h2>
                    <p className="text-muted-foreground mt-1 text-sm">Need help? Request an item or create a ticket.</p>
                </div>
                <div className="flex gap-3">
                    <Button onClick={() => setRequestItemOpen(true)} variant="outline" className="border-emerald-600 text-emerald-600 hover:bg-emerald-50 h-11 px-6">
                        <Plus className="h-4 w-4 mr-2" /> Request Item
                    </Button>
                    <Button onClick={() => setFormOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white h-11 px-6 shadow-md shadow-emerald-500/20">
                        <Plus className="h-4 w-4 mr-2" /> Create Ticket
                    </Button>
                </div>
            </div>

            {/* List View */}
            <div>
                <div className="flex justify-between items-end mb-4">
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Your Tickets</h3>
                    <div className="relative w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Search your tickets..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 h-9" />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {isLoading || !profile ? (
                        Array.from({ length: 6 }).map((_, i) => (
                            <Card key={i} className="p-5 border shadow-sm">
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center">
                                        <Skeleton className="h-4 w-16" />
                                        <Skeleton className="h-5 w-24 rounded-full" />
                                    </div>
                                    <Skeleton className="h-5 w-3/4" />
                                    <Skeleton className="h-4 w-1/2" />
                                    <div className="pt-4 border-t mt-4 flex justify-between">
                                        <Skeleton className="h-4 w-20" />
                                        <Skeleton className="h-8 w-24" />
                                    </div>
                                </div>
                            </Card>
                        ))
                    ) : tickets?.length === 0 ? (
                        <div className="col-span-1 md:col-span-2 lg:col-span-3 text-center py-16 bg-white/50 dark:bg-slate-900/50 rounded-2xl border border-dashed">
                            <div className="flex flex-col items-center text-muted-foreground space-y-3">
                                <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center">
                                    <Ticket className="h-6 w-6 opacity-50" />
                                </div>
                                <p>You haven&apos;t reported any issues yet.</p>
                                <Button variant="outline" onClick={() => setFormOpen(true)}>Report your first issue</Button>
                            </div>
                        </div>
                    ) : (
                        tickets?.map((ticket) => (
                            <Card key={ticket.id} className="group relative overflow-hidden border shadow-sm hover:shadow-md transition-all hover:border-emerald-200 dark:hover:border-emerald-800/50 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm flex flex-col h-full">
                                {/* Top Color Bar indicating Priority */}
                                <div className={`absolute top-0 left-0 right-0 h-1 ${ticket.priority === 'critical' ? 'bg-red-500' : ticket.priority === 'high' ? 'bg-orange-500' : ticket.priority === 'medium' ? 'bg-blue-500' : 'bg-slate-400'}`} />

                                <div className="p-5 flex-1 flex flex-col">
                                    <div className="flex justify-between items-start mb-3">
                                        <span className="font-mono text-xs font-semibold text-slate-500 dark:text-slate-400">
                                            #{ticket.number}
                                        </span>
                                        <Badge variant="outline" className={`${statusConfig[ticket.status]?.color} border py-0.5`}>
                                            {statusConfig[ticket.status]?.label}
                                        </Badge>
                                    </div>

                                    <h4 className="font-semibold text-foreground text-lg mb-2 line-clamp-2" title={ticket.subject}>
                                        {ticket.subject}
                                    </h4>

                                    <div className="flex items-center gap-2 mb-4 text-sm text-slate-600 dark:text-slate-400">
                                        <span className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">
                                            <span>{categoryConfig[ticket.category]?.icon}</span>
                                            {categoryConfig[ticket.category]?.label}
                                        </span>
                                        {isInitialized && ticket.public_comment_count > (readCounts[ticket.id] || 0) && (
                                            <span
                                                onClick={() => setViewCommentsTicket(ticket)}
                                                className="cursor-pointer text-[10px] font-medium text-red-600 bg-red-100 dark:bg-red-900/30 px-1.5 py-0.5 rounded flex items-center gap-1 hover:bg-red-200 dark:hover:bg-red-800/50 transition-colors"
                                            >
                                                <span className="relative flex h-2 w-2 mr-0.5">
                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                                                </span>
                                                Unread Reply
                                            </span>
                                        )}
                                    </div>

                                    <div className="mt-auto pt-4 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Assigned To</span>
                                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                                {ticket.assigned_to && staffMap[ticket.assigned_to] ? staffMap[ticket.assigned_to] : <span className="text-slate-400 italic font-normal">Unassigned</span>}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-1">
                                            {ticket.status !== 'closed' && ticket.status !== 'resolved' && (
                                                <>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300" onClick={() => handleEdit(ticket)} title="Edit">
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-400" title="Delete"><Trash2 className="h-4 w-4" /></Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent className="z-[9999]">
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>Delete Ticket #{ticket.number}?</AlertDialogTitle>
                                                                <AlertDialogDescription>This action cannot be undone. Are you sure you want to delete this ticket?</AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white" onClick={() => deleteMut.mutate(ticket.id)}>Delete</AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                </>
                                            )}
                                            {ticket.resolution_notes && (
                                                <Button variant="ghost" size="sm" className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 ml-2" onClick={() => setViewNotesTicket(ticket)}>
                                                    <MessageSquare className="h-4 w-4 mr-2" /> Notes
                                                </Button>
                                            )}
                                            <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/30" onClick={() => setViewCommentsTicket(ticket)}>
                                                <MessageSquare className="h-4 w-4 mr-1.5" /> Updates
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="absolute bottom-5 right-5 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <div className="text-[10px] text-slate-400 font-medium bg-white/80 dark:bg-slate-900/80 px-2 py-1 rounded backdrop-blur border">
                                            {ticket.ticket_date}
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        ))
                    )}
                </div>
            </div>

            {/* Item Requests View */}
            <div className="mt-12 mb-20">
                <div className="flex items-center gap-2 mb-6">
                    <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                        <Package className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Your Item Requests</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {requestsLoading || !profile ? (
                        Array.from({ length: 3 }).map((_, i) => (
                            <Card key={i} className="p-5 border shadow-sm">
                                <Skeleton className="h-4 w-full mb-2" />
                                <Skeleton className="h-4 w-1/2" />
                            </Card>
                        ))
                    ) : !userRequests || userRequests.filter(r => r.created_by === profile?.id).length === 0 ? (
                        <div className="col-span-1 md:col-span-2 lg:col-span-3 text-center py-20 bg-white/30 dark:bg-slate-900/10 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
                            <div className="max-w-xs mx-auto space-y-3">
                                <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto opacity-50">
                                    <Package className="h-6 w-6" />
                                </div>
                                <p className="text-muted-foreground text-sm font-medium">No item requests found.</p>
                                <Button variant="outline" size="sm" onClick={() => setRequestItemOpen(true)}>Request an item</Button>
                            </div>
                        </div>
                    ) : (
                        userRequests.filter(r => r.created_by === profile?.id).map((req) => (
                            <Card key={req.id} className="group relative overflow-hidden border shadow-sm hover:shadow-md transition-all hover:border-emerald-200 dark:hover:border-emerald-800/50 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm flex flex-col h-full">
                                {/* Top Color Bar based on Importance */}
                                <div className={`absolute top-0 left-0 right-0 h-1 ${req.importance === 'urgent' ? 'bg-red-500' : req.importance === 'important' ? 'bg-orange-500' : 'bg-slate-400'}`} />

                                <div className="p-5 flex-1 flex flex-col">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex flex-col gap-1">
                                            <span className="font-mono text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                                                #{req.number || 'REQ'}
                                            </span>
                                            <Badge variant="outline" className={cn(
                                                "text-[9px] px-1.5 py-0 h-4 w-fit font-bold uppercase",
                                                req.importance === 'urgent' ? 'text-red-600 border-red-100 bg-red-50' : req.importance === 'important' ? 'text-orange-600 border-orange-100 bg-orange-50' : 'text-slate-500 border-slate-100 bg-slate-50'
                                            )}>
                                                {req.importance}
                                            </Badge>
                                        </div>
                                        <Badge variant="outline" className={cn(
                                            "text-[10px] py-0.5 px-2 font-bold uppercase border",
                                            req.status === 'pending' ? 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-900/20' : req.status === 'fulfilled' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-red-50 text-red-600 border-red-200'
                                        )}>
                                            {req.status === 'pending' ? '⏳ Pending' : req.status === 'fulfilled' ? '✅ Fulfilled' : '❌ Rejected'}
                                        </Badge>
                                    </div>

                                    <div className="flex items-center gap-2 mb-3">
                                        <div className={cn("p-1.5 rounded-lg", req.item_type === 'supplies' ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-blue-100 dark:bg-blue-900/30')}>
                                            {req.item_type === 'supplies' ? <Package className="h-3.5 w-3.5 text-amber-600" /> : <MonitorIcon className="h-3.5 w-3.5 text-blue-600" />}
                                        </div>
                                        <h4 className="font-bold text-slate-800 dark:text-slate-100 text-base capitalize">
                                            {req.supply_name || (req.item_type === 'desktop' ? 'Desktop PC' : req.item_type === 'laptop' ? 'Laptop Computer' : req.item_type)}
                                        </h4>
                                    </div>

                                    <div className="space-y-4 mb-4">
                                        <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                                            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block mb-1">Reason / Details</span>
                                            <p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                                                {req.item_type === 'supplies' ? (req.supply_name || 'Standard supplies request') : (req.reason ? reasonLabels[req.reason] || req.reason : 'Request for hardware setup')}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="mt-auto pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Quantity</span>
                                            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">x{req.item_count}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {isInitialized && req.public_comment_count > (readCounts[req.id] || 0) && (
                                                <Button variant="ghost" size="sm" className="h-7 text-[10px] font-medium text-red-600 bg-red-100 dark:bg-red-900/30 px-1.5 py-0.5 rounded flex items-center gap-1 hover:bg-red-200 dark:hover:bg-red-800/50 transition-colors" onClick={() => setViewCommentsMachine(req)}>
                                                    <span className="relative flex h-2 w-2 mr-0.5">
                                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                                                    </span>
                                                    Unread Update
                                                </Button>
                                            )}
                                            <Button variant="ghost" size="sm" className="h-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/30" onClick={() => setViewCommentsMachine(req)}>
                                                <MessageSquare className="h-4 w-4 mr-1.5" /> Updates
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        ))
                    )}
                </div>
            </div>

            {/* ===== REPORT ISSUE DIALOG ===== */}
            <Dialog open={formOpen} onOpenChange={handleOpenChange}>
                <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingTicketId ? 'Edit Ticket' : 'Report an Issue'}</DialogTitle>
                        <DialogDescription>{editingTicketId ? 'Update your ticket details.' : 'Describe the problem. AI will auto-prioritize your ticket.'}</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 py-4">

                        {/* AI Deflection Suggestions Panel */}
                        {deflections.length > 0 && (
                            <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/50 rounded-lg p-4 mb-4">
                                <h4 className="flex items-center text-sm font-semibold text-emerald-800 dark:text-emerald-400 mb-2">
                                    <Sparkles className="w-4 h-4 mr-2" />
                                    Suggested Solutions
                                </h4>
                                <div className="space-y-3">
                                    {deflections.map((def, idx) => (
                                        <div key={idx} className="bg-white dark:bg-slate-900 p-3 rounded shadow-sm text-sm">
                                            <p className="font-medium text-slate-800 dark:text-slate-200">{def.title}</p>
                                            <p className="text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">{def.description}</p>
                                        </div>
                                    ))}
                                </div>
                                <p className="text-xs text-emerald-600 dark:text-emerald-500 mt-3 italic">
                                    Still need help? Submit your ticket below.
                                </p>
                            </div>
                        )}
                        <div className="space-y-2">
                            <Label>Category</Label>
                            <Select onValueChange={(v) => form.setValue('category', v as TicketCategory)} value={form.watch('category')}>
                                <SelectTrigger><SelectValue placeholder="Select a category" /></SelectTrigger>
                                <SelectContent>
                                    {Object.entries(categoryConfig).map(([k, v]) => (
                                        <SelectItem key={k} value={k}>{v.icon} {v.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {form.formState.errors.category && <p className="text-red-500 text-xs">{form.formState.errors.category.message}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label>Subject</Label>
                            <Input placeholder="Short summary of the issue" {...form.register('subject')} onBlur={handleSubjectBlur} />
                            {form.formState.errors.subject && <p className="text-red-500 text-xs">{form.formState.errors.subject.message}</p>}
                        </div>

                        {/* KB article suggestions */}
                        {kbArticles.length > 0 && (
                            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/50 rounded-lg p-4">
                                <h4 className="flex items-center text-sm font-semibold text-blue-800 dark:text-blue-400 mb-3">
                                    <BookOpen className="w-4 h-4 mr-2" /> Relevant Help Articles
                                </h4>
                                <div className="space-y-2">
                                    {kbArticles.map((article) => (
                                        <div key={article.id} className="bg-white dark:bg-slate-900 p-3 rounded-md border border-blue-100 dark:border-blue-900/40 text-sm">
                                            <p className="font-medium text-slate-800 dark:text-slate-200">{article.title}</p>
                                            <p className={`text-slate-600 dark:text-slate-400 mt-1 leading-relaxed ${expandedKbId === article.id ? '' : 'line-clamp-2'}`}>
                                                {article.content}
                                            </p>
                                            {article.content.length > 120 && (
                                                <button
                                                    type="button"
                                                    onClick={() => setExpandedKbId(expandedKbId === article.id ? null : article.id)}
                                                    className="text-xs text-blue-600 hover:text-blue-700 mt-1 font-medium"
                                                >
                                                    {expandedKbId === article.id ? 'Show less' : 'Read more'}
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <p className="text-xs text-blue-600 dark:text-blue-500 mt-3 italic">
                                    Did one of these solve your issue? If not, continue below to submit a ticket.
                                </p>
                            </div>
                        )}
                        <div className="space-y-2">
                            <Label>Description</Label>
                            <Textarea placeholder="More details about what's going wrong..." className="min-h-[100px]" {...form.register('description')} />
                        </div>
                        <div className="space-y-2">
                            <Label>Attachment (Optional)</Label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={(e) => setAttachment(e.target.files?.[0] || null)}
                                    className="hidden"
                                    accept="image/*,.pdf,.doc,.docx"
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="text-slate-600 dark:text-slate-300"
                                >
                                    <Paperclip className="h-4 w-4 mr-2" />
                                    Choose File
                                </Button>
                                {attachment && (
                                    <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-md border border-slate-200 dark:border-slate-700">
                                        <span className="text-sm text-slate-700 dark:text-slate-300 truncate max-w-[200px]">
                                            {attachment.name}
                                        </span>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-5 w-5 text-slate-400 hover:text-red-500 rounded-full"
                                            onClick={() => {
                                                setAttachment(null);
                                                if (fileInputRef.current) fileInputRef.current.value = '';
                                            }}
                                        >
                                            <X className="h-3 w-3" />
                                        </Button>
                                    </div>
                                )}
                            </div>
                            <p className="text-xs text-slate-500">Attach screenshots or error logs if available.</p>
                        </div>

                        <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-4 border-t border-border mt-6">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleCheckSolutions}
                                disabled={isCheckingDeflection || aiCooldown}
                                className="w-full sm:w-auto text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                            >
                                {isCheckingDeflection ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Bot className="w-4 h-4 mr-2" />}
                                {aiCooldown ? 'Wait...' : 'Check for Solutions'}
                            </Button>

                            <div className="flex items-center gap-3 w-full sm:w-auto">
                                <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)} className="flex-1 sm:flex-none">Cancel</Button>
                                <Button type="submit" disabled={createMut.isPending || updateMut.isPending || isUploading || isAiAnalyzing} className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-500/20 flex-1 sm:flex-none">
                                    {(createMut.isPending || updateMut.isPending || isUploading || isAiAnalyzing)
                                        ? (isUploading ? 'Uploading file...' : isAiAnalyzing ? 'AI Analyzing...' : 'Saving...')
                                        : (editingTicketId ? 'Save Changes' : 'Submit Ticket')
                                    }
                                </Button>
                            </div>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* ===== REQUEST ITEM DIALOG ===== */}
            <Dialog open={requestItemOpen} onOpenChange={(open) => { setRequestItemOpen(open); if (!open) itemForm.reset(); }}>
                <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Request Item</DialogTitle>
                        <DialogDescription>Submit a request for supplies or hardware.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={itemForm.handleSubmit(handleItemSubmit)} className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Select Item</Label>
                            <Select
                                onValueChange={(v) => itemForm.setValue('item_type', v as any)}
                                value={itemForm.watch('item_type')}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select item type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="supplies">
                                        <div className="flex items-center gap-2">
                                            <Package className="h-4 w-4 text-emerald-500" />
                                            <span>Supplies</span>
                                        </div>
                                    </SelectItem>
                                    <SelectItem value="desktop">
                                        <div className="flex items-center gap-2">
                                            <MonitorIcon className="h-4 w-4 text-blue-500" />
                                            <span>Desktop</span>
                                        </div>
                                    </SelectItem>
                                    <SelectItem value="laptop">
                                        <div className="flex items-center gap-2">
                                            <LaptopIcon className="h-4 w-4 text-indigo-500" />
                                            <span>Laptop</span>
                                        </div>
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Date</Label>
                                <Input type="date" {...itemForm.register('date')} />
                            </div>
                            <div className="space-y-2">
                                <Label>Importance</Label>
                                <Select
                                    onValueChange={(v) => itemForm.setValue('importance', v as any)}
                                    value={itemForm.watch('importance')}
                                >
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
                            <Label>Requester Name <span className="text-red-500">*</span></Label>
                            <Input required {...itemForm.register('requester_name')} placeholder="Enter your full name" />
                            {itemForm.formState.errors.requester_name?.message && <p className="text-red-500 text-xs">{itemForm.formState.errors.requester_name.message}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label>Work Email <span className="text-red-500">*</span></Label>
                            <Input required type="email" {...itemForm.register('work_email')} placeholder="yourname@jtl.co.ke" />
                            {itemForm.formState.errors.work_email?.message && <p className="text-red-500 text-xs">{itemForm.formState.errors.work_email.message}</p>}
                        </div>

                        {itemForm.watch('item_type') === 'supplies' ? (
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Type of Supplies <span className="text-red-500">*</span></Label>
                                    <Input required {...itemForm.register('supply_name')} placeholder="e.g. Printer Toners" maxLength={20} />
                                    {itemForm.formState.errors.supply_name?.message && <p className="text-red-500 text-xs">{itemForm.formState.errors.supply_name.message}</p>}
                                    <p className="text-[10px] text-slate-400 italic">Limit: 20 characters</p>
                                </div>
                                <div className="space-y-2">
                                    <Label>Number of Supplies <span className="text-red-500">*</span></Label>
                                    <Input required type="number" min="1" max="999" {...itemForm.register('item_count')} placeholder="Qty (e.g. 5)" />
                                    {itemForm.formState.errors.item_count?.message && <p className="text-red-500 text-xs">{itemForm.formState.errors.item_count.message}</p>}
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Reason <span className="text-red-500">*</span></Label>
                                    <Select
                                        onValueChange={(v) => itemForm.setValue('reason', v as any)}
                                        value={itemForm.watch('reason') || ''}
                                    >
                                        <SelectTrigger><SelectValue placeholder="Select reason" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="old-hardware">Old Hardware</SelectItem>
                                            <SelectItem value="faulty">Faulty</SelectItem>
                                            <SelectItem value="new-user">New User</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Number of Computers <span className="text-red-500">*</span></Label>
                                    <Input required type="number" min="1" max="999" {...itemForm.register('item_count')} placeholder="Qty (e.g. 1)" />
                                    {itemForm.formState.errors.item_count?.message && <p className="text-red-500 text-xs">{itemForm.formState.errors.item_count.message}</p>}
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label>Notes (Optional)</Label>
                            <Textarea placeholder="Any additional details..." {...itemForm.register('notes')} />
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t">
                            <Button type="button" variant="ghost" onClick={() => setRequestItemOpen(false)}>Cancel</Button>
                            <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-500/20">
                                Submit Request
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* ===== VIEW UPDATES / COMMENTS DIALOG (Unified) ===== */}
            <Dialog open={!!activeItem} onOpenChange={(open) => { if (!open) { setViewCommentsTicket(null); setViewCommentsMachine(null); setNewComment(''); } }}>
                <DialogContent className="sm:max-w-[500px] h-[600px] flex flex-col p-0 overflow-hidden">
                    <DialogHeader className="p-4 border-b">
                        <DialogTitle className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <MessageSquare className="h-5 w-5 text-emerald-500" />
                                <span>Updates for {viewCommentsTicket ? 'Ticket' : 'Request'} #{activeItem?.number}</span>
                            </div>
                            <Badge variant="outline" className="text-[10px] uppercase font-bold">{activeItem?.status}</Badge>
                        </DialogTitle>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/30 dark:bg-slate-900/10">
                        {(!activeComments || activeComments.length === 0) ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2">
                                <MessageSquare className="h-8 w-8 opacity-20" />
                                <p className="text-xs font-medium">No updates yet from IT Support.</p>
                            </div>
                        ) : (
                            activeComments.map((c: any, i: number) => {
                                const isMe = c.user_id === profile?.id;
                                const readCount = readCounts[activeItem!.id] || 0;
                                const isFirstUnread = i === readCount && activeComments.length > readCount;

                                return (
                                    <div key={c.id} className={cn("flex flex-col w-full", isMe ? "items-end" : "items-start")}>
                                        {isFirstUnread && (
                                            <div ref={unreadStartRef} className="w-full flex items-center gap-2 my-4">
                                                <div className="h-[1px] flex-1 bg-red-100 dark:bg-red-900/30" />
                                                <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest px-2">New Updates</span>
                                                <div className="h-[1px] flex-1 bg-red-100 dark:bg-red-900/30" />
                                            </div>
                                        )}
                                        <div className={cn("max-w-[85%] flex flex-col", isMe ? "items-end" : "items-start")}>
                                            <div className={cn("px-4 py-2.5 rounded-2xl text-sm shadow-sm",
                                                isMe ? "bg-emerald-600 text-white rounded-br-none" : "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-bl-none border border-slate-100 dark:border-slate-800")}>
                                                {!isMe && <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 mb-1 uppercase tracking-wider">{c.author_name}</div>}
                                                <p className="leading-relaxed whitespace-pre-wrap">{c.content}</p>
                                            </div>
                                            <span className="text-[10px] text-slate-400 mt-1 px-1">
                                                {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    <form
                        onSubmit={async (e) => {
                            e.preventDefault();
                            if (!newComment.trim() || !activeItem || !profile) return;
                            setIsPostingComment(true);
                            try {
                                await addComment({
                                    ticket_id: viewCommentsTicket?.id,
                                    machine_id: viewCommentsMachine?.id,
                                    content: newComment.trim(),
                                    is_internal: false
                                }, profile.name || 'User');
                                setNewComment('');
                                refetchActiveComments();
                                queryClient.invalidateQueries({ queryKey: [viewCommentsTicket ? 'portal-tickets' : 'portal-machines'] });
                            } catch (error: any) {
                                toast.error(error.message || 'Failed to post comment');
                            } finally {
                                setIsPostingComment(false);
                            }
                        }}
                        className="p-4 border-t bg-white dark:bg-slate-950 flex gap-2 shadow-[0_-4px_12px_rgba(0,0,0,0.03)]"
                    >
                        <Input
                            placeholder="Type a message..."
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            className="bg-slate-50 dark:bg-slate-900 border-none focus-visible:ring-emerald-500"
                        />
                        <Button type="submit" size="icon" disabled={isPostingComment || !newComment.trim()} className="bg-emerald-600 hover:bg-emerald-700 shrink-0 shadow-lg shadow-emerald-500/20">
                            {isPostingComment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        </Button>
                    </form>
                </DialogContent>
            </Dialog>

            {/* ===== VIEW NOTES DIALOG ===== */}
            <Dialog open={!!viewNotesTicket} onOpenChange={(open) => !open && setViewNotesTicket(null)}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>IT Response</DialogTitle>
                        <DialogDescription>Ticket #{viewNotesTicket?.number}: {viewNotesTicket?.subject}</DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed shadow-inner">
                            {viewNotesTicket?.resolution_notes}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Badge variant="outline" className={viewNotesTicket ? (statusConfig[viewNotesTicket.status]?.color || '') : ''}>
                                {viewNotesTicket ? statusConfig[viewNotesTicket.status]?.label : ''}
                            </Badge>
                            <span>— Resolved by {viewNotesTicket?.assigned_to && staffMap[viewNotesTicket.assigned_to] ? staffMap[viewNotesTicket.assigned_to] : 'IT Support'}</span>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div >
    );
}
