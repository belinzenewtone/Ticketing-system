'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Mail, CheckSquare, Monitor, FileBarChart, LogOut, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/store/useAppStore';
import { signOut } from '@/services/auth';
import { cn } from '@/lib/utils';

const navItems = [
    { href: '/dashboard', label: 'Email', icon: Mail },
    { href: '/tasks', label: 'Tasks', icon: CheckSquare },
    { href: '/machines', label: 'Machines', icon: Monitor },
    { href: '/reports', label: 'Reports', icon: FileBarChart },
];

export function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const { profile, sidebarOpen, toggleSidebar } = useAppStore();

    const handleLogout = async () => {
        await signOut();
        router.push('/login');
    };

    return (
        <>
            <Button
                variant="ghost"
                size="icon"
                className="fixed top-4 left-4 z-50 lg:hidden text-white"
                onClick={toggleSidebar}
            >
                {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>

            {sidebarOpen && (
                <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={toggleSidebar} />
            )}

            <aside
                className={cn(
                    'fixed top-0 left-0 z-40 h-screen w-64 bg-slate-950 border-r border-slate-800 flex flex-col transition-transform duration-300',
                    'lg:translate-x-0',
                    sidebarOpen ? 'translate-x-0' : '-translate-x-full'
                )}
            >
                <div className="p-6 border-b border-slate-800">
                    <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                        Ticketing System
                    </h1>
                    <p className="text-xs text-slate-500 mt-1">JTL Internal System</p>
                </div>

                <nav className="flex-1 p-4 space-y-1">
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
                                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                                        : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                                )}
                            >
                                <item.icon className="h-5 w-5" />
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-slate-800">
                    {profile && (
                        <div className="mb-3 px-4">
                            <p className="text-sm font-medium text-white truncate">{profile.name}</p>
                            <p className="text-xs text-slate-500">{profile.role === 'ADMIN' ? 'Administrator' : 'IT Staff'}</p>
                        </div>
                    )}
                    <Button
                        variant="ghost"
                        className="w-full justify-start gap-3 text-red-400 hover:text-red-300 hover:bg-red-950/30"
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
