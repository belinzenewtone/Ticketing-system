import { View, Text, StyleSheet } from 'react-native';
import { Inbox } from 'lucide-react-native';

interface Props {
    title: string;
    subtitle?: string;
    icon?: React.ReactNode;
}

export function EmptyState({ title, subtitle, icon }: Props) {
    return (
        <View style={styles.container}>
            <View style={styles.iconWrap}>
                {icon ?? <Inbox size={40} color="#9ca3af" />}
            </View>
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
    iconWrap: {
        width: 72, height: 72, borderRadius: 36,
        backgroundColor: '#f3f4f6',
        alignItems: 'center', justifyContent: 'center', marginBottom: 16,
    },
    title: { fontSize: 17, fontWeight: '600', color: '#374151', marginBottom: 6, textAlign: 'center' },
    subtitle: { fontSize: 14, color: '#9ca3af', textAlign: 'center', lineHeight: 20 },
});
