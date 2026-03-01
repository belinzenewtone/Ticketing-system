import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Checkbox } from 'react-native-paper';
import { Trash2 } from 'lucide-react-native';
import { ImportanceBadge } from './StatusBadge';
import type { Task } from '@/types/database';

interface Props {
    task: Task;
    onToggle: () => void;
    onDelete: () => void;
}

export function TaskCard({ task, onToggle, onDelete }: Props) {
    return (
        <View style={[styles.card, task.completed && styles.completedCard]}>
            <Checkbox.Android
                status={task.completed ? 'checked' : 'unchecked'}
                onPress={onToggle}
                color="#059669"
            />
            <View style={styles.content}>
                <Text style={[styles.text, task.completed && styles.completedText]} numberOfLines={2}>
                    {task.text}
                </Text>
                <View style={styles.meta}>
                    <ImportanceBadge importance={task.importance} />
                    {task.date ? <Text style={styles.date}>{task.date}</Text> : null}
                </View>
            </View>
            <TouchableOpacity onPress={onDelete} style={styles.deleteBtn} hitSlop={8}>
                <Trash2 size={16} color="#d1d5db" />
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#ffffff', borderRadius: 14,
        paddingVertical: 12, paddingRight: 12,
        marginHorizontal: 16, marginVertical: 5,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06, shadowRadius: 3, elevation: 2,
    },
    completedCard: { opacity: 0.55 },
    content: { flex: 1, marginLeft: 4 },
    text: { fontSize: 15, color: '#111827', marginBottom: 6, lineHeight: 21 },
    completedText: { textDecorationLine: 'line-through', color: '#9ca3af' },
    meta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    date: { fontSize: 12, color: '#9ca3af' },
    deleteBtn: { padding: 4 },
});
