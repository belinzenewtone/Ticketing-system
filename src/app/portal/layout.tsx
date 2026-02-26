'use client';

import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { LogOut, Ticket, User } from 'lucide-react';
import { signOut } from '@/services/auth';
import Link from 'next/link';
import { useAppStore } from '@/store/useAppStore';
import { useRouter } from 'next/navigation';

export default function PortalLayout({ children }: { children: React.ReactNode }) {
    const { profile, setProfile } = useAppStore();
    const router = useRouter();

    const handleLogout = async () => {
        try {
            await signOut();
            setProfile(null);
            router.push('/login');
        } catch (error) {
            console.error('Error signing out:', error);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
            <header className="sticky top-0 z-40 w-full border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md">
                <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                            <Ticket className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold bg-gradient-to-r from-emerald-500 to-teal-400 bg-clip-text text-transparent leading-tight">
                                IT Support Portal
                            </h1>
                            <p className="text-[10px] text-slate-500 uppercase tracking-widest">JTL Internal</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="hidden sm:block text-right">
                            <p className="text-sm font-medium text-foreground">{profile?.name || 'Employee'}</p>
                            <p className="text-xs text-slate-500">{profile?.email}</p>
                        </div>
                        <ThemeToggle />
                        <Link href="/portal/profile">
                            <Button variant="ghost" size="sm" className="text-slate-500 hover:text-emerald-600 dark:hover:bg-emerald-950/30">
                                <User className="h-4 w-4 sm:mr-2" />
                                <span className="hidden sm:inline">Profile</span>
                            </Button>
                        </Link>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                            onClick={handleLogout}
                        >
                            <LogOut className="h-4 w-4 sm:mr-2" />
                            <span className="hidden sm:inline">Logout</span>
                        </Button>
                    </div>
                </div>
            </header>
            <main className="flex-1 container mx-auto px-4 py-8">
                {children}
            </main>
        </div>
    );
}
