'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { signIn, getCurrentProfile, signOut } from '@/services/auth';
import { Loader2, Lock } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const { setProfile } = useAppStore();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!email.toLowerCase().endsWith('@jtl.co.ke')) {
            setError('Access Denied. Only @jtl.co.ke email addresses are allowed.');
            return;
        }

        setLoading(true);

        try {
            await signIn(email, password);
            const profile = await getCurrentProfile();

            if (profile) {
                setProfile(profile);
            }

            // Route based on role
            if (profile?.role === 'USER') {
                router.push('/portal');
            } else {
                router.push('/tickets');
            }
            router.refresh();
        } catch (err: unknown) {
            // Secure error reporting (hide specifics from user)
            setError('Invalid email or password.');
            // Sign out if login fails to parse profile or route properly
            await signOut().catch(() => { });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
            {/* Background effects */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl" />
            </div>

            <Card className="relative w-full max-w-md bg-white/80 dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 backdrop-blur-xl shadow-2xl">
                <CardHeader className="text-center space-y-3 pb-2">
                    <div className="mx-auto w-14 h-14 bg-emerald-500/20 rounded-2xl flex items-center justify-center">
                        <Lock className="h-7 w-7 text-emerald-500" />
                    </div>
                    <CardTitle className="text-2xl text-foreground">Welcome Back</CardTitle>
                    <CardDescription className="text-slate-500 dark:text-slate-400">
                        Ticketing System — JTL
                    </CardDescription>
                </CardHeader>

                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/30 text-red-500 dark:text-red-400 rounded-lg p-3 text-sm animate-in fade-in">
                                {error}
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-slate-700 dark:text-slate-300">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="email@jtl.co.ke"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-foreground placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-emerald-500 focus:ring-emerald-500/20"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="password" className="text-slate-700 dark:text-slate-300">Password</Label>
                            <Input
                                id="password"
                                type="password"
                                placeholder="Enter your password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-foreground placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-emerald-500 focus:ring-emerald-500/20"
                            />
                        </div>

                        <Button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-11 font-medium mt-2"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Signing in...
                                </>
                            ) : (
                                'Sign In'
                            )}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
