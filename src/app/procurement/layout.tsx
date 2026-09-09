import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { getRequisitions } from '@/services/procurement';
import { getAllLookupCategories } from '@/services/lookup';

export const dynamic = 'force-dynamic';

// Server Component — runs on the server for every request.
// Prefetches requisitions + all lookup categories so the client
// finds data already in the React Query cache on first render:
// no loading spinners, no skeletons, instant display.
export default async function ProcurementLayout({ children }: { children: React.ReactNode }) {
    const queryClient = new QueryClient();

    await Promise.all([
        // Main list
        queryClient.prefetchQuery({
            queryKey: ['requisitions'],
            queryFn: getRequisitions,
        }),
        // Lookup dropdowns (supplier, type, etc.)
        getAllLookupCategories().then((all) => {
            for (const [category, values] of Object.entries(all)) {
                queryClient.setQueryData(['lookup', category], values);
            }
        }),
    ]);

    return (
        <AppShell>
            <HydrationBoundary state={dehydrate(queryClient)}>
                {children}
            </HydrationBoundary>
        </AppShell>
    );
}
