import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PaperProvider, MD3LightTheme } from 'react-native-paper';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useAuthStore } from '@/store/useAuthStore';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
    defaultOptions: {
        queries: { staleTime: 30_000, retry: 1 },
    },
});

const theme = {
    ...MD3LightTheme,
    colors: {
        ...MD3LightTheme.colors,
        primary: '#059669',       // emerald-600
        primaryContainer: '#d1fae5',
        secondary: '#0d9488',
        background: '#f8fafc',
        surface: '#ffffff',
    },
};

function AuthGate({ children }: { children: React.ReactNode }) {
    const { token, isLoaded, init } = useAuthStore();
    const segments = useSegments();
    const router = useRouter();

    useEffect(() => {
        init();
    }, [init]);

    useEffect(() => {
        if (!isLoaded) return;
        SplashScreen.hideAsync();

        const inAuth = segments[0] === '(auth)';
        if (!token && !inAuth) {
            router.replace('/(auth)/login');
        } else if (token && inAuth) {
            router.replace('/');
        }
    }, [token, isLoaded, segments]);

    return <>{children}</>;
}

export default function RootLayout() {
    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <QueryClientProvider client={queryClient}>
                <PaperProvider theme={theme}>
                    <AuthGate>
                        <Stack screenOptions={{ headerShown: false }}>
                            <Stack.Screen name="(auth)" />
                            <Stack.Screen name="(admin)" />
                            <Stack.Screen name="(portal)" />
                            <Stack.Screen name="index" />
                        </Stack>
                    </AuthGate>
                </PaperProvider>
            </QueryClientProvider>
        </GestureHandlerRootView>
    );
}
