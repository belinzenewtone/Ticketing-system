'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { ThemeProvider } from '@/components/ThemeProvider';

export function Providers({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        staleTime: 3 * 60 * 1000,   // 3 min — lookup values rarely change
                        gcTime: 15 * 60 * 1000,      // keep cache 15 min after unmount
                        retry: 1,
                        refetchOnWindowFocus: false,
                    },
                },
            })
    );

    return (
        <ThemeProvider>
            <QueryClientProvider client={queryClient}>
                {children}
                <Toaster richColors position="top-right" />
            </QueryClientProvider>
        </ThemeProvider>
    );
}
