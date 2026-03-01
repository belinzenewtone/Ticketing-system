'use client';

import { useEffect } from 'react';
import { SplashScreen } from '@capacitor/splash-screen';
import { Capacitor } from '@capacitor/core';

export function NativeMobileFixes() {
    useEffect(() => {
        if (Capacitor.isNativePlatform()) {
            // Wait a moment for the React Splash Screen to definitely be rendered
            const timer = setTimeout(() => {
                SplashScreen.hide({
                    fadeOutDuration: 800
                }).catch(err => {
                    console.warn('SplashScreen.hide failed', err);
                });
            }, 500);
            return () => clearTimeout(timer);
        }
    }, []);


    return null;
}
