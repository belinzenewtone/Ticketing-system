'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getKbArticles, addKbArticle, updateKbArticle, deleteKbArticle } from '@/services/knowledgeBase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { BookOpen, Plus, Search, Pencil, Trash2, Tag } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import type { TicketCategory, KbArticle, CreateKbArticleInput } from '@/types/database';
import { formatDistanceToNow } from 'date-fns';

const categoryConfig: Record<TicketCategory, { label: string; icon: string }> = {
    email: { label: 'Email', icon: '📧' },
    'account-login': { label: 'Account / Login', icon: '🔐' },
    'password-reset': { label: 'Password Reset', icon: '🔑' },
    hardware: { label: 'Hardware', icon: '💻' },
    software: { label: 'Software', icon: '📦' },
    'network-vpn': { label: 'Network / VPN', icon: '🌐' },
    other: { label: 'Other', icon: '📋' },
};

const articleSchema = z.object({
    title: z.string().min(3, 'Title must be at least 3 characters'),
    content: z.string().min(10, 'Content must be at least 10 characters'),
    category: z.string().optional(),
});

type FormValues = z.infer<typeof articleSchema>;

export default function KnowledgeBasePage() {
    const [formOpen, setFormOpen] = useState(false);
    const [editingArticle, setEditingArticle] = useState<KbArticle | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [filterCategory, setFilterCategory] = useState<TicketCategory | 'all'>('all');

    const queryClient = useQueryClient();

    const { data: articles, isLoading } = useQuery({
        queryKey: ['kb-articles', filterCategory, search],
        queryFn: () => getKbArticles({
            category: filterCategory === 'all' ? undefined : filterCategory,
            search: search || undefined,
        }),
    });

    const createMut = useMutation({
        mutationFn: addKbArticle,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['kb-articles'] });
            toast.success('Article created');
            handleClose();
        },
        onError: (e: Error) => toast.error(e.message),
    });

    const updateMut = useMutation({
        mutationFn: ({ id, updates }: { id: string; updates: Partial<KbArticle> }) => updateKbArticle(id, updates),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['kb-articles'] });
            toast.success('Article updated');
            handleClose();
        },
        onError: (e: Error) => toast.error(e.message),
    });

    const deleteMut = useMutation({
        mutationFn: deleteKbArticle,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['kb-articles'] });
            toast.success('Article deleted');
        },
        onError: (e: Error) => toast.error(e.message),
    });

    const form = useForm<FormValues>({
        resolver: zodResolver(articleSchema),
        defaultValues: { title: '', content: '', category: 'all' },
    });

    const handleClose = () => {
        setFormOpen(false);
        setEditingArticle(null);
        form.reset({ title: '', content: '', category: 'all' });
    };

    const handleEdit = (article: KbArticle) => {
        setEditingArticle(article);
        form.reset({
            title: article.title,
            content: article.content,
            category: article.category ?? 'all',
        });
        setFormOpen(true);
    };

    const handleSubmit = (data: FormValues) => {
        const input: CreateKbArticleInput = {
            title: data.title,
            content: data.content,
            category: data.category === 'all' || !data.category ? null : data.category as TicketCategory,
        };
        if (editingArticle) {
            updateMut.mutate({ id: editingArticle.id, updates: input });
        } else {
            createMut.mutate(input);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
                        <BookOpen className="h-8 w-8 text-emerald-500" /> Knowledge Base
                    </h1>
                    <p className="text-muted-foreground mt-1">Self-help articles for common IT issues</p>
                </div>
                <Button onClick={() => setFormOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                    <Plus className="h-4 w-4 mr-2" /> New Article
                </Button>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search articles..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-10"
                    />
                </div>
                <Select value={filterCategory} onValueChange={(v) => setFilterCategory(v as TicketCategory | 'all')}>
                    <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {Object.entries(categoryConfig).map(([k, v]) => (
                            <SelectItem key={k} value={k}>{v.icon} {v.label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Stats bar */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <BookOpen className="h-4 w-4" />
                <span>{isLoading ? '...' : articles?.length ?? 0} article{articles?.length !== 1 ? 's' : ''}</span>
                {filterCategory !== 'all' && (
                    <Badge variant="outline" className="ml-1 text-xs">
                        {categoryConfig[filterCategory]?.icon} {categoryConfig[filterCategory]?.label}
                    </Badge>
                )}
            </div>

            {/* Articles Grid */}
            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <Card key={i} className="border shadow-sm">
                            <CardHeader><Skeleton className="h-5 w-3/4" /></CardHeader>
                            <CardContent className="space-y-2">
                                <Skeleton className="h-4 w-full" />
                                <Skeleton className="h-4 w-2/3" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : articles?.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                    <BookOpen className="h-16 w-16 mb-4 opacity-20" />
                    <p className="text-lg font-medium">No articles yet</p>
                    <p className="text-sm mt-1">Create your first knowledge base article to help employees self-serve.</p>
                    <Button onClick={() => setFormOpen(true)} className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white">
                        <Plus className="h-4 w-4 mr-2" /> Create First Article
                    </Button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {articles?.map((article) => {
                        const isExpanded = expandedId === article.id;
                        const cfg = article.category ? categoryConfig[article.category as TicketCategory] : null;
                        return (
                            <Card key={article.id} className="border shadow-sm hover:shadow-md transition-shadow">
                                <CardHeader className="pb-3">
                                    <div className="flex items-start justify-between gap-3">
                                        <CardTitle className="text-base font-semibold text-foreground leading-snug">
                                            {article.title}
                                        </CardTitle>
                                        <div className="flex items-center gap-1 shrink-0">
                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300" onClick={() => handleEdit(article)}>
                                                <Pencil className="h-3.5 w-3.5" />
                                            </Button>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-500">
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Delete this article?</AlertDialogTitle>
                                                        <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                        <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => deleteMut.mutate(article.id)}>Delete</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
                                        {cfg && (
                                            <Badge variant="outline" className="text-xs gap-1">
                                                <Tag className="h-2.5 w-2.5" /> {cfg.icon} {cfg.label}
                                            </Badge>
                                        )}
                                        <span className="text-[11px] text-muted-foreground">
                                            {formatDistanceToNow(new Date(article.updated_at), { addSuffix: true })}
                                        </span>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <p className={`text-sm text-muted-foreground whitespace-pre-wrap ${isExpanded ? '' : 'line-clamp-3'}`}>
                                        {article.content}
                                    </p>
                                    {article.content.length > 200 && (
                                        <button
                                            onClick={() => setExpandedId(isExpanded ? null : article.id)}
                                            className="text-xs text-emerald-600 hover:text-emerald-700 mt-2 font-medium"
                                        >
                                            {isExpanded ? 'Show less' : 'Read more'}
                                        </button>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* Create / Edit Dialog */}
            <Dialog open={formOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
                <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingArticle ? 'Edit Article' : 'New Knowledge Base Article'}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 mt-4">
                        <div className="space-y-2">
                            <Label>Title *</Label>
                            <Input placeholder="e.g. How to reset your password" {...form.register('title')} />
                            {form.formState.errors.title && <p className="text-red-500 text-xs">{form.formState.errors.title.message}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label>Category</Label>
                            <Select
                                value={form.watch('category') || 'all'}
                                onValueChange={(v) => form.setValue('category', v)}
                            >
                                <SelectTrigger><SelectValue placeholder="Select category (optional)" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">General (No specific category)</SelectItem>
                                    {Object.entries(categoryConfig).map(([k, v]) => (
                                        <SelectItem key={k} value={k}>{v.icon} {v.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Content *</Label>
                            <Textarea
                                placeholder="Write the step-by-step instructions or explanation..."
                                className="min-h-[200px]"
                                {...form.register('content')}
                            />
                            {form.formState.errors.content && <p className="text-red-500 text-xs">{form.formState.errors.content.message}</p>}
                        </div>
                        <div className="flex justify-end gap-3 pt-2">
                            <Button type="button" variant="ghost" onClick={handleClose}>Cancel</Button>
                            <Button
                                type="submit"
                                disabled={createMut.isPending || updateMut.isPending}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                            >
                                {(createMut.isPending || updateMut.isPending) ? 'Saving...' : editingArticle ? 'Update Article' : 'Create Article'}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
