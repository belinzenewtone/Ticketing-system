import { Skeleton } from '@/components/ui/skeleton';
export default function Loading() {
    return (
        <div className="space-y-6 animate-pulse">
            <div className="space-y-2">
                <Skeleton className="h-8 w-40" />
                <Skeleton className="h-4 w-72" />
            </div>
            <div className="flex gap-6">
                <div className="w-52 space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-xl" />)}
                </div>
                <div className="flex-1 space-y-4">
                    {Array.from({ length: 2 }).map((_, i) => (
                        <div key={i} className="border rounded-xl p-5 space-y-4">
                            <Skeleton className="h-5 w-32" />
                            <div className="flex flex-wrap gap-2">
                                {Array.from({ length: 4 }).map((_, j) => <Skeleton key={j} className="h-7 w-20 rounded-full" />)}
                            </div>
                            <Skeleton className="h-8 w-full rounded-lg" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
