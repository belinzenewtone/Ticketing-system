'use client';

import { useUnreadComments } from '@/hooks/useUnreadComments';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
import { Plus, Search, Ticket, CheckCircle2, Loader2, Archive, MessageSquare, Paperclip, Pencil, Trash2, BookOpen, Send, X } from 'lucide-react';
import { toast } from 'sonner';
import { useState, useCallback, useRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { TicketCategory, TicketPriority, TicketStatus, CreateTicketInput, Ticket as TicketType, KbArticle, Profile } from '@/types/database';
import { generateDeflectionSuggestions, categorizeAndPrioritizeTicket, type DeflectionSuggestion } from '@/services/ai';
import { Bot, Sparkles } from 'lucide-react';
import { getKbArticles } from '@/services/knowledgeBase';
import { getComments, addComment } from '@/services/comments';
import { formatDistanceToNow } from 'date-fns';

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

// ── Validation ───────────────────────────────────────────────
const ticketSchema = z.object({
    category: z.enum(['email', 'account-login', 'password-reset', 'hardware', 'software', 'network-vpn', 'other']),
    subject: z.string().min(3, 'Subject required'),
    description: z.string().optional(),
});

type FormValues = z.infer<typeof ticketSchema>;

// ── Page ─────────────────────────────────────────────────────
export default function PortalPage() {
    const { profile } = useAppStore();
    const { readCounts, isInitialized, markTicketAsRead } = useUnreadComments();
    const [formOpen, setFormOpen] = useState(false);
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

    // Comments (for viewing public replies per ticket)
    const [viewCommentsTicket, setViewCommentsTicket] = useState<TicketType | null>(null);
    const [newComment, setNewComment] = useState('');
    const [isPostingComment, setIsPostingComment] = useState(false);

    const queryClient = useQueryClient();

    // Fetch IT Staff mapping
    const { data: staffList } = useQuery({ queryKey: ['staff'], queryFn: getITStaff });
    const staffMap = staffList?.reduce((acc, s) => { acc[s.id] = s.name; return acc; }, {} as Record<string, string>) || {};

    // Only fetch tickets created by this user
    const { data: tickets, isLoading } = useQuery({
        queryKey: ['portal-tickets', profile?.id, search],
        queryFn: () => getTickets({ created_by: profile?.id, search: search || undefined }),
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

    // Comments query for viewing public replies
    const { data: viewComments, refetch: refetchComments } = useQuery({
        queryKey: ['portal-comments', viewCommentsTicket?.id],
        queryFn: () => getComments(viewCommentsTicket!.id, false),
        enabled: !!viewCommentsTicket?.id,
    });

    // Clear unread indicator ONLY when the user explicitly views the comments dialog
    useEffect(() => {
        if (viewCommentsTicket && viewComments) {
            markTicketAsRead(viewCommentsTicket.id, viewComments.length);
        }
    }, [viewCommentsTicket, viewComments, markTicketAsRead]);

    // Scroll to bottom when comments loaded or updated
    useEffect(() => {
        if (viewComments && viewCommentsTicket) {
            // Use timeout to allow DOM to paint the new items first
            setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 250);
        }
    }, [viewComments?.length, viewCommentsTicket]);

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

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            {/* Header Area */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-6 shadow-sm border border-slate-200 dark:border-slate-800 rounded-2xl">
                <div>
                    <h2 className="text-2xl font-bold text-foreground">Welcome, {profile?.name}</h2>
                    <p className="text-muted-foreground mt-1 text-sm">Need help? Report an issue to the IT department.</p>
                </div>
                <Button onClick={() => setFormOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white h-11 px-6 shadow-md shadow-emerald-500/20">
                    <Plus className="h-4 w-4 mr-2" /> Report Issue
                </Button>
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
                    {isLoading ? (
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
                                        {isInitialized && (ticket as any).public_comment_count > (readCounts[ticket.id] || 0) && (
                                            <span className="text-[10px] font-medium text-red-600 bg-red-100 dark:bg-red-900/30 px-1.5 py-0.5 rounded flex items-center gap-1">
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

            {/* ===== VIEW UPDATES / COMMENTS DIALOG ===== */}
            <Dialog open={!!viewCommentsTicket} onOpenChange={(open) => { if (!open) { setViewCommentsTicket(null); setNewComment(''); } }}>
                <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <MessageSquare className="h-5 w-5 text-blue-500" /> Ticket Updates
                        </DialogTitle>
                        <DialogDescription>#{viewCommentsTicket?.number}: {viewCommentsTicket?.subject}</DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        {/* Public comments thread - WhatsApp Style */}
                        <div className="space-y-4 max-h-[350px] overflow-y-auto pr-2 pb-2">
                            {!viewComments ? (
                                <div className="space-y-4">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-16 w-3/4 rounded-2xl" />)}</div>
                            ) : viewComments.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                                    <MessageSquare className="h-8 w-8 mb-2 opacity-30" />
                                    <p className="text-sm">No updates from IT yet.</p>
                                </div>
                            ) : viewComments.map(comment => {
                                const isMe = comment.user_id === profile?.id;

                                return (
                                    <div key={comment.id} className={`flex flex-col w-full ${isMe ? 'items-end' : 'items-start'}`}>
                                        <div className="flex items-end gap-2 max-w-[85%]">
                                            {!isMe && (
                                                <div className="h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex-shrink-0 flex items-center justify-center text-xs font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                                                    {(comment.author_name || 'U').charAt(0).toUpperCase()}
                                                </div>
                                            )}

                                            <div className={`relative px-4 py-2.5 rounded-2xl shadow-sm text-sm ${isMe
                                                ? 'bg-emerald-600 text-white rounded-br-sm'
                                                : 'bg-white dark:bg-slate-800 border border-emerald-100 dark:border-emerald-900 text-foreground rounded-bl-sm'}`}>

                                                {/* Author Name for received messages */}
                                                {!isMe && <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-0.5">{comment.author_name}</div>}

                                                <p className="whitespace-pre-wrap leading-relaxed">{comment.content}</p>

                                                <div className={`text-[10px] mt-1 text-right ${isMe ? 'text-emerald-100' : 'text-slate-400'}`}>
                                                    {comment.created_at ? formatDistanceToNow(new Date(comment.created_at), { addSuffix: true }) : 'just now'}
                                                </div>
                                            </div>

                                            {isMe && (
                                                <div className="h-8 w-8 rounded-full bg-slate-200 dark:bg-slate-700 flex-shrink-0 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-300">
                                                    {(comment.author_name || 'U').charAt(0).toUpperCase()}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Employee reply */}
                        <div className="border-t pt-4 space-y-3">
                            <Label className="text-sm">Reply to IT Support</Label>
                            <Textarea
                                placeholder="Add a follow-up message..."
                                className="min-h-[80px]"
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                            />
                            <div className="flex justify-end">
                                <Button
                                    size="sm"
                                    disabled={!newComment.trim() || isPostingComment}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                    onClick={async () => {
                                        if (!newComment.trim() || !viewCommentsTicket || !profile) return;
                                        setIsPostingComment(true);
                                        try {
                                            await addComment(
                                                { ticket_id: viewCommentsTicket.id, content: newComment.trim(), is_internal: false },
                                                profile.name || "User"
                                            );
                                            setNewComment('');
                                            refetchComments();
                                            toast.success('Reply sent');
                                        } catch (e: unknown) {
                                            const msg = e instanceof Error ? e.message : "Failed to send";
                                            toast.error(msg);
                                        } finally {
                                            setIsPostingComment(false);
                                        }
                                    }}
                                >
                                    <Send className="h-3.5 w-3.5 mr-1.5" />
                                    {isPostingComment ? 'Sending...' : 'Send Reply'}
                                </Button>
                            </div>
                        </div>
                    </div>
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
                            <Badge variant="outline" className={viewNotesTicket ? statusConfig[viewNotesTicket.status]?.color : ''}>
                                {viewNotesTicket ? statusConfig[viewNotesTicket.status]?.label : ''}
                            </Badge>
                            <span>— Resolved by {viewNotesTicket?.assigned_to && staffMap[viewNotesTicket.assigned_to] ? staffMap[viewNotesTicket.assigned_to] : 'IT Support'}</span>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
