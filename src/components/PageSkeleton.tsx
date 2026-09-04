import { Skeleton } from '@/components/ui/skeleton';

export function PageSkeleton() {
    return (
        <div className="space-y-6 animate-pulse">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div className="space-y-2">
                    <Skeleton className="h-8 w-64" />
                    <Skeleton className="h-4 w-48" />
                </div>
                <Skeleton className="h-9 w-36 rounded-lg" />
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="border rounded-xl p-4 space-y-3">
                        <div className="flex justify-between">
                            <Skeleton className="h-3 w-20" />
                            <Skeleton className="h-7 w-7 rounded-lg" />
                        </div>
                        <Skeleton className="h-8 w-12" />
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="flex gap-3">
                <Skeleton className="h-9 flex-1 rounded-lg" />
                <Skeleton className="h-9 w-48 rounded-lg" />
            </div>

            {/* Table */}
            <div className="border rounded-xl overflow-hidden">
                <div className="bg-slate-50 dark:bg-slate-900/50 px-4 py-3 flex gap-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <Skeleton key={i} className="h-3 w-16" />
                    ))}
                </div>
                {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="px-4 py-3.5 flex gap-4 border-t border-slate-100 dark:border-slate-800">
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-4 flex-1" />
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-6 w-20 rounded-full" />
                    </div>
                ))}
            </div>
        </div>
    );
}
