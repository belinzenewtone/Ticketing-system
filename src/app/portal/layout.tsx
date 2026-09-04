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
        <div className="min-h-screen bg-slate-50 dark:bg-[#0E1420] flex flex-col">
            {/* ── Top nav ── */}
            <header className="sticky top-0 z-40 w-full border-b border-slate-200/70 dark:border-slate-800/70 bg-white/90 dark:bg-[#0E1420]/90 backdrop-blur-md shadow-sm shadow-slate-200/50 dark:shadow-black/20">
                <div className="mx-auto max-w-6xl px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
                    {/* Brand */}
                    <Link href="/portal" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity shrink-0">
                        <div className="h-8 w-8 rounded-lg bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center">
                            <Ticket className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div className="leading-none">
                            <span className="text-sm font-bold text-foreground tracking-tight">IT Support</span>
                            <span className="block text-[9px] font-semibold uppercase tracking-widest text-slate-400">JTL Portal</span>
                        </div>
                    </Link>

                    {/* Right side */}
                    <div className="flex items-center gap-1 sm:gap-2">
                        {/* Name pill — desktop */}
                        {profile?.name && (
                            <div className="hidden sm:flex items-center gap-2 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-3 py-1.5 mr-1">
                                <div className="h-5 w-5 rounded-full bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase shrink-0">
                                    {profile.name.charAt(0)}
                                </div>
                                <span className="text-xs font-semibold text-foreground truncate max-w-[120px]">{profile.name}</span>
                            </div>
                        )}

                        <ThemeToggle />

                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 sm:px-3 text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-lg text-xs"
                            onClick={() => router.push('/portal/profile')}
                        >
                            <User className="h-4 w-4 sm:mr-1.5" />
                            <span className="hidden sm:inline">Profile</span>
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 sm:px-3 text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg text-xs"
                            onClick={handleLogout}
                        >
                            <LogOut className="h-4 w-4 sm:mr-1.5" />
                            <span className="hidden sm:inline">Sign out</span>
                        </Button>
                    </div>
                </div>
            </header>

            <main className="flex-1 mx-auto w-full max-w-6xl px-4 sm:px-6 py-8">
                {children}
            </main>
        </div>
    );
}
