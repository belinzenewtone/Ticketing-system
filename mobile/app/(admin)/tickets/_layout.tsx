import { Stack } from 'expo-router';

// Stack navigator so tapping a ticket navigates from list → detail
export default function TicketsLayout() {
    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="[id]" />
        </Stack>
    );
}
