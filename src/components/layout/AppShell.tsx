'use client';

import { useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { useAppStore } from '@/store/useAppStore';
import { getCurrentProfile } from '@/services/auth-actions';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Mail, CheckSquare, Monitor, FileBarChart, Ticket, BookOpen } from 'lucide-react';

const reportsNav = [
    { href: '/dashboard', label: 'Email', icon: Mail },
    { href: '/tasks', label: 'Tasks', icon: CheckSquare },
    { href: '/reports', label: 'Reports', icon: FileBarChart },
];

const ticketingNav = [
    { href: '/tickets', label: 'Tickets', icon: Ticket },
    { href: '/knowledge-base', label: 'Knowledge Base', icon: BookOpen },
];

export function AppShell({ children }: { children: React.ReactNode }) {
    const { setProfile } = useAppStore();
    const pathname = usePathname();

    useEffect(() => {
        getCurrentProfile().then(setProfile).catch(console.error);
    }, [setProfile]);

    const isReportsPage = ['/dashboard', '/tasks', '/reports'].includes(pathname);
    const isTicketingPage = ['/tickets', '/knowledge-base'].includes(pathname);
    const showTabs = isReportsPage || isTicketingPage;
    const currentNav = isReportsPage ? reportsNav : ticketingNav;

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
            <Sidebar />
            <main className="lg:ml-64 min-h-screen flex flex-col relative">
                {showTabs && (
                    <div className="sticky top-0 z-30 w-full border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md px-4 lg:px-6 py-2.5 flex gap-2 overflow-x-auto no-scrollbar shadow-sm pl-14 lg:pl-6">
                        <div className="flex gap-2 min-w-max mx-auto lg:mx-0">
                            {currentNav.map((item) => {
                                const isActive = pathname === item.href;
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={cn(
                                            'flex items-center gap-2 px-3.5 py-1.5 text-sm font-medium rounded-full transition-all whitespace-nowrap',
                                            isActive
                                                ? 'bg-emerald-600 text-white shadow-sm'
                                                : 'text-slate-600 dark:text-slate-400 hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800/50'
                                        )}
                                    >
                                        <item.icon className="h-4 w-4" />
                                        {item.label}
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                )}
                <div className={cn(
                    "flex-1 p-4 lg:p-8 w-full max-w-7xl mx-auto",
                    showTabs ? "pt-4" : "pt-16 lg:pt-8"
                )}>
                    {children}
                </div>
            </main>
        </div>
    );
}

