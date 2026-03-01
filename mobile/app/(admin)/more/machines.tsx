import { useState } from 'react';
import {
    View, Text, StyleSheet, FlatList,
    TouchableOpacity, RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FAB, Modal, Portal, Button, Divider, TextInput as PaperInput } from 'react-native-paper';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ArrowLeft, Plus, Monitor } from 'lucide-react-native';
import { machinesApi } from '@/api/client';
import { EmptyState } from '@/components/EmptyState';
import type { MachineRequest, MachineStatus, MachineReason, ImportanceLevel } from '@/types/database';

const STATUSES: MachineStatus[] = ['pending', 'approved', 'fulfilled', 'rejected'];
const REASONS: MachineReason[] = ['old-hardware', 'faulty', 'new-user'];
const IMPORTANCE: ImportanceLevel[] = ['urgent', 'important', 'neutral'];

const STATUS_COLOR: Record<MachineStatus, { bg: string; text: string }> = {
    pending: { bg: '#fef3c7', text: '#b45309' },
    approved: { bg: '#d1fae5', text: '#059669' },
    fulfilled: { bg: '#dbeafe', text: '#1d4ed8' },
    rejected: { bg: '#fee2e2', text: '#dc2626' },
};

function MachineCard({ item, onStatusChange }: { item: MachineRequest; onStatusChange: (id: string, status: MachineStatus) => void }) {
    const c = STATUS_COLOR[item.status];
    return (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <Text style={styles.cardNum}>#{item.number}</Text>
                <View style={[styles.badge, { backgroundColor: c.bg }]}>
                    <Text style={[styles.badgeText, { color: c.text }]}>{item.status}</Text>
                </View>
            </View>
            <Text style={styles.cardName}>{item.user_name}</Text>
            <Text style={styles.cardMeta}>{item.requester_name} · {item.work_email}</Text>
            <Text style={styles.cardReason}>Reason: {item.reason}</Text>

            {item.status === 'pending' && (
                <View style={styles.actionRow}>
                    <TouchableOpacity style={styles.approveBtn} onPress={() => onStatusChange(item.id, 'approved')}>
                        <Text style={styles.approveBtnText}>Approve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.rejectBtn} onPress={() => onStatusChange(item.id, 'rejected')}>
                        <Text style={styles.rejectBtnText}>Reject</Text>
                    </TouchableOpacity>
                </View>
            )}
            {item.status === 'approved' && (
                <TouchableOpacity style={styles.fulfillBtn} onPress={() => onStatusChange(item.id, 'fulfilled')}>
                    <Text style={styles.fulfillBtnText}>Mark Fulfilled</Text>
                </TouchableOpacity>
            )}
        </View>
    );
}

