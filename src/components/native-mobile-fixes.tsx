'use client';

import { useEffect } from 'react';
import { SplashScreen } from '@capacitor/splash-screen';
import { Capacitor } from '@capacitor/core';

export function NativeMobileFixes() {
    useEffect(() => {
        if (Capacitor.isNativePlatform()) {
            // Hide the native splash screen once the React app is mounted
            SplashScreen.hide({
                fadeOutDuration: 500
            }).catch(err => {
                console.warn('SplashScreen.hide failed', err);
            });
        }
    }, []);

    return null;
}
