'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAppStore } from '@/store/useAppStore';
import { updateUserName, updateUserPassword } from '@/services/auth-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, KeyRound, Mail, User, ShieldCheck, CircleCheckBig } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PageTransition } from '@/components/PageTransition';

const profileSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
});

const passwordSchema = z.object({
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string()
}).refine(d => d.password === d.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
});

type ProfileFormValues = z.infer<typeof profileSchema>;
type PasswordFormValues = z.infer<typeof passwordSchema>;

function AvatarInitials({ name }: { name?: string | null }) {
    const letters = (name || 'U')
        .split(' ').filter(Boolean).slice(0, 2)
        .map(w => w[0].toUpperCase()).join('');
    return <>{letters}</>;
}

export default function ProfileSettings() {
    const { profile, setProfile } = useAppStore();
    const [nameLoading, setNameLoading] = useState(false);
    const [pwLoading, setPwLoading] = useState(false);
    const [nameSaved, setNameSaved] = useState(false);
    const [pwSaved, setPwSaved] = useState(false);

    const nameForm = useForm<ProfileFormValues>({
        resolver: zodResolver(profileSchema),
        values: { name: profile?.name || '' },
    });

    const pwForm = useForm<PasswordFormValues>({
        resolver: zodResolver(passwordSchema),
        defaultValues: { password: '', confirmPassword: '' },
    });

    const onNameSubmit = async (data: ProfileFormValues) => {
        if (!profile) return;
        setNameLoading(true);
        setNameSaved(false);
        try {
            await updateUserName(data.name);
            setProfile({ ...profile, name: data.name });
            toast.success('Name updated');
            setNameSaved(true);
            setTimeout(() => setNameSaved(false), 3000);
        } catch (e: unknown) {
            toast.error((e as Error).message || 'Failed to update name');
        } finally {
            setNameLoading(false);
        }
    };

    const onPwSubmit = async (data: PasswordFormValues) => {
        setPwLoading(true);
        setPwSaved(false);
        try {
            await updateUserPassword(data.password);
            toast.success('Password updated');
            pwForm.reset();
            setPwSaved(true);
            setTimeout(() => setPwSaved(false), 3000);
        } catch (e: unknown) {
            toast.error((e as Error).message || 'Failed to update password');
        } finally {
            setPwLoading(false);
        }
    };

    if (!profile) {
        return (
            <div className="flex items-center justify-center py-32">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
            </div>
        );
    }

    return (
        <PageTransition>
        <div className="max-w-2xl space-y-8 pb-16">

            {/* ── Identity hero ───────────────────────────── */}
            <div className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                {/* Gradient stripe */}
                <div className="h-24 bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800" />

                <div className="px-6 pb-6">
                    {/* Avatar — overlapping the stripe */}
                    <div className="relative -mt-12 mb-4">
                        <div className="h-20 w-20 rounded-2xl border-4 border-white dark:border-slate-900 bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg select-none">
                            <AvatarInitials name={profile.name} />
                        </div>
                    </div>

                    <div>
                        <h1 className="text-xl font-bold text-foreground tracking-tight">{profile.name || 'No name set'}</h1>
                        <p className="text-sm text-slate-500 mt-0.5">{profile.email}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/30 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                                <ShieldCheck className="h-3.5 w-3.5" />
                                {profile.role === 'ADMIN' ? 'Administrator' : 'IT Staff'}
                            </span>
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1 text-xs font-medium text-slate-500">
                                <Mail className="h-3 w-3" />
                                {profile.email}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Display name ────────────────────────────── */}
            <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
                        <User className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                        <h2 className="text-sm font-bold text-foreground">Personal Information</h2>
                        <p className="text-xs text-slate-500">Update your display name</p>
                    </div>
                </div>
                <form onSubmit={nameForm.handleSubmit(onNameSubmit)} className="px-6 py-5 space-y-4">
                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Email</Label>
                        <div className="flex items-center gap-2.5 h-10 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3">
                            <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <span className="text-sm text-slate-400 truncate">{profile.email}</span>
                        </div>
                        <p className="text-[11px] text-slate-400">Email address cannot be changed.</p>
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider" htmlFor="display-name">
                            Display Name
                        </Label>
                        <Input
                            id="display-name"
                            placeholder="Your full name"
                            {...nameForm.register('name')}
                            className="h-10"
                        />
                        {nameForm.formState.errors.name && (
                            <p className="text-xs text-red-500">{nameForm.formState.errors.name.message}</p>
                        )}
                    </div>

                    <div className="flex items-center justify-between pt-1">
                        {nameSaved && (
                            <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                                <CircleCheckBig className="h-3.5 w-3.5" /> Saved
                            </span>
                        )}
                        <Button
                            type="submit"
                            disabled={nameLoading}
                            className={cn('ml-auto bg-emerald-600 hover:bg-emerald-700 text-white h-9 px-5 text-sm font-semibold')}
                        >
                            {nameLoading && <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />}
                            Save Changes
                        </Button>
                    </div>
                </form>
            </section>

            {/* ── Password ────────────────────────────────── */}
            <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                        <KeyRound className="h-4 w-4 text-slate-500" />
                    </div>
                    <div>
                        <h2 className="text-sm font-bold text-foreground">Security</h2>
                        <p className="text-xs text-slate-500">Change your account password</p>
                    </div>
                </div>
                <form onSubmit={pwForm.handleSubmit(onPwSubmit)} className="px-6 py-5 space-y-4">
                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider" htmlFor="new-password">
                            New Password
                        </Label>
                        <Input
                            id="new-password"
                            type="password"
                            placeholder="Minimum 6 characters"
                            {...pwForm.register('password')}
                            className="h-10"
                        />
                        {pwForm.formState.errors.password && (
                            <p className="text-xs text-red-500">{pwForm.formState.errors.password.message}</p>
                        )}
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider" htmlFor="confirm-password">
                            Confirm Password
                        </Label>
                        <Input
                            id="confirm-password"
                            type="password"
                            placeholder="Re-enter new password"
                            {...pwForm.register('confirmPassword')}
                            className="h-10"
                        />
                        {pwForm.formState.errors.confirmPassword && (
                            <p className="text-xs text-red-500">{pwForm.formState.errors.confirmPassword.message}</p>
                        )}
                    </div>

                    <div className="flex items-center justify-between pt-1">
                        {pwSaved && (
                            <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                                <CircleCheckBig className="h-3.5 w-3.5" /> Password updated
                            </span>
                        )}
                        <Button
                            type="submit"
                            disabled={pwLoading}
                            className="ml-auto h-9 px-5 text-sm font-semibold bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white text-white"
                        >
                            {pwLoading && <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />}
                            Update Password
                        </Button>
                    </div>
                </form>
            </section>

        </div>
        </PageTransition>
    );
}
