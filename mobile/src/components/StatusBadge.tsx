import { View, Text, StyleSheet } from 'react-native';
import type { TicketStatus, TicketPriority, ImportanceLevel } from '@/types/database';

const STATUS_CONFIG: Record<TicketStatus, { label: string; bg: string; text: string }> = {
    'open': { label: 'Open', bg: '#dbeafe', text: '#1d4ed8' },
    'in-progress': { label: 'In Progress', bg: '#fef3c7', text: '#b45309' },
    'resolved': { label: 'Resolved', bg: '#d1fae5', text: '#065f46' },
    'closed': { label: 'Closed', bg: '#f3f4f6', text: '#6b7280' },
};

const PRIORITY_CONFIG: Record<TicketPriority, { label: string; bg: string; text: string }> = {
    'critical': { label: 'Critical', bg: '#fee2e2', text: '#dc2626' },
    'high': { label: 'High', bg: '#ffedd5', text: '#c2410c' },
    'medium': { label: 'Medium', bg: '#fef3c7', text: '#b45309' },
    'low': { label: 'Low', bg: '#f0fdf4', text: '#16a34a' },
};

const IMPORTANCE_CONFIG: Record<ImportanceLevel, { label: string; bg: string; text: string }> = {
    'urgent': { label: 'Urgent', bg: '#fee2e2', text: '#dc2626' },
    'important': { label: 'Important', bg: '#fef3c7', text: '#b45309' },
    'neutral': { label: 'Neutral', bg: '#f3f4f6', text: '#6b7280' },
};

export function StatusBadge({ status }: { status: TicketStatus }) {
    const c = STATUS_CONFIG[status] ?? STATUS_CONFIG['open'];
    return (
        <View style={[styles.badge, { backgroundColor: c.bg }]}>
            <Text style={[styles.text, { color: c.text }]}>{c.label}</Text>
        </View>
    );
}

export function PriorityBadge({ priority }: { priority: TicketPriority }) {
    const c = PRIORITY_CONFIG[priority] ?? PRIORITY_CONFIG['medium'];
    return (
        <View style={[styles.badge, { backgroundColor: c.bg }]}>
            <Text style={[styles.text, { color: c.text }]}>{c.label}</Text>
        </View>
    );
}

export function ImportanceBadge({ importance }: { importance: ImportanceLevel }) {
    const c = IMPORTANCE_CONFIG[importance] ?? IMPORTANCE_CONFIG['neutral'];
    return (
        <View style={[styles.badge, { backgroundColor: c.bg }]}>
            <Text style={[styles.text, { color: c.text }]}>{c.label}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    badge: {
        paddingHorizontal: 8, paddingVertical: 3,
        borderRadius: 99, alignSelf: 'flex-start',
    },
    text: { fontSize: 11, fontWeight: '600' },
});
