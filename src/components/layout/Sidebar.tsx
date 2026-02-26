'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Mail, CheckSquare, Monitor, FileBarChart, LogOut, Menu, X, Ticket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/store/useAppStore';
import { signOut } from '@/services/auth';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/ThemeToggle';

const navItems = [
    { href: '/dashboard', label: 'Email', icon: Mail },
    { href: '/tasks', label: 'Tasks', icon: CheckSquare },
    { href: '/machines', label: 'Machines', icon: Monitor },
    { href: '/tickets', label: 'Ticketing', icon: Ticket },
    { href: '/reports', label: 'Reports', icon: FileBarChart },
];

export function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const { profile, sidebarOpen, toggleSidebar } = useAppStore();

    // Lock body scroll when sidebar is open on mobile
    useEffect(() => {
        if (sidebarOpen && window.innerWidth < 1024) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [sidebarOpen]);

    const handleLogout = async () => {
        await signOut();
        router.push('/login');
    };

    return (
        <>
            {/* Hamburger — only visible when sidebar is CLOSED on mobile */}
            {!sidebarOpen && (
                <Button
                    variant="ghost"
                    size="icon"
                    className="fixed top-4 left-4 z-50 lg:hidden text-foreground"
                    onClick={toggleSidebar}
                >
                    <Menu className="h-5 w-5" />
                </Button>
            )}

            {sidebarOpen && (
                <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={toggleSidebar} />
            )}

            <aside
                className={cn(
                    'fixed top-0 left-0 z-40 h-dvh w-64 bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 flex flex-col transition-transform duration-300',
                    'lg:translate-x-0',
                    sidebarOpen ? 'translate-x-0' : '-translate-x-full'
                )}
            >
                {/* Header with close button inside */}
                <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between shrink-0">
                    <div>
                        <h1 className="text-xl font-bold bg-gradient-to-r from-emerald-500 to-teal-400 bg-clip-text text-transparent">
                            Ticketing System
                        </h1>
                        <p className="text-xs text-slate-500 mt-1">JTL Internal System</p>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="lg:hidden text-foreground -mt-1 -mr-2 shrink-0"
                        onClick={toggleSidebar}
                    >
                        <X className="h-5 w-5" />
                    </Button>
                </div>

                <nav className="flex-1 min-h-0 overflow-y-auto p-4 space-y-1">
                    {navItems.map((item) => {
                        const isActive = pathname.startsWith(item.href);
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={() => { if (window.innerWidth < 1024) toggleSidebar(); }}
                                className={cn(
                                    'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200',
                                    isActive
                                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                                        : 'text-slate-600 dark:text-slate-400 hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800/50'
                                )}
                            >
                                <item.icon className="h-5 w-5" />
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-slate-200 dark:border-slate-800 shrink-0">
                    <div className="flex items-center justify-between mb-3 px-2">
                        {profile && (
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-foreground truncate">{profile.name}</p>
                                <p className="text-xs text-slate-500">{profile.role === 'ADMIN' ? 'Administrator' : 'IT Staff'}</p>
                            </div>
                        )}
                        <ThemeToggle />
                    </div>
                    <Button
                        variant="ghost"
                        className="w-full justify-start gap-3 text-red-500 hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
                        onClick={handleLogout}
                    >
                        <LogOut className="h-5 w-5" />
                        Logout
                    </Button>
                </div>
            </aside>
        </>
    );
}
