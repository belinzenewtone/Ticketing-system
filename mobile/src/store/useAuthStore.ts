import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import type { UserRole } from '@/types/database';

export interface AuthUser {
    id: string;
    email: string;
    name: string;
    role: UserRole;
}

interface AuthState {
    token: string | null;
    user: AuthUser | null;
    isLoaded: boolean;

    init: () => Promise<void>;
    setAuth: (token: string, user: AuthUser) => Promise<void>;
    clearAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
    token: null,
    user: null,
    isLoaded: false,

    init: async () => {
        try {
            const token = await SecureStore.getItemAsync('auth_token');
            const userStr = await SecureStore.getItemAsync('auth_user');
            if (token && userStr) {
                set({ token, user: JSON.parse(userStr), isLoaded: true });
            } else {
                set({ isLoaded: true });
            }
        } catch {
            set({ isLoaded: true });
        }
    },

    setAuth: async (token, user) => {
        await SecureStore.setItemAsync('auth_token', token);
        await SecureStore.setItemAsync('auth_user', JSON.stringify(user));
        set({ token, user });
    },

    clearAuth: async () => {
        await SecureStore.deleteItemAsync('auth_token');
        await SecureStore.deleteItemAsync('auth_user');
        set({ token: null, user: null });
    },
}));
