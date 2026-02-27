'use client';

import { useEffect, useState } from 'react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { LogOut, Ticket, User } from 'lucide-react';
import { signOut } from '@/services/auth';
import { getCurrentProfile } from '@/services/auth-actions';
import Link from 'next/link';
import { useAppStore } from '@/store/useAppStore';
import { useRouter } from 'next/navigation';

export default function PortalLayout({ children }: { children: React.ReactNode }) {
    const { profile, setProfile } = useAppStore();
    const router = useRouter();
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    useEffect(() => {
        const loadProfile = async () => {
            if (!profile) {
                try {
                    const currentProfile = await getCurrentProfile();
                    if (currentProfile) {
                        setProfile(currentProfile);
                    } else {
                        router.push('/login');
                    }
                } catch (error) {
                    console.error('Failed to load profile', error);
                    router.push('/login');
                }
            }
        };
        loadProfile();
    }, [profile, setProfile, router]);

    const handleLogout = async () => {
        try {
            setIsLoggingOut(true);
            await signOut();
            setProfile(null);
            router.push('/login');
        } catch (error) {
            console.error('Error signing out:', error);
            setIsLoggingOut(false);
        }
    };

    if (isLoggingOut) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Signing out...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
            <header className="sticky top-0 z-40 w-full border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md">
                <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                    <Link href="/portal" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                        <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                            <Ticket className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold bg-gradient-to-r from-emerald-500 to-teal-400 bg-clip-text text-transparent leading-tight">
                                IT Support Portal
                            </h1>
                            <p className="text-[10px] text-slate-500 uppercase tracking-widest">JTL Internal</p>
                        </div>
                    </Link>

                    <div className="flex items-center gap-4">
                        <div className="hidden sm:block text-left">
                            <p className="text-sm font-medium text-foreground">{profile?.name || 'Employee'}</p>
                            <p className="text-xs text-slate-500">{profile?.email}</p>
                        </div>
                        <ThemeToggle />
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-slate-500 hover:text-emerald-600 dark:hover:bg-emerald-950/30"
                            onClick={() => router.push('/portal/profile')}
                        >
                            <User className="h-4 w-4 sm:mr-2" />
                            <span className="hidden sm:inline">Profile</span>
                        </Button>
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
