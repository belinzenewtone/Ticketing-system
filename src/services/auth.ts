import { signIn as nextAuthSignIn, signOut as nextAuthSignOut } from 'next-auth/react';

// Client-side sign in
export async function signIn(email: string, password: string) {
    const result = await nextAuthSignIn('credentials', {
        email,
        password,
        redirect: false,
    });

    if (result?.error) {
        throw new Error(result.error);
    }
    return result;
}

// Client-side sign out
export async function signOut() {
    await nextAuthSignOut({ redirect: true, callbackUrl: '/login' });
}
