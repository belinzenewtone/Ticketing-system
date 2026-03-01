import { useState } from 'react';
import {
    View, Text, StyleSheet, FlatList,
    TouchableOpacity, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FAB, Modal, Portal, Button, Divider, TextInput as PaperInput } from 'react-native-paper';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react-native';
import { portalApi } from '@/api/client';
import { StatusBadge, PriorityBadge } from '@/components/StatusBadge';
import { EmptyState } from '@/components/EmptyState';
import { useAuthStore } from '@/store/useAuthStore';
import type { Ticket, TicketCategory } from '@/types/database';

const CATEGORIES: TicketCategory[] = ['email', 'account-login', 'password-reset', 'hardware', 'software', 'network-vpn', 'other'];

function TicketItem({ ticket }: { ticket: Ticket }) {
    return (
        <View style={styles.ticketCard}>
            <View style={styles.ticketHeader}>
                <Text style={styles.ticketNum}>#{ticket.number}</Text>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                    <StatusBadge status={ticket.status} />
                    <PriorityBadge priority={ticket.priority} />
                </View>
            </View>
            <Text style={styles.ticketSubject} numberOfLines={2}>{ticket.subject}</Text>
            <Text style={styles.ticketDate}>
                {new Date(ticket.ticket_date).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
            </Text>
            {ticket.resolution_notes ? (
                <View style={styles.resolutionBox}>
                    <Text style={styles.resolutionLabel}>Resolution</Text>
                    <Text style={styles.resolutionText} numberOfLines={3}>{ticket.resolution_notes}</Text>
                </View>
            ) : null}
        </View>
    );
}

export default function PortalScreen() {
    const queryClient = useQueryClient();
    const { user } = useAuthStore();
    const [createVisible, setCreateVisible] = useState(false);
    const [subject, setSubject] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState<TicketCategory>('other');

    const { data: tickets = [], isLoading, refetch, isRefetching } = useQuery({
        queryKey: ['portal-tickets'],
        queryFn: () => portalApi.myTickets().then(r => r.data as Ticket[]),
    });

    const submitMutation = useMutation({
        mutationFn: (data: { subject: string; description: string; category: TicketCategory }) =>
            portalApi.submit(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['portal-tickets'] });
            setCreateVisible(false);
            setSubject('');
            setDescription('');
            setCategory('other');
        },
    });

    const handleSubmit = () => {
        if (!subject.trim()) return;
        submitMutation.mutate({ subject: subject.trim(), description: description.trim(), category });
    };

    const open = tickets.filter(t => t.status === 'open' || t.status === 'in-progress').length;

    return (
        <SafeAreaView style={styles.root} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.greeting}>Hello, {user?.name?.split(' ')[0]} 👋</Text>
                    <Text style={styles.headerSub}>{open} ticket{open !== 1 ? 's' : ''} in progress</Text>
                </View>
            </View>

            {/* Stats bar */}
            <View style={styles.statsBar}>
                {[
                    { label: 'Total', value: tickets.length, color: '#6b7280' },
                    { label: 'Open', value: tickets.filter(t => t.status === 'open').length, color: '#1d4ed8' },
                    { label: 'In Progress', value: tickets.filter(t => t.status === 'in-progress').length, color: '#b45309' },
                    { label: 'Resolved', value: tickets.filter(t => t.status === 'resolved').length, color: '#059669' },
                ].map(s => (
                    <View key={s.label} style={styles.statItem}>
                        <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
                        <Text style={styles.statLabel}>{s.label}</Text>
                    </View>
                ))}
            </View>

            <Text style={styles.sectionTitle}>Your Tickets</Text>

            <FlatList
                data={tickets}
                keyExtractor={t => t.id}
                renderItem={({ item }) => <TicketItem ticket={item} />}
                contentContainerStyle={tickets.length === 0 ? { flex: 1 } : { paddingBottom: 100 }}
                ListEmptyComponent={
                    <EmptyState
                        title={isLoading ? 'Loading…' : 'No tickets yet'}
                        subtitle="Submit a new ticket and our IT team will assist you"
                    />
                }
                refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#059669" />}
            />

            <FAB
                icon={() => <Plus size={22} color="#ffffff" />}
                label="Submit Ticket"
                style={styles.fab}
                onPress={() => setCreateVisible(true)}
            />

            <Portal>
                <Modal visible={createVisible} onDismiss={() => setCreateVisible(false)} contentContainerStyle={styles.modal}>
                    <Text style={styles.modalTitle}>Submit a Ticket</Text>
                    <Divider style={{ marginBottom: 16 }} />

                    <PaperInput
                        label="Subject"
                        value={subject}
                        onChangeText={setSubject}
                        mode="outlined"
                        style={styles.formInput}
                        outlineColor="#d1d5db"
                        activeOutlineColor="#059669"
                        placeholder="Briefly describe your issue"
                    />
                    <PaperInput
                        label="Description (optional)"
                        value={description}
                        onChangeText={setDescription}
                        mode="outlined"
                        multiline
                        numberOfLines={4}
                        style={styles.formInput}
                        outlineColor="#d1d5db"
                        activeOutlineColor="#059669"
                        placeholder="Provide more detail…"
                    />

                    <Text style={styles.filterLabel}>Category</Text>
                    <View style={styles.chipRow}>
                        {CATEGORIES.map(c => (
                            <TouchableOpacity key={c} style={[styles.chip, category === c && styles.chipActive]} onPress={() => setCategory(c)}>
                                <Text style={[styles.chipText, category === c && styles.chipTextActive]}>{c}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <Button mode="contained" buttonColor="#059669" loading={submitMutation.isPending} onPress={handleSubmit} style={{ marginTop: 16 }}>
                        Submit Ticket
                    </Button>
                </Modal>
            </Portal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#f8fafc' },
    header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
    greeting: { fontSize: 24, fontWeight: '800', color: '#111827' },
    headerSub: { fontSize: 14, color: '#6b7280', marginTop: 2 },
    statsBar: { flexDirection: 'row', backgroundColor: '#fff', marginHorizontal: 16, borderRadius: 14, padding: 12, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 4, elevation: 2 },
    statItem: { flex: 1, alignItems: 'center' },
    statValue: { fontSize: 20, fontWeight: '700' },
    statLabel: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: '#374151', paddingHorizontal: 16, marginBottom: 8 },
    ticketCard: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginHorizontal: 16, marginVertical: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 2 },
    ticketHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    ticketNum: { fontSize: 12, fontWeight: '700', color: '#059669' },
    ticketSubject: { fontSize: 15, fontWeight: '600', color: '#111827', marginBottom: 4 },
    ticketDate: { fontSize: 12, color: '#9ca3af', marginBottom: 4 },
    resolutionBox: { backgroundColor: '#f0fdf4', borderRadius: 8, padding: 10, marginTop: 8 },
    resolutionLabel: { fontSize: 11, fontWeight: '600', color: '#059669', marginBottom: 4, textTransform: 'uppercase' },
    resolutionText: { fontSize: 13, color: '#374151', lineHeight: 19 },
    fab: { position: 'absolute', bottom: 24, right: 20, backgroundColor: '#059669' },
    modal: { backgroundColor: '#fff', margin: 20, borderRadius: 20, padding: 24 },
    modalTitle: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 12 },
    filterLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8, marginTop: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb' },
    chipActive: { backgroundColor: '#d1fae5', borderColor: '#059669' },
    chipText: { fontSize: 12, color: '#6b7280', textTransform: 'capitalize' },
    chipTextActive: { color: '#059669', fontWeight: '600' },
    formInput: { marginBottom: 10, backgroundColor: '#f9fafb' },
});
