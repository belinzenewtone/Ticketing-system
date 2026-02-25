'use client';

import { useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { useAppStore } from '@/store/useAppStore';
import { getCurrentProfile } from '@/services/auth';

export function AppShell({ children }: { children: React.ReactNode }) {
    const { setProfile } = useAppStore();

    useEffect(() => {
        getCurrentProfile().then(setProfile).catch(console.error);
    }, [setProfile]);

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
            <Sidebar />
            <main className="lg:ml-64 min-h-screen">
                <div className="p-6 lg:p-8">{children}</div>
            </main>
        </div>
    );
}
