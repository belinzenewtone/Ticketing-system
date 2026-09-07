'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
    FileBarChart, LogOut, Menu, X, Ticket, User, Package,
    ClipboardList, Settings2, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/store/useAppStore';
import { signOut } from '@/services/auth';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/ThemeToggle';

const navItems = [
    { href: '/tickets',     label: 'Ticketing System',     icon: Ticket,        adminOnly: false },
    { href: '/dashboard',   label: 'Reports Dashboard',    icon: FileBarChart,  adminOnly: false },
    { href: '/inventory',   label: 'Inventory Management', icon: Package,       adminOnly: false },
    { href: '/procurement', label: 'Procurement',          icon: ClipboardList, adminOnly: true  },
    { href: '/settings',    label: 'Edit Lists',           icon: Settings2,     adminOnly: true  },
];

export function Sidebar() {
    const pathname  = usePathname();
    const router    = useRouter();
    const { profile, sidebarOpen, toggleSidebar, sidebarCollapsed, toggleSidebarCollapsed, setSidebarCollapsed } = useAppStore();
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    // Restore collapsed state from localStorage on mount
    useEffect(() => {
        try {
            const stored = localStorage.getItem('sidebar-collapsed');
            if (stored !== null) setSidebarCollapsed(stored === 'true');
        } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Lock body scroll when mobile sidebar is open
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
        } catch {
            setIsLoggingOut(false);
        }
    };

    if (isLoggingOut) {
        return (
            <div className="fixed inset-0 z-[100] bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Signing out...</p>
                </div>
            </div>
        );
    }

    const isActive = (href: string) =>
        href === '/dashboard'   ? ['/dashboard', '/tasks', '/reports'].includes(pathname) :
        href === '/inventory'   ? pathname.startsWith('/inventory') :
        href === '/procurement' ? pathname.startsWith('/procurement') :
        href === '/settings'    ? pathname.startsWith('/settings') :
        ['/tickets', '/knowledge-base'].some(p => pathname.startsWith(p));

    const visibleItems = navItems.filter(item => !item.adminOnly || profile?.role === 'ADMIN');

    return (
        <>
            {/* Mobile hamburger — only when sidebar is closed */}
            {!sidebarOpen && (
                <Button
                    variant="ghost"
                    size="icon"
                    className="fixed top-3 left-4 z-50 lg:hidden text-foreground bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm border border-slate-200 dark:border-slate-800 shadow-sm"
                    onClick={toggleSidebar}
                >
                    <Menu className="h-5 w-5" />
                </Button>
            )}

            {/* Mobile backdrop */}
            {sidebarOpen && (
                <div className="fixed inset-0 bg-black/60 z-30 lg:hidden backdrop-blur-sm" onClick={toggleSidebar} />
            )}

            {/* ── Collapse toggle tab — floats on right edge, desktop only ── */}
            <button
                onClick={toggleSidebarCollapsed}
                title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                className={cn(
                    'hidden lg:flex fixed top-7 z-50 items-center justify-center',
                    'w-5 h-10 rounded-r-lg',
                    'bg-white dark:bg-slate-900 border border-l-0 border-slate-200 dark:border-slate-700',
                    'text-slate-400 hover:text-emerald-500 hover:border-emerald-400 dark:hover:border-emerald-500',
                    'shadow-sm transition-all duration-300',
                    sidebarCollapsed ? 'left-[72px]' : 'left-64',
                )}
            >
                {sidebarCollapsed
                    ? <ChevronRight className="h-3.5 w-3.5" />
                    : <ChevronLeft className="h-3.5 w-3.5" />
                }
            </button>

            {/* ── Sidebar ───────────────────────────────────────────────── */}
            <aside className={cn(
                'fixed top-0 left-0 z-40 h-full bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 flex flex-col shadow-xl lg:shadow-none',
                'transition-[width,transform] duration-300 ease-in-out',
                // Desktop: animate width
                sidebarCollapsed ? 'lg:w-[72px]' : 'lg:w-64',
                // Mobile: slide in/out
                'lg:translate-x-0',
                sidebarOpen ? 'translate-x-0 w-64' : '-translate-x-full w-64',
            )}>

                {/* ── Header ── */}
                <div className={cn(
                    'border-b border-slate-200 dark:border-slate-800 flex items-center shrink-0 transition-all duration-300',
                    sidebarCollapsed ? 'p-3 justify-center' : 'p-5 justify-between'
                )}>
                    {!sidebarCollapsed && (
                        <Link href="/tickets" className="hover:opacity-80 transition-opacity min-w-0">
                            <h1 className="text-lg font-bold bg-gradient-to-r from-emerald-500 to-teal-400 bg-clip-text text-transparent leading-tight truncate">
                                Ticketing System
                            </h1>
                            <p className="text-[11px] text-slate-500 mt-0.5">JTL Internal System</p>
                        </Link>
                    )}
                    {sidebarCollapsed && (
                        <Link href="/tickets" className="text-emerald-500 hover:opacity-80 transition-opacity">
                            <Ticket className="h-6 w-6" />
                        </Link>
                    )}
                    {/* Mobile close */}
                    {!sidebarCollapsed && (
                        <Button variant="ghost" size="icon" className="lg:hidden shrink-0" onClick={toggleSidebar}>
                            <X className="h-5 w-5" />
                        </Button>
                    )}
                </div>

                {/* ── Nav ── */}
                <nav className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-3 space-y-1">
                    {visibleItems.map(item => {
                        const active = isActive(item.href);
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                title={sidebarCollapsed ? item.label : undefined}
                                onClick={() => { if (window.innerWidth < 1024) toggleSidebar(); }}
                                className={cn(
                                    'flex rounded-xl font-medium transition-all duration-200 group relative',
                                    sidebarCollapsed
                                        ? 'flex-col items-center justify-center gap-0.5 px-1 py-2.5 text-[10px]'
                                        : 'flex-row items-center gap-3 px-4 py-3 text-sm',
                                    active
                                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/25'
                                        : 'text-slate-600 dark:text-slate-400 hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800/50'
                                )}
                            >
                                <item.icon className="h-5 w-5 shrink-0" />
                                {sidebarCollapsed ? (
                                    /* short label below icon when collapsed */
                                    <span className="w-full text-center leading-tight truncate font-medium" style={{ maxWidth: 60 }}>
                                        {item.label.split(' ')[0]}
                                    </span>
                                ) : (
                                    <span className="truncate min-w-0">{item.label}</span>
                                )}
                            </Link>
                        );
                    })}
                </nav>

                {/* ── Footer ── */}
                <div className={cn(
                    'border-t border-slate-200 dark:border-slate-800 shrink-0 bg-slate-50/50 dark:bg-slate-900/20 transition-all duration-300',
                    sidebarCollapsed ? 'p-2' : 'p-4'
                )}>
                    {!sidebarCollapsed && (
                        <>
                            <div className="flex items-center justify-between mb-3 px-1">
                                {profile && (
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-semibold text-foreground truncate">{profile.name}</p>
                                        <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                                            {profile.role === 'ADMIN' ? 'Administrator' : 'IT Staff'}
                                        </p>
                                    </div>
                                )}
                                <ThemeToggle />
                            </div>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" className="flex-1 justify-center gap-1.5 rounded-lg text-xs"
                                    onClick={() => router.push('/dashboard/profile')}>
                                    <User className="h-3.5 w-3.5 shrink-0" /> Profile
                                </Button>
                                <Button variant="ghost" size="sm"
                                    className="flex-1 justify-center gap-1.5 text-red-500 hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg text-xs"
                                    onClick={handleLogout}>
                                    <LogOut className="h-3.5 w-3.5 shrink-0" /> Logout
                                </Button>
                            </div>
                        </>
                    )}

                    {sidebarCollapsed && (
                        <div className="flex flex-col items-center gap-2">
                            <ThemeToggle />
                            <button title="Profile"
                                onClick={() => router.push('/dashboard/profile')}
                                className="p-2 rounded-lg text-slate-500 hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors">
                                <User className="h-4 w-4" />
                            </button>
                            <button title="Logout"
                                onClick={handleLogout}
                                className="p-2 rounded-lg text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors">
                                <LogOut className="h-4 w-4" />
                            </button>
                        </div>
                    )}

                </div>
            </aside>
        </>
    );
}
