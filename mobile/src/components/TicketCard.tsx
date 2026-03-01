import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MessageSquare, Clock } from 'lucide-react-native';
import { StatusBadge, PriorityBadge } from './StatusBadge';
import type { Ticket } from '@/types/database';

interface Props {
    ticket: Ticket;
    onPress: () => void;
}

function formatDate(dateStr: string) {
    try {
        return new Date(dateStr).toLocaleDateString('en-KE', {
            day: 'numeric', month: 'short', year: 'numeric',
        });
    } catch { return dateStr; }
}

export function TicketCard({ ticket, onPress }: Props) {
    const isOverdue = ticket.due_date && new Date(ticket.due_date) < new Date()
        && ticket.status !== 'resolved' && ticket.status !== 'closed';

    return (
        <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
            <View style={styles.header}>
                <Text style={styles.number}>#{ticket.number}</Text>
                <View style={styles.badges}>
                    <StatusBadge status={ticket.status} />
                    <PriorityBadge priority={ticket.priority} />
                </View>
            </View>

            <Text style={styles.subject} numberOfLines={2}>{ticket.subject}</Text>
            <Text style={styles.employee}>{ticket.employee_name} · {ticket.department}</Text>

            <View style={styles.footer}>
                <View style={styles.footerLeft}>
                    <Clock size={12} color={isOverdue ? '#dc2626' : '#9ca3af'} />
                    <Text style={[styles.date, isOverdue && styles.overdue]}>
                        {formatDate(ticket.ticket_date)}
                    </Text>
                </View>
                {ticket.comment_count > 0 && (
                    <View style={styles.comments}>
                        <MessageSquare size={12} color="#9ca3af" />
                        <Text style={styles.commentCount}>{ticket.comment_count}</Text>
                    </View>
                )}
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#ffffff', borderRadius: 14,
        padding: 16, marginHorizontal: 16, marginVertical: 6,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.07, shadowRadius: 4, elevation: 2,
    },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    number: { fontSize: 12, fontWeight: '700', color: '#059669' },
    badges: { flexDirection: 'row', gap: 6 },
    subject: { fontSize: 15, fontWeight: '600', color: '#111827', marginBottom: 4, lineHeight: 21 },
    employee: { fontSize: 13, color: '#6b7280', marginBottom: 10 },
    footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    footerLeft: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    date: { fontSize: 12, color: '#9ca3af' },
    overdue: { color: '#dc2626', fontWeight: '600' },
    comments: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    commentCount: { fontSize: 12, color: '#9ca3af' },
});
