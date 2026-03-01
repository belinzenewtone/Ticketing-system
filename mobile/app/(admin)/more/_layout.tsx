import { Stack } from 'expo-router';

export default function MoreLayout() {
    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="dashboard" />
            <Stack.Screen name="knowledge-base" />
            <Stack.Screen name="machines" />
        </Stack>
    );
}
