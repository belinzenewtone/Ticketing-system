'use client';

import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getComments, addComment, deleteComment } from '@/services/comments';
import { useUnreadComments } from '@/hooks/useUnreadComments';
import { Button } from '@/components/ui/button';
import { Loader2, MessageSquare, Send, Trash2, Lock } from 'lucide-react';
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

function Bubble({ letter, isMe }: { letter: string; isMe: boolean }) {
    return (
        <div className={cn(
            'h-7 w-7 rounded-full flex-shrink-0 flex items-center justify-center text-[11px] font-bold',
            isMe
                ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300'
                : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
        )}>
            {letter}
        </div>
    );
}

export function ChatInterface({
    id, isMachine = false, isAdmin = false, profile, number, status, onClose
}: ChatInterfaceProps) {
    const [newComment, setNewComment] = useState('');
    const [isPosting, setIsPosting] = useState(false);
    const [isInternal, setIsInternal] = useState(false);
    const queryClient = useQueryClient();
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const unreadStartRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const { readCounts, markTicketAsRead } = useUnreadComments();

    const { data: comments, refetch } = useQuery({
        queryKey: ['comments', id, isMachine, isAdmin],
        queryFn: () => getComments(id, isMachine, isAdmin),
        enabled: !!id,
    });

    useEffect(() => {
        if (id && comments) markTicketAsRead(id, comments.length);
    }, [id, comments]);

    useEffect(() => {
        if (comments) {
            setTimeout(() => {
                if (unreadStartRef.current) {
                    unreadStartRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                } else {
                    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                }
            }, 200);
        }
    }, [comments?.length, id]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newComment.trim() || !id || !profile) return;
        setIsPosting(true);
        try {
            await addComment({
                ticket_id: isMachine ? undefined : id,
                machine_id: isMachine ? id : undefined,
                content: newComment.trim(),
                is_internal: isInternal,
            }, profile.name || (isAdmin ? 'Admin' : 'User'));
            setNewComment('');
            refetch();
            queryClient.invalidateQueries({ queryKey: [isMachine ? 'inventory-list' : 'tickets-list'] });
        } catch (error: any) {
            toast.error(error.message || 'Failed to post comment');
        } finally {
            setIsPosting(false);
        }
    };

    const handleDelete = async (commentId: string) => {
        try {
            await deleteComment(commentId);
            refetch();
            toast.success('Message deleted');
        } catch (error: any) {
            toast.error(error.message || 'Failed to delete');
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend(e as any);
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950/60">

            {/* ── Messages ── */}
            <div className="flex-1 overflow-y-auto px-4 py-5 space-y-1 min-h-0">
                {!comments ? (
                    // Loading skeleton
                    <div className="space-y-4 py-4">
                        {[75, 55, 70].map((w, i) => (
                            <div key={i} className={cn('flex items-end gap-2', i % 2 === 0 ? '' : 'flex-row-reverse')}>
                                <div className="h-7 w-7 rounded-full bg-slate-200 dark:bg-slate-700 shrink-0 animate-pulse" />
                                <div className={`h-9 rounded-2xl bg-slate-200 dark:bg-slate-700 animate-pulse`} style={{ width: `${w}%` }} />
                            </div>
                        ))}
                    </div>
                ) : comments.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center py-12 gap-3">
                        <div className="h-14 w-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                            <MessageSquare className="h-7 w-7 text-slate-300 dark:text-slate-600" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">No messages yet</p>
                            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                                {isAdmin ? 'Send the first update to the requester.' : 'IT Support will respond here.'}
                            </p>
                        </div>
                    </div>
                ) : (
                    comments.map((c: any, i: number) => {
                        const isMe = c.user_id === profile?.id;
                        const readCount = readCounts[id] || 0;
                        const isFirstUnread = !isAdmin && i === readCount && comments.length > readCount;
                        const prevIsMe = i > 0 && comments[i - 1].user_id === profile?.id;
                        const nextIsMe = i < comments.length - 1 && comments[i + 1].user_id === profile?.id;
                        const isGroupStart = i === 0 || comments[i - 1].user_id !== c.user_id;
                        const isGroupEnd = i === comments.length - 1 || comments[i + 1].user_id !== c.user_id;

                        return (
                            <div key={c.id}>
                                {isFirstUnread && (
                                    <div ref={unreadStartRef} className="flex items-center gap-2 my-4">
                                        <div className="h-px flex-1 bg-red-200 dark:bg-red-900/40" />
                                        <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest px-2 py-0.5 bg-red-50 dark:bg-red-950/30 rounded-full">
                                            New
                                        </span>
                                        <div className="h-px flex-1 bg-red-200 dark:bg-red-900/40" />
                                    </div>
                                )}

                                <div className={cn(
                                    'flex items-end gap-2',
                                    isMe && 'flex-row-reverse',
                                    isGroupEnd ? 'mb-3' : 'mb-0.5',
                                )}>
                                    {/* Avatar — only on group end */}
                                    {isGroupEnd ? (
                                        <Bubble letter={c.author_name.charAt(0).toUpperCase()} isMe={isMe} />
                                    ) : (
                                        <div className="w-7 shrink-0" />
                                    )}

                                    {/* Bubble */}
                                    <div className={cn('flex flex-col max-w-[80%]', isMe ? 'items-end' : 'items-start')}>
                                        {/* Sender name — only on group start and not me */}
                                        {!isMe && isGroupStart && (
                                            <span className={cn(
                                                'text-[10px] font-bold mb-1 ml-1 uppercase tracking-wider',
                                                c.is_internal ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
                                            )}>
                                                {c.author_name}
                                                {c.is_internal && <span className="ml-1 text-[9px] normal-case italic font-medium opacity-70">(internal)</span>}
                                            </span>
                                        )}

                                        <div className={cn(
                                            'relative group px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words',
                                            // Bubble shape
                                            isMe
                                                ? cn(
                                                    'bg-emerald-600 text-white',
                                                    isGroupStart ? 'rounded-t-2xl' : 'rounded-t-lg',
                                                    isGroupEnd ? 'rounded-bl-2xl rounded-br-sm' : 'rounded-b-lg',
                                                )
                                                : c.is_internal
                                                    ? cn(
                                                        'bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-100 border border-amber-200 dark:border-amber-800',
                                                        isGroupStart ? 'rounded-t-2xl' : 'rounded-t-lg',
                                                        isGroupEnd ? 'rounded-br-2xl rounded-bl-sm' : 'rounded-b-lg',
                                                    )
                                                    : cn(
                                                        'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-100 dark:border-slate-700',
                                                        isGroupStart ? 'rounded-t-2xl' : 'rounded-t-lg',
                                                        isGroupEnd ? 'rounded-br-2xl rounded-bl-sm' : 'rounded-b-lg',
                                                    ),
                                        )}>
                                            {c.is_internal && !isMe && (
                                                <Lock className="inline h-2.5 w-2.5 mr-1.5 mb-0.5 opacity-50" />
                                            )}
                                            {c.content}

                                            {/* Delete button for admin's own messages */}
                                            {isAdmin && c.user_id === profile?.id && (
                                                <button
                                                    onClick={() => handleDelete(c.id)}
                                                    className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-slate-900 dark:bg-slate-700 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md z-10"
                                                >
                                                    <Trash2 className="h-2.5 w-2.5" />
                                                </button>
                                            )}
                                        </div>

                                        {/* Timestamp — only on group end */}
                                        {isGroupEnd && (
                                            <span className={cn('text-[9px] text-slate-400 mt-1 px-1', isMe ? 'text-right' : 'text-left')}>
                                                {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* ── Input bar ── */}
            <div className="shrink-0 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-4 py-3 space-y-2">
                {isAdmin && (
                    <label className="flex items-center gap-2 cursor-pointer w-fit">
                        <div
                            onClick={() => setIsInternal(v => !v)}
                            className={cn(
                                'h-4 w-8 rounded-full relative transition-colors duration-200 shrink-0',
                                isInternal ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-600'
                            )}
                        >
                            <div className={cn(
                                'absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform duration-200',
                                isInternal ? 'translate-x-4' : 'translate-x-0.5'
                            )} />
                        </div>
                        <span className={cn(
                            'text-[10px] font-bold uppercase tracking-widest',
                            isInternal ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'
                        )}>
                            {isInternal ? '🔒 Internal IT Note' : 'Public Reply'}
                        </span>
                    </label>
                )}

                <form onSubmit={handleSend} className="flex items-end gap-2">
                    <div className="flex-1 relative">
                        <textarea
                            ref={inputRef}
                            placeholder={isAdmin
                                ? (isInternal ? 'Add an internal note (only visible to IT staff)…' : 'Send an update to the user…')
                                : 'Type a message… (Enter to send, Shift+Enter for new line)'
                            }
                            value={newComment}
                            onChange={e => setNewComment(e.target.value)}
                            onKeyDown={handleKeyDown}
                            rows={1}
                            className={cn(
                                'w-full resize-none rounded-xl border px-4 py-2.5 text-sm leading-relaxed',
                                'bg-slate-50 dark:bg-slate-900',
                                'text-foreground placeholder:text-slate-400',
                                'focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-400',
                                'transition-all duration-150',
                                isInternal
                                    ? 'border-amber-300 dark:border-amber-700 focus:ring-amber-400/40'
                                    : 'border-slate-200 dark:border-slate-700',
                                'max-h-32 overflow-y-auto',
                            )}
                            style={{ minHeight: 42 }}
                        />
                    </div>
                    <Button
                        type="submit"
                        disabled={isPosting || !newComment.trim()}
                        size="icon"
                        className={cn(
                            'h-[42px] w-[42px] shrink-0 rounded-xl shadow-sm transition-all',
                            isInternal
                                ? 'bg-amber-500 hover:bg-amber-600 text-white'
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        )}
                    >
                        {isPosting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                </form>
            </div>
        </div>
    );
}
