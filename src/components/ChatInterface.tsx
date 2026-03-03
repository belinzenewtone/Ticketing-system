'use client';

import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getComments, addComment, deleteComment } from '@/services/comments';
import { useUnreadComments } from '@/hooks/useUnreadComments';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, MessageSquare, Send, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ChatInterfaceProps {
    id: string;
    isMachine?: boolean;
    isAdmin?: boolean;
    profile: { id: string; name: string | null } | null;
    number?: string | number;
    status?: string;
    onClose?: () => void;
}

export function ChatInterface({ id, isMachine = false, isAdmin = false, profile, number, status, onClose }: ChatInterfaceProps) {
    const [newComment, setNewComment] = useState('');
    const [isPostingComment, setIsPostingComment] = useState(false);
    const [isInternal, setIsInternal] = useState(false);
    const queryClient = useQueryClient();
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const unreadStartRef = useRef<HTMLDivElement>(null);
    const { readCounts, markTicketAsRead } = useUnreadComments();

    const { data: comments, refetch } = useQuery({
        queryKey: ['comments', id, isMachine, isAdmin],
        queryFn: () => getComments(id, isMachine, isAdmin),
        enabled: !!id,
    });

    useEffect(() => {
        if (id && comments && !isAdmin) {
            markTicketAsRead(id, comments.length);
        }
    }, [id, comments, isAdmin]);

    useEffect(() => {
        if (comments) {
            setTimeout(() => {
                if (unreadStartRef.current) {
                    unreadStartRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                } else {
                    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                }
            }, 250);
        }
    }, [comments?.length, id]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newComment.trim() || !id || !profile) return;
        setIsPostingComment(true);
        try {
            await addComment({
                ticket_id: isMachine ? undefined : id,
                machine_id: isMachine ? id : undefined,
                content: newComment.trim(),
                is_internal: isInternal
            }, profile.name || (isAdmin ? 'Admin' : 'User'));
            setNewComment('');
            refetch();
            queryClient.invalidateQueries({ queryKey: [isMachine ? 'inventory-list' : 'tickets-list'] });
        } catch (error: any) {
            toast.error(error.message || 'Failed to post comment');
        } finally {
            setIsPostingComment(false);
        }
    };

    const handleDelete = async (commentId: string) => {
        try {
            await deleteComment(commentId);
            refetch();
            toast.success('Comment deleted');
        } catch (error: any) {
            toast.error(error.message || 'Failed to delete comment');
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-50/30 dark:bg-slate-900/10">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {(!comments || comments.length === 0) ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2 py-20">
                        <MessageSquare className="h-8 w-8 opacity-20" />
                        <p className="text-xs font-medium">No updates yet{isAdmin ? '.' : ' from IT Support.'}</p>
                    </div>
                ) : (
                    comments.map((c: any, i: number) => {
                        const isMe = c.user_id === profile?.id;
                        const readCount = readCounts[id] || 0;
                        const isFirstUnread = !isAdmin && i === readCount && comments.length > readCount;

                        return (
                            <div key={c.id} className={cn("flex flex-col w-full", isMe ? "items-end" : "items-start")}>
                                {isFirstUnread && (
                                    <div ref={unreadStartRef} className="w-full flex items-center gap-2 my-4">
                                        <div className="h-[1px] flex-1 bg-red-100 dark:bg-red-900/30" />
                                        <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest px-2">New Updates</span>
                                        <div className="h-[1px] flex-1 bg-red-100 dark:bg-red-900/30" />
                                    </div>
                                )}
                                <div className={cn("flex items-end gap-2 max-w-[85%]", isMe && "flex-row-reverse")}>
                                    <div className={cn(
                                        "h-8 w-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold shadow-sm border",
                                        isMe ? "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800" : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600"
                                    )}>
                                        {c.author_name.charAt(0).toUpperCase()}
                                    </div>

                                    <div className="flex flex-col">
                                        <div className={cn(
                                            "px-4 py-2.5 rounded-2xl text-sm shadow-sm relative group",
                                            isMe ? "bg-emerald-600 text-white rounded-br-none" : "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-bl-none border border-slate-100 dark:border-slate-800",
                                            c.is_internal && "border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-100"
                                        )}>
                                            {!isMe && (
                                                <div className={cn("text-[10px] font-bold mb-1 uppercase tracking-wider", c.is_internal ? "text-amber-600" : "text-emerald-600 dark:text-emerald-400")}>
                                                    {c.author_name} {c.is_internal && <span className="text-[9px] lowercase italic">(Internal Note)</span>}
                                                </div>
                                            )}
                                            <p className="leading-relaxed whitespace-pre-wrap">{c.content}</p>
                                            {isAdmin && c.user_id === profile?.id && (
                                                <button
                                                    onClick={() => handleDelete(c.id)}
                                                    className={cn(
                                                        "absolute -top-2 -right-2 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm z-10",
                                                        c.is_internal ? "bg-amber-200 text-amber-700 hover:bg-amber-300" : "bg-emerald-700 text-white hover:bg-emerald-800"
                                                    )}
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </button>
                                            )}
                                        </div>
                                        <span className={cn("text-[9px] text-slate-400 mt-1 px-1 font-medium", isMe ? "text-right" : "text-left")}>
                                            {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSend} className="p-4 border-t bg-white dark:bg-slate-950 flex flex-col gap-3 shadow-[0_-4px_12px_rgba(0,0,0,0.03)]">
                {isAdmin && (
                    <div className="flex items-center gap-2 mb-1">
                        <input
                            type="checkbox"
                            id="internal-chat"
                            className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                            checked={isInternal}
                            onChange={(e) => setIsInternal(e.target.checked)}
                        />
                        <label htmlFor="internal-chat" className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">Internal IT Note</label>
                    </div>
                )}
                <div className="flex gap-3">
                    <Input
                        placeholder="Type a message..."
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 focus-visible:ring-emerald-500 h-11"
                    />
                    <Button type="submit" disabled={isPostingComment || !newComment.trim()} className="bg-emerald-600 hover:bg-emerald-700 shrink-0 shadow-lg shadow-emerald-500/20 px-6 h-11 font-bold text-xs uppercase tracking-wider">
                        {isPostingComment ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-3.5 w-3.5 mr-2" /> Post {isAdmin ? 'Update' : 'Comment'}</>}
                    </Button>
                </div>
            </form>
        </div>
    );
}
