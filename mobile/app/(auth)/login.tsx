import { useState } from 'react';
import {
    View, Text, StyleSheet, KeyboardAvoidingView,
    Platform, ScrollView, TouchableOpacity,
} from 'react-native';
import { TextInput, Button } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { Lock, Eye, EyeOff } from 'lucide-react-native';
import { useAuthStore } from '@/store/useAuthStore';
import { authApi } from '@/api/client';
import { StatusBar } from 'expo-status-bar';

export default function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const { setAuth } = useAuthStore();
    const router = useRouter();

    const handleLogin = async () => {
        setError('');

        if (!email.toLowerCase().endsWith('@jtl.co.ke')) {
            setError('Access denied. Only @jtl.co.ke accounts are allowed.');
            return;
        }

        if (!email || !password) {
            setError('Please enter your email and password.');
            return;
        }

        setLoading(true);
        try {
            const { data } = await authApi.login(email.trim().toLowerCase(), password);
            await setAuth(data.token, {
                id: data.user.id,
                email: data.user.email,
                name: data.user.name,
                role: data.user.role as any,
            });
            router.replace('/');
        } catch (e: any) {
            const msg = e?.response?.data?.error ?? 'Login failed. Please try again.';
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.root}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <StatusBar style="dark" />
            <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

                {/* Background blobs */}
                <View style={styles.blob1} />
                <View style={styles.blob2} />

                <View style={styles.card}>
                    {/* Icon */}
                    <View style={styles.iconContainer}>
                        <Lock size={28} color="#059669" />
                    </View>

                    <Text style={styles.title}>Welcome Back</Text>
                    <Text style={styles.subtitle}>Ticketing System — JTL</Text>

                    {error ? (
                        <View style={styles.errorBox}>
                            <Text style={styles.errorText}>{error}</Text>
                        </View>
                    ) : null}

                    <View style={styles.form}>
                        <TextInput
                            label="Email"
                            value={email}
                            onChangeText={setEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoComplete="email"
                            mode="outlined"
                            outlineColor="#d1d5db"
                            activeOutlineColor="#059669"
                            style={styles.input}
                            placeholder="name@jtl.co.ke"
                        />

                        <TextInput
                            label="Password"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry={!showPassword}
                            mode="outlined"
                            outlineColor="#d1d5db"
                            activeOutlineColor="#059669"
                            style={styles.input}
                            right={
                                <TextInput.Icon
                                    icon={() =>
                                        showPassword
                                            ? <EyeOff size={20} color="#9ca3af" />
                                            : <Eye size={20} color="#9ca3af" />
                                    }
                                    onPress={() => setShowPassword(v => !v)}
                                />
                            }
                        />

                        <Button
                            mode="contained"
                            onPress={handleLogin}
                            loading={loading}
                            disabled={loading}
                            buttonColor="#059669"
                            textColor="#ffffff"
                            style={styles.button}
                            contentStyle={styles.buttonContent}
                            labelStyle={styles.buttonLabel}
                        >
                            {loading ? 'Signing in…' : 'Sign In'}
                        </Button>
                    </View>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#f8fafc' },
    scroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
    blob1: {
        position: 'absolute', top: '20%', left: '-10%',
        width: 300, height: 300, borderRadius: 150,
        backgroundColor: 'rgba(16, 185, 129, 0.08)',
    },
    blob2: {
        position: 'absolute', bottom: '20%', right: '-10%',
        width: 300, height: 300, borderRadius: 150,
        backgroundColor: 'rgba(20, 184, 166, 0.08)',
    },
    card: {
        width: '100%', maxWidth: 400,
        backgroundColor: 'rgba(255,255,255,0.92)',
        borderRadius: 20, padding: 28,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12, shadowRadius: 16, elevation: 8,
        alignItems: 'center',
    },
    iconContainer: {
        width: 60, height: 60, borderRadius: 16,
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        alignItems: 'center', justifyContent: 'center',
        marginBottom: 16,
    },
    title: { fontSize: 24, fontWeight: '700', color: '#111827', marginBottom: 4 },
    subtitle: { fontSize: 14, color: '#6b7280', marginBottom: 24 },
    errorBox: {
        width: '100%', backgroundColor: 'rgba(239,68,68,0.1)',
        borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
        borderRadius: 10, padding: 12, marginBottom: 16,
    },
    errorText: { color: '#dc2626', fontSize: 13, textAlign: 'center' },
    form: { width: '100%', gap: 12 },
    input: { backgroundColor: '#f9fafb' },
    button: { borderRadius: 10, marginTop: 4 },
    buttonContent: { height: 48 },
    buttonLabel: { fontSize: 16, fontWeight: '600' },
});
