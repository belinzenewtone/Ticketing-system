import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { LayoutDashboard, BookOpen, Monitor, ChevronRight } from 'lucide-react-native';
import { dashboardApi } from '@/api/client';

interface StatCardProps { label: string; value: number; color: string }
function StatCard({ label, value, color }: StatCardProps) {
    return (
        <View style={styles.statCard}>
            <Text style={[styles.statValue, { color }]}>{value}</Text>
            <Text style={styles.statLabel}>{label}</Text>
        </View>
    );
}

export default function MoreScreen() {
    const router = useRouter();

    const { data: stats } = useQuery({
        queryKey: ['dashboard'],
        queryFn: () => dashboardApi.stats().then(r => r.data as any),
        staleTime: 60_000,
    });

    const sections = [
        {
            label: 'Dashboard',
            subtitle: 'Overview & analytics',
            icon: <LayoutDashboard size={22} color="#059669" />,
            route: '/(admin)/more/dashboard' as const,
        },
        {
            label: 'Knowledge Base',
            subtitle: 'Articles & guides',
            icon: <BookOpen size={22} color="#7c3aed" />,
            route: '/(admin)/more/knowledge-base' as const,
        },
        {
            label: 'Machine Requests',
            subtitle: 'Hardware & equipment',
            icon: <Monitor size={22} color="#0284c7" />,
            route: '/(admin)/more/machines' as const,
        },
    ];

    return (
        <SafeAreaView style={styles.root} edges={['top']}>
            <Text style={styles.title}>More</Text>

            <ScrollView contentContainerStyle={styles.scroll}>
                {/* Quick stats */}
                {stats && (
                    <View style={styles.statsSection}>
                        <Text style={styles.sectionLabel}>Today at a glance</Text>
                        <View style={styles.statsRow}>
                            <StatCard label="New tickets" value={stats.tickets.today} color="#059669" />
                            <StatCard label="Critical" value={stats.tickets.critical} color="#dc2626" />
                            <StatCard label="Tasks pending" value={stats.tasks.pending} color="#b45309" />
                            <StatCard label="Machines" value={stats.machines.pending} color="#0284c7" />
                        </View>
                    </View>
                )}

                {/* Nav cards */}
                <View style={styles.navSection}>
                    {sections.map(s => (
                        <TouchableOpacity
                            key={s.label}
                            style={styles.navCard}
                            onPress={() => router.push(s.route)}
                            activeOpacity={0.75}
                        >
                            <View style={styles.navIcon}>{s.icon}</View>
                            <View style={styles.navText}>
                                <Text style={styles.navLabel}>{s.label}</Text>
                                <Text style={styles.navSubtitle}>{s.subtitle}</Text>
                            </View>
                            <ChevronRight size={18} color="#d1d5db" />
                        </TouchableOpacity>
                    ))}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#f8fafc' },
    title: { fontSize: 26, fontWeight: '800', color: '#111827', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 },
    scroll: { padding: 16, paddingTop: 0 },
    sectionLabel: { fontSize: 13, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
    statsSection: { marginBottom: 24 },
    statsRow: { flexDirection: 'row', gap: 10 },
    statCard: { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 14, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 1 },
    statValue: { fontSize: 22, fontWeight: '800', marginBottom: 2 },
    statLabel: { fontSize: 11, color: '#9ca3af', textAlign: 'center' },
    navSection: { gap: 10 },
    navCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 4, elevation: 2 },
    navIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center', marginRight: 14 },
    navText: { flex: 1 },
    navLabel: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 2 },
    navSubtitle: { fontSize: 13, color: '#9ca3af' },
});
