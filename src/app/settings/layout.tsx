import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { getAllLookupCategories } from '@/services/lookup';

export const dynamic = 'force-dynamic';

// Server Component — prefetches all 6 lookup categories server-side so the
// Settings page (6 ListEditor components each with their own useQuery) renders
// instantly without any loading states on first visit.
export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
    const queryClient = new QueryClient();

    const all = await getAllLookupCategories();
    for (const [category, values] of Object.entries(all)) {
        queryClient.setQueryData(['lookup', category], values);
    }

    return (
        <AppShell>
            <HydrationBoundary state={dehydrate(queryClient)}>
                {children}
            </HydrationBoundary>
        </AppShell>
    );
}
