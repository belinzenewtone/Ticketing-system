import { useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList,
    TextInput, TouchableOpacity, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FAB, Modal, Portal, Button, Divider, TextInput as PaperInput } from 'react-native-paper';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Search, SlidersHorizontal, X, Plus } from 'lucide-react-native';
import { ticketsApi } from '@/api/client';
import { TicketCard } from '@/components/TicketCard';
import { EmptyState } from '@/components/EmptyState';
import { useAppStore } from '@/store/useAppStore';
import type { Ticket, TicketStatus, TicketPriority, CreateTicketInput } from '@/types/database';

const STATUSES: TicketStatus[] = ['open', 'in-progress', 'resolved', 'closed'];
const PRIORITIES: TicketPriority[] = ['critical', 'high', 'medium', 'low'];

export default function TicketsScreen() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const { ticketStatus, ticketPriority, ticketSearch, setTicketStatus, setTicketPriority, setTicketSearch } = useAppStore();
    const [filterVisible, setFilterVisible] = useState(false);
    const [createVisible, setCreateVisible] = useState(false);

    // New ticket form
    const [form, setForm] = useState<Partial<CreateTicketInput>>({
        priority: 'medium', category: 'other', status: 'open',
    });

    const params: Record<string, string> = {};
    if (ticketStatus !== 'all') params.status = ticketStatus;
    if (ticketPriority !== 'all') params.priority = ticketPriority;
    if (ticketSearch) params.search = ticketSearch;

    const { data: tickets = [], isLoading, refetch, isRefetching } = useQuery({
        queryKey: ['tickets', params],
        queryFn: () => ticketsApi.list(params).then((r: { data: Ticket[] }) => r.data),
    });

    const createMutation = useMutation({
        mutationFn: (data: CreateTicketInput) => ticketsApi.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tickets'] });
            setCreateVisible(false);
            setForm({ priority: 'medium', category: 'other', status: 'open' });
        },
    });

    const handleCreate = () => {
        if (!form.employee_name || !form.subject || !form.category || !form.priority) return;
        const today = new Date().toISOString().split('T')[0];
        createMutation.mutate({ ...form, ticket_date: today } as CreateTicketInput);
    };

    const renderTicket = useCallback(({ item }: { item: Ticket }) => (
        <TicketCard ticket={item} onPress={() => router.push(`/(admin)/tickets/${item.id}`)} />
    ), [router]);

    return (
        <SafeAreaView style={styles.root} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Tickets</Text>
                <View style={styles.headerRight}>
                    {(ticketStatus !== 'all' || ticketPriority !== 'all') && (
                        <View style={styles.filterDot} />
                    )}
                    <TouchableOpacity onPress={() => setFilterVisible(true)} style={styles.iconBtn}>
                        <SlidersHorizontal size={20} color="#6b7280" />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Search */}
            <View style={styles.searchRow}>
                <Search size={16} color="#9ca3af" style={styles.searchIcon} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search tickets…"
                    placeholderTextColor="#9ca3af"
                    value={ticketSearch}
                    onChangeText={setTicketSearch}
                />
                {ticketSearch ? (
                    <TouchableOpacity onPress={() => setTicketSearch('')}>
                        <X size={16} color="#9ca3af" />
                    </TouchableOpacity>
                ) : null}
            </View>

            {/* Stats row */}
            <View style={styles.statsRow}>
                <Text style={styles.statsText}>{tickets.length} ticket{tickets.length !== 1 ? 's' : ''}</Text>
                <Text style={styles.statsOpen}>{tickets.filter((t: Ticket) => t.status === 'open').length} open</Text>
            </View>

            <FlatList
                data={tickets}
                keyExtractor={(t: Ticket) => t.id}
                renderItem={renderTicket}
                contentContainerStyle={tickets.length === 0 ? { flex: 1 } : { paddingBottom: 100 }}
                ListEmptyComponent={
                    <EmptyState
                        title={isLoading ? 'Loading tickets…' : 'No tickets found'}
                        subtitle={isLoading ? '' : 'Create a new ticket to get started'}
                    />
                }
                refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#059669" />}
            />

            <FAB
                icon={() => <Plus size={22} color="#ffffff" />}
                style={styles.fab}
                onPress={() => setCreateVisible(true)}
            />

            {/* Filter Modal */}
            <Portal>
                <Modal visible={filterVisible} onDismiss={() => setFilterVisible(false)} contentContainerStyle={styles.modal}>
                    <Text style={styles.modalTitle}>Filter Tickets</Text>
                    <Divider style={{ marginBottom: 16 }} />

                    <Text style={styles.filterLabel}>Status</Text>
                    <View style={styles.chipRow}>
                        {(['all', ...STATUSES] as const).map(s => (
                            <TouchableOpacity
                                key={s}
                                style={[styles.chip, ticketStatus === s && styles.chipActive]}
                                onPress={() => setTicketStatus(s as any)}
                            >
                                <Text style={[styles.chipText, ticketStatus === s && styles.chipTextActive]}>
                                    {s === 'all' ? 'All' : s}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <Text style={styles.filterLabel}>Priority</Text>
                    <View style={styles.chipRow}>
                        {(['all', ...PRIORITIES] as const).map(p => (
                            <TouchableOpacity
                                key={p}
                                style={[styles.chip, ticketPriority === p && styles.chipActive]}
                                onPress={() => setTicketPriority(p as any)}
                            >
                                <Text style={[styles.chipText, ticketPriority === p && styles.chipTextActive]}>
                                    {p === 'all' ? 'All' : p}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <Button mode="contained" buttonColor="#059669" onPress={() => setFilterVisible(false)} style={{ marginTop: 8 }}>
                        Apply
                    </Button>
                </Modal>

                {/* Create Ticket Modal */}
                <Modal visible={createVisible} onDismiss={() => setCreateVisible(false)} contentContainerStyle={styles.modal}>
                    <Text style={styles.modalTitle}>New Ticket</Text>
                    <Divider style={{ marginBottom: 16 }} />

                    <PaperInput label="Employee Name" value={form.employee_name ?? ''} onChangeText={(v: string) => setForm(f => ({ ...f, employee_name: v }))} mode="outlined" style={styles.formInput} outlineColor="#d1d5db" activeOutlineColor="#059669" />
                    <PaperInput label="Department" value={form.department ?? ''} onChangeText={(v: string) => setForm(f => ({ ...f, department: v }))} mode="outlined" style={styles.formInput} outlineColor="#d1d5db" activeOutlineColor="#059669" />
                    <PaperInput label="Subject" value={form.subject ?? ''} onChangeText={(v: string) => setForm(f => ({ ...f, subject: v }))} mode="outlined" style={styles.formInput} outlineColor="#d1d5db" activeOutlineColor="#059669" />
                    <PaperInput label="Description" value={form.description ?? ''} onChangeText={(v: string) => setForm(f => ({ ...f, description: v }))} mode="outlined" multiline numberOfLines={3} style={styles.formInput} outlineColor="#d1d5db" activeOutlineColor="#059669" />

                    <Text style={styles.filterLabel}>Priority</Text>
                    <View style={styles.chipRow}>
                        {PRIORITIES.map(p => (
                            <TouchableOpacity key={p} style={[styles.chip, form.priority === p && styles.chipActive]} onPress={() => setForm(f => ({ ...f, priority: p }))}>
                                <Text style={[styles.chipText, form.priority === p && styles.chipTextActive]}>{p}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <Button mode="contained" buttonColor="#059669" loading={createMutation.isPending} onPress={handleCreate} style={{ marginTop: 12 }}>
                        Create Ticket
                    </Button>
                </Modal>
            </Portal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#f8fafc' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
    headerTitle: { fontSize: 26, fontWeight: '800', color: '#111827' },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    filterDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#059669' },
    iconBtn: { padding: 8 },
    searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', marginHorizontal: 16, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
    searchIcon: { marginRight: 8 },
    searchInput: { flex: 1, fontSize: 15, color: '#111827' },
    statsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 8 },
    statsText: { fontSize: 13, color: '#6b7280' },
    statsOpen: { fontSize: 13, color: '#059669', fontWeight: '600' },
    fab: { position: 'absolute', bottom: 24, right: 20, backgroundColor: '#059669' },
    modal: { backgroundColor: '#fff', margin: 20, borderRadius: 20, padding: 24 },
    modalTitle: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 12 },
    filterLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8, marginTop: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb' },
    chipActive: { backgroundColor: '#d1fae5', borderColor: '#059669' },
    chipText: { fontSize: 13, color: '#6b7280', textTransform: 'capitalize' },
    chipTextActive: { color: '#059669', fontWeight: '600' },
    formInput: { marginBottom: 10, backgroundColor: '#f9fafb' },
});