export default function MachinesScreen() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const [statusFilter, setStatusFilter] = useState<MachineStatus | 'all'>('all');
    const [createVisible, setCreateVisible] = useState(false);
    const [form, setForm] = useState({ requester_name: '', user_name: '', work_email: '', reason: 'faulty' as MachineReason, importance: 'neutral' as ImportanceLevel, notes: '' });

    const params: Record<string, string> = {};
    if (statusFilter !== 'all') params.status = statusFilter;

    const { data: machines = [], isLoading, refetch, isRefetching } = useQuery({
        queryKey: ['machines', params],
        queryFn: () => machinesApi.list(params).then(r => r.data as MachineRequest[]),
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, status }: { id: string; status: MachineStatus }) => machinesApi.update(id, { status }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['machines'] }),
    });

    const createMutation = useMutation({
        mutationFn: (data: typeof form) => machinesApi.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['machines'] });
            setCreateVisible(false);
            setForm({ requester_name: '', user_name: '', work_email: '', reason: 'faulty', importance: 'neutral', notes: '' });
        },
    });

    return (
        <SafeAreaView style={styles.root} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <ArrowLeft size={22} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.title}>Machine Requests</Text>
            </View>

            {/* Status filter chips */}
            <View style={styles.filterRow}>
                {(['all', ...STATUSES] as const).map(s => (
                    <TouchableOpacity key={s} style={[styles.chip, statusFilter === s && styles.chipActive]} onPress={() => setStatusFilter(s)}>
                        <Text style={[styles.chipText, statusFilter === s && styles.chipTextActive]}>{s}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <FlatList
                data={machines}
                keyExtractor={m => m.id}
                contentContainerStyle={machines.length === 0 ? { flex: 1 } : { paddingBottom: 100 }}
                refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#059669" />}
                ListEmptyComponent={
                    <EmptyState
                        title={isLoading ? 'Loading…' : 'No machine requests'}
                        subtitle="No requests match the current filter"
                        icon={<Monitor size={40} color="#9ca3af" />}
                    />
                }
                renderItem={({ item }) => (
                    <MachineCard item={item} onStatusChange={(id, status) => updateMutation.mutate({ id, status })} />
                )}
            />

            <FAB icon={() => <Plus size={22} color="#fff" />} style={styles.fab} onPress={() => setCreateVisible(true)} />

            <Portal>
                <Modal visible={createVisible} onDismiss={() => setCreateVisible(false)} contentContainerStyle={styles.modal}>
                    <Text style={styles.modalTitle}>New Machine Request</Text>
                    <Divider style={{ marginBottom: 16 }} />
                    <PaperInput label="Requester Name" value={form.requester_name} onChangeText={v => setForm(f => ({ ...f, requester_name: v }))} mode="outlined" style={styles.formInput} outlineColor="#d1d5db" activeOutlineColor="#059669" />
                    <PaperInput label="User Name" value={form.user_name} onChangeText={v => setForm(f => ({ ...f, user_name: v }))} mode="outlined" style={styles.formInput} outlineColor="#d1d5db" activeOutlineColor="#059669" />
                    <PaperInput label="Work Email" value={form.work_email} onChangeText={v => setForm(f => ({ ...f, work_email: v }))} mode="outlined" keyboardType="email-address" style={styles.formInput} outlineColor="#d1d5db" activeOutlineColor="#059669" />

                    <Text style={styles.pickerLabel}>Reason</Text>
                    <View style={styles.chipRow}>
                        {REASONS.map(r => <TouchableOpacity key={r} style={[styles.chip, form.reason === r && styles.chipActive]} onPress={() => setForm(f => ({ ...f, reason: r }))}><Text style={[styles.chipText, form.reason === r && styles.chipTextActive]}>{r}</Text></TouchableOpacity>)}
                    </View>

                    <Text style={styles.pickerLabel}>Importance</Text>
                    <View style={styles.chipRow}>
                        {IMPORTANCE.map(i => <TouchableOpacity key={i} style={[styles.chip, form.importance === i && styles.chipActive]} onPress={() => setForm(f => ({ ...f, importance: i }))}><Text style={[styles.chipText, form.importance === i && styles.chipTextActive]}>{i}</Text></TouchableOpacity>)}
                    </View>

                    <PaperInput label="Notes (optional)" value={form.notes} onChangeText={v => setForm(f => ({ ...f, notes: v }))} mode="outlined" multiline numberOfLines={2} style={styles.formInput} outlineColor="#d1d5db" activeOutlineColor="#059669" />

                    <Button mode="contained" buttonColor="#059669" loading={createMutation.isPending} onPress={() => createMutation.mutate(form)} style={{ marginTop: 8 }}>
                        Submit Request
                    </Button>
                </Modal>
            </Portal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#f8fafc' },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
    backBtn: { padding: 4, marginRight: 10 },
    title: { fontSize: 20, fontWeight: '700', color: '#111827' },
    filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 16, marginBottom: 10 },
    chip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb' },
    chipActive: { backgroundColor: '#d1fae5', borderColor: '#059669' },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
    chipText: { fontSize: 12, color: '#6b7280', textTransform: 'capitalize' },
    chipTextActive: { color: '#059669', fontWeight: '600' },
    card: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginHorizontal: 16, marginVertical: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 2 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    cardNum: { fontSize: 12, fontWeight: '700', color: '#0284c7' },
    badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
    badgeText: { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
    cardName: { fontSize: 15, fontWeight: '600', color: '#111827', marginBottom: 2 },
    cardMeta: { fontSize: 13, color: '#6b7280', marginBottom: 2 },
    cardReason: { fontSize: 13, color: '#9ca3af', textTransform: 'capitalize', marginBottom: 10 },
    actionRow: { flexDirection: 'row', gap: 10 },
    approveBtn: { flex: 1, backgroundColor: '#d1fae5', borderRadius: 8, padding: 8, alignItems: 'center' },
    approveBtnText: { color: '#059669', fontWeight: '600', fontSize: 13 },
    rejectBtn: { flex: 1, backgroundColor: '#fee2e2', borderRadius: 8, padding: 8, alignItems: 'center' },
    rejectBtnText: { color: '#dc2626', fontWeight: '600', fontSize: 13 },
    fulfillBtn: { backgroundColor: '#dbeafe', borderRadius: 8, padding: 8, alignItems: 'center' },
    fulfillBtnText: { color: '#1d4ed8', fontWeight: '600', fontSize: 13 },
    fab: { position: 'absolute', bottom: 24, right: 20, backgroundColor: '#059669' },
    modal: { backgroundColor: '#fff', margin: 20, borderRadius: 20, padding: 24 },
    modalTitle: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 12 },
    formInput: { marginBottom: 10, backgroundColor: '#f9fafb' },
    pickerLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
});
