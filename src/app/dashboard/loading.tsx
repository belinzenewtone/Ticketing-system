import { Skeleton } from '@/components/ui/skeleton';
export default function Loading() {
    return (
        <div className="space-y-6 animate-pulse">
            <div className="flex flex-wrap gap-3">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-9 w-24 rounded-lg" />)}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="border rounded-xl p-4 space-y-3">
                        <Skeleton className="h-3 w-20" />
                        <Skeleton className="h-8 w-12" />
                    </div>
                ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 border rounded-xl p-4 h-64"><Skeleton className="h-full w-full" /></div>
                <div className="border rounded-xl p-4 h-64"><Skeleton className="h-full w-full" /></div>
            </div>
        </div>
    );
}
