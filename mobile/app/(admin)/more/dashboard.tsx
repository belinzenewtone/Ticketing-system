import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ArrowLeft, Ticket, CheckSquare, Monitor, TrendingUp } from 'lucide-react-native';
import { dashboardApi } from '@/api/client';

function MetricRow({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
    const pct = total > 0 ? Math.round((value / total) * 100) : 0;
    return (
        <View style={styles.metricRow}>
            <View style={styles.metricLabel}>
                <Text style={styles.metricName}>{label}</Text>
                <Text style={styles.metricCount}>{value}</Text>
            </View>
            <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: color }]} />
            </View>
        </View>
    );
}

export default function DashboardScreen() {
    const router = useRouter();
    const { data: stats, isLoading } = useQuery({
        queryKey: ['dashboard'],
        queryFn: () => dashboardApi.stats().then(r => r.data as any),
        staleTime: 60_000,
    });

    return (
        <SafeAreaView style={styles.root} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <ArrowLeft size={22} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.title}>Dashboard</Text>
            </View>

            {isLoading || !stats ? (
                <View style={styles.loading}><Text style={styles.loadingText}>Loading stats…</Text></View>
            ) : (
                <ScrollView contentContainerStyle={styles.scroll}>

                    {/* Tickets */}
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Ticket size={18} color="#059669" />
                            <Text style={styles.sectionTitle}>Tickets</Text>
                        </View>
                        <View style={styles.bigStatRow}>
                            <View style={styles.bigStat}><Text style={[styles.bigNum, { color: '#111827' }]}>{stats.tickets.total}</Text><Text style={styles.bigLabel}>Total</Text></View>
                            <View style={styles.bigStat}><Text style={[styles.bigNum, { color: '#1d4ed8' }]}>{stats.tickets.open}</Text><Text style={styles.bigLabel}>Open</Text></View>
                            <View style={styles.bigStat}><Text style={[styles.bigNum, { color: '#b45309' }]}>{stats.tickets.in_progress}</Text><Text style={styles.bigLabel}>In Progress</Text></View>
                            <View style={styles.bigStat}><Text style={[styles.bigNum, { color: '#059669' }]}>{stats.tickets.resolved}</Text><Text style={styles.bigLabel}>Resolved</Text></View>
                        </View>
                        <View style={styles.card}>
                            <MetricRow label="Open" value={stats.tickets.open} total={stats.tickets.total} color="#3b82f6" />
                            <MetricRow label="In Progress" value={stats.tickets.in_progress} total={stats.tickets.total} color="#f59e0b" />
                            <MetricRow label="Resolved" value={stats.tickets.resolved} total={stats.tickets.total} color="#10b981" />
                            <MetricRow label="Closed" value={stats.tickets.closed} total={stats.tickets.total} color="#6b7280" />
                        </View>
                        <View style={styles.row}>
                            <View style={[styles.highlightCard, { borderColor: '#fee2e2' }]}>
                                <Text style={[styles.highlightNum, { color: '#dc2626' }]}>{stats.tickets.critical}</Text>
                                <Text style={styles.highlightLabel}>Critical</Text>
                            </View>
                            <View style={[styles.highlightCard, { borderColor: '#d1fae5' }]}>
                                <Text style={[styles.highlightNum, { color: '#059669' }]}>{stats.tickets.today}</Text>
                                <Text style={styles.highlightLabel}>Today</Text>
                            </View>
                            <View style={[styles.highlightCard, { borderColor: '#dbeafe' }]}>
                                <Text style={[styles.highlightNum, { color: '#1d4ed8' }]}>{stats.tickets.this_week}</Text>
                                <Text style={styles.highlightLabel}>This Week</Text>
                            </View>
                        </View>
                    </View>

                    {/* Tasks */}
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <CheckSquare size={18} color="#b45309" />
                            <Text style={styles.sectionTitle}>Tasks</Text>
                        </View>
                        <View style={styles.bigStatRow}>
                            <View style={styles.bigStat}><Text style={[styles.bigNum, { color: '#111827' }]}>{stats.tasks.total}</Text><Text style={styles.bigLabel}>Total</Text></View>
                            <View style={styles.bigStat}><Text style={[styles.bigNum, { color: '#059669' }]}>{stats.tasks.completed}</Text><Text style={styles.bigLabel}>Done</Text></View>
                            <View style={styles.bigStat}><Text style={[styles.bigNum, { color: '#b45309' }]}>{stats.tasks.pending}</Text><Text style={styles.bigLabel}>Pending</Text></View>
                            <View style={styles.bigStat}><Text style={[styles.bigNum, { color: '#dc2626' }]}>{stats.tasks.urgent}</Text><Text style={styles.bigLabel}>Urgent</Text></View>
                        </View>
                    </View>

                    {/* Machines */}
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Monitor size={18} color="#0284c7" />
                            <Text style={styles.sectionTitle}>Machine Requests</Text>
                        </View>
                        <View style={styles.bigStatRow}>
                            <View style={styles.bigStat}><Text style={[styles.bigNum, { color: '#111827' }]}>{stats.machines.total}</Text><Text style={styles.bigLabel}>Total</Text></View>
                            <View style={styles.bigStat}><Text style={[styles.bigNum, { color: '#b45309' }]}>{stats.machines.pending}</Text><Text style={styles.bigLabel}>Pending</Text></View>
                            <View style={styles.bigStat}><Text style={[styles.bigNum, { color: '#059669' }]}>{stats.machines.approved}</Text><Text style={styles.bigLabel}>Approved</Text></View>
                            <View style={styles.bigStat}><Text style={[styles.bigNum, { color: '#6b7280' }]}>{stats.machines.fulfilled}</Text><Text style={styles.bigLabel}>Fulfilled</Text></View>
                        </View>
                    </View>

                </ScrollView>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#f8fafc' },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
    backBtn: { padding: 4, marginRight: 10 },
    title: { fontSize: 20, fontWeight: '700', color: '#111827' },
    loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    loadingText: { color: '#9ca3af' },
    scroll: { padding: 16, paddingTop: 4, paddingBottom: 32 },
    section: { marginBottom: 20 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
    bigStatRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
    bigStat: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 12, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
    bigNum: { fontSize: 22, fontWeight: '800' },
    bigLabel: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
    card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 1 },
    metricRow: { marginBottom: 12 },
    metricLabel: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    metricName: { fontSize: 13, color: '#374151' },
    metricCount: { fontSize: 13, fontWeight: '600', color: '#111827' },
    barTrack: { height: 6, backgroundColor: '#f3f4f6', borderRadius: 3, overflow: 'hidden' },
    barFill: { height: '100%', borderRadius: 3 },
    row: { flexDirection: 'row', gap: 10 },
    highlightCard: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2, elevation: 1 },
    highlightNum: { fontSize: 20, fontWeight: '800', marginBottom: 2 },
    highlightLabel: { fontSize: 11, color: '#9ca3af' },
});
