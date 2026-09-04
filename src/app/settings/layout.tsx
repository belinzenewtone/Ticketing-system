import { AppShell } from '@/components/layout/AppShell';

export const dynamic = 'force-dynamic';

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
    return <AppShell>{children}</AppShell>;
}
