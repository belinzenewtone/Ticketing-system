'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { FileBarChart, LogOut, Menu, X, Ticket, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/store/useAppStore';
import { signOut } from '@/services/auth';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/ThemeToggle';

const navItems = [
    { href: '/tickets', label: 'Ticketing System', icon: Ticket },
    { href: '/dashboard', label: 'Reports Dashboard', icon: FileBarChart },
];

export function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const { profile, sidebarOpen, toggleSidebar } = useAppStore();
    const [isLoggingOut, setIsLoggingOut] = useState(false);

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
        setIsLoggingOut(true);
        try {
            await signOut();
            router.push('/login');
        } catch (error) {
            setIsLoggingOut(false);
            console.error('Error signing out', error);
        }
    };

    if (isLoggingOut) {
        return (
            <div className="fixed inset-0 z-[100] bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Signing out...</p>
                </div>
            </div>
        );
    }

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
                    'fixed top-0 left-0 z-40 h-dvh w-56 bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 flex flex-col transition-transform duration-300',
                    'lg:translate-x-0',
                    sidebarOpen ? 'translate-x-0' : '-translate-x-full'
                )}
            >
                {/* Header with close button inside */}
                <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between shrink-0">
                    <Link href="/tickets" className="hover:opacity-80 transition-opacity">
                        <h1 className="text-lg font-bold bg-gradient-to-r from-emerald-500 to-teal-400 bg-clip-text text-transparent leading-tight">
                            Ticketing System
                        </h1>
                        <p className="text-[11px] text-slate-500 mt-1">JTL Internal System</p>
                    </Link>
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
                        const isActive = item.href === '/dashboard'
                            ? ['/dashboard', '/tasks', '/machines', '/reports'].includes(pathname)
                            : ['/tickets', '/knowledge-base'].includes(pathname);
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={() => { if (window.innerWidth < 1024) toggleSidebar(); }}
                                className={cn(
                                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                                    isActive
                                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                                        : 'text-slate-600 dark:text-slate-400 hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800/50'
                                )}
                            >
                                <item.icon className="h-4 w-4" />
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
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            className="flex-1 justify-center gap-2"
                            onClick={() => router.push('/dashboard/profile')}
                        >
                            <User className="h-4 w-4" />
                            Profile
                        </Button>
                        <Button
                            variant="ghost"
                            className="flex-1 justify-center gap-2 text-red-500 hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
                            onClick={handleLogout}
                        >
                            <LogOut className="h-4 w-4" />
                            Logout
                        </Button>
                    </div>
                </div>
            </aside>
        </>
    );
}
