'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { signOut } from '@/services/auth';
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogAction,
    AlertDialogCancel,
} from '@/components/ui/alert-dialog';

// ─── Config ───────────────────────────────────────────────────────────────────
/** Minutes of inactivity before the warning dialog appears. */
const IDLE_MINUTES = 25;
/** Seconds the warning dialog counts down before auto-logout. */
const WARNING_SECONDS = 5 * 60; // 5 minutes

const IDLE_MS    = IDLE_MINUTES * 60 * 1000;
const WARNING_MS = WARNING_SECONDS * 1000;

// Activity events that reset the idle timer
const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
    'mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click',
];

function fmt(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0
        ? `${m}:${String(s).padStart(2, '0')}`
        : `${s}s`;
}

export function IdleTimeout() {
    const [showWarning, setShowWarning]   = useState(false);
    const [countdown, setCountdown]       = useState(WARNING_SECONDS);
    const idleTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
    const countdownRef    = useRef<ReturnType<typeof setInterval> | null>(null);
    const isWarningRef    = useRef(false); // stable ref so event handlers can read it

    const doLogout = useCallback(async () => {
        clearTimeout(idleTimerRef.current!);
        clearInterval(countdownRef.current!);
        await signOut();
    }, []);

    const stopCountdown = useCallback(() => {
        clearInterval(countdownRef.current!);
        countdownRef.current = null;
        setShowWarning(false);
        setCountdown(WARNING_SECONDS);
        isWarningRef.current = false;
    }, []);

    const startCountdown = useCallback(() => {
        isWarningRef.current = true;
        setShowWarning(true);
        setCountdown(WARNING_SECONDS);

        countdownRef.current = setInterval(() => {
            setCountdown((prev) => {
                if (prev <= 1) {
                    clearInterval(countdownRef.current!);
                    doLogout();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    }, [doLogout]);

    const resetIdleTimer = useCallback(() => {
        // If the warning is already visible, user activity dismisses it
        if (isWarningRef.current) {
            stopCountdown();
        }

        clearTimeout(idleTimerRef.current!);
        idleTimerRef.current = setTimeout(startCountdown, IDLE_MS);
    }, [startCountdown, stopCountdown]);

    useEffect(() => {
        // Start the idle timer on mount
        resetIdleTimer();

        // Attach activity listeners
        ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, resetIdleTimer, { passive: true }));

        return () => {
            ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, resetIdleTimer));
            clearTimeout(idleTimerRef.current!);
            clearInterval(countdownRef.current!);
        };
    }, [resetIdleTimer]);

    if (!showWarning) return null;

    return (
        <AlertDialog open>
            <AlertDialogContent className="sm:max-w-[400px]">
                <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                        <span className="text-amber-500">⚠️</span> Session Expiring Soon
                    </AlertDialogTitle>
                    <AlertDialogDescription className="space-y-2">
                        <span className="block">
                            You&apos;ve been inactive for {IDLE_MINUTES} minutes.
                            You will be automatically signed out in:
                        </span>
                        <span className="block text-center text-4xl font-bold tabular-nums text-foreground py-2">
                            {fmt(countdown)}
                        </span>
                        <span className="block text-center text-sm text-muted-foreground">
                            Any unsaved work will be preserved.
                        </span>
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={doLogout} className="text-red-500 hover:text-red-600">
                        Sign out now
                    </AlertDialogCancel>
                    <AlertDialogAction
                        onClick={stopCountdown}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                        Stay signed in
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
