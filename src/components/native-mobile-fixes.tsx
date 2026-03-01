'use client';

import { useEffect } from 'react';
import { SplashScreen } from '@capacitor/splash-screen';
import { Capacitor } from '@capacitor/core';

export function NativeMobileFixes() {
    useEffect(() => {
        const isNative = Capacitor.isNativePlatform();
        const isPWA =
            window.matchMedia('(display-mode: standalone)').matches ||
            (window.navigator as unknown as { standalone: boolean }).standalone === true;

        if (!isNative && !isPWA) return; // Regular web browser — do nothing

        // Mark as app mode so CSS can target it
        document.documentElement.classList.add('app-mode');

        if (isNative) {
            // Hide Capacitor's native splash once React is ready
            const timer = setTimeout(() => {
                SplashScreen.hide({ fadeOutDuration: 800 }).catch(err => {
                    console.warn('SplashScreen.hide failed', err);
                });
            }, 500);
            return () => clearTimeout(timer);
        }

        // PWA standalone mode — fix Android status bar overlap.
        // env(safe-area-inset-top) often returns 0 on Android for the status bar,
        // but window.screen.availTop gives the actual status bar height in px.
        const androidStatusBarHeight = (window.screen as unknown as { availTop?: number }).availTop ?? 0;
        if (androidStatusBarHeight > 0) {
            document.documentElement.style.setProperty(
                '--safe-area-top',
                `${androidStatusBarHeight}px`
            );
        }
    }, []);

    return null;
}
