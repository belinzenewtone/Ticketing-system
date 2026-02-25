import { AppShell } from '@/components/layout/AppShell';

export const dynamic = 'force-dynamic';

export default function ReportsLayout({ children }: { children: React.ReactNode }) {
    return <AppShell>{children}</AppShell>;
}
