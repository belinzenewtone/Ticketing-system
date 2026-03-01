import { Redirect } from 'expo-router';
import { useAuthStore } from '@/store/useAuthStore';
import { View, ActivityIndicator } from 'react-native';

export default function Index() {
    const { user, isLoaded } = useAuthStore();

    if (!isLoaded) {
        return (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator size="large" color="#059669" />
            </View>
        );
    }

    if (!user) return <Redirect href="/(auth)/login" />;
    if (user.role === 'USER') return <Redirect href="/(portal)/" />;
    return <Redirect href="/(admin)/tickets" />;
}
