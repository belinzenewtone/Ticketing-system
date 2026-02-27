'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAppStore } from '@/store/useAppStore';
import { updateUserName, updateUserPassword } from '@/services/auth-actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, User, KeyRound } from 'lucide-react';

const profileSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
});

const passwordSchema = z.object({
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
});

type ProfileFormValues = z.infer<typeof profileSchema>;
type PasswordFormValues = z.infer<typeof passwordSchema>;

export default function ProfileSettings() {
    const { profile, setProfile } = useAppStore();
    const [nameLoading, setNameLoading] = useState(false);
    const [passwordLoading, setPasswordLoading] = useState(false);

    const nameForm = useForm<ProfileFormValues>({
        resolver: zodResolver(profileSchema),
        values: {
            name: profile?.name || '',
        },
    });

    const passwordForm = useForm<PasswordFormValues>({
        resolver: zodResolver(passwordSchema),
        defaultValues: { password: '', confirmPassword: '' }
    });

    const onNameSubmit = async (data: ProfileFormValues) => {
        if (!profile) return;
        setNameLoading(true);
        try {
            await updateUserName(data.name);
            setProfile({ ...profile, name: data.name });
            toast.success('Profile updated successfully');
        } catch (error: unknown) {
            toast.error((error as Error).message || 'Failed to update profile');
        } finally {
            setNameLoading(false);
        }
    };

    const onPasswordSubmit = async (data: PasswordFormValues) => {
        setPasswordLoading(true);
        try {
            await updateUserPassword(data.password);
            toast.success('Password updated successfully');
            passwordForm.reset();
        } catch (error: unknown) {
            toast.error((error as Error).message || 'Failed to update password');
        } finally {
            setPasswordLoading(false);
        }
    };
    if (!profile) {
        return (
            <div className="flex justify-center items-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
            </div>
        );
    }
    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Profile Settings</h2>
                <p className="text-muted-foreground">Manage your account credentials and personal information.</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <div className="flex h-full w-full items-center justify-center rounded-full bg-emerald-100 text-emerald-700 font-medium">
                                {profile.name ? profile.name.substring(0, 2).toUpperCase() : 'U'}
                            </div>
                            Personal Information
                        </CardTitle>
                        <CardDescription>Update your display name.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={nameForm.handleSubmit(onNameSubmit)} className="space-y-4">
                            <div className="space-y-2">
                                <Label>Email</Label>
                                <Input value={profile.email ?? ''} disabled className="bg-slate-50 dark:bg-slate-900/50" />
                                <p className="text-xs text-muted-foreground mr-1">Email cannot be changed directly.</p>
                            </div>
                            <div className="space-y-2">
                                <Label>Full Name</Label>
                                <Input {...nameForm.register('name')} placeholder="Your name" />
                                {nameForm.formState.errors.name && (
                                    <p className="text-xs text-red-500">{nameForm.formState.errors.name.message}</p>
                                )}
                            </div>
                            <Button type="submit" disabled={nameLoading} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
                                {nameLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                Save Changes
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <KeyRound className="w-5 h-5 text-emerald-500" />
                            Security
                        </CardTitle>
                        <CardDescription>Update your account password.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
                            <div className="space-y-2">
                                <Label>New Password</Label>
                                <Input type="password" {...passwordForm.register('password')} placeholder="Enter new password" />
                                {passwordForm.formState.errors.password && (
                                    <p className="text-xs text-red-500">{passwordForm.formState.errors.password.message}</p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label>Confirm Password</Label>
                                <Input type="password" {...passwordForm.register('confirmPassword')} placeholder="Confirm new password" />
                                {passwordForm.formState.errors.confirmPassword && (
                                    <p className="text-xs text-red-500">{passwordForm.formState.errors.confirmPassword.message}</p>
                                )}
                            </div>
                            <Button type="submit" disabled={passwordLoading} className="w-full bg-slate-900 border-none hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200">
                                {passwordLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                Update Password
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
