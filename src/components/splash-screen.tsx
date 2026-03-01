'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import Image from 'next/image';

function detectApp(): boolean {
    if (typeof window === 'undefined') return false;

    // Check for Capacitor native platform (Android/iOS app)
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { Capacitor } = require('@capacitor/core');
        if (Capacitor.isNativePlatform()) return true;
    } catch {}

    // Check for PWA installed/standalone mode
    return (
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as unknown as { standalone: boolean }).standalone === true
    );
}

export function SplashScreen({ children }: { children: React.ReactNode }) {
    const [showSplash, setShowSplash] = useState(false);

    useEffect(() => {
        if (!detectApp()) return; // Web browser — skip splash entirely

        setShowSplash(true);
        const timer = setTimeout(() => setShowSplash(false), 1500);
        return () => clearTimeout(timer);
    }, []);

    return (
        <>
            <AnimatePresence>
                {showSplash && (
                    <motion.div
                        key="splash"
                        initial={{ opacity: 1 }}
                        exit={{ opacity: 0, transition: { duration: 0.8, ease: 'easeInOut' } }}
                        className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white"
                    >
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ duration: 0.5, ease: 'easeOut' }}
                            className="relative w-24 h-24 mb-4"
                        >
                            <Image
                                src="/icons/icon-512x512.png"
                                alt="JTL Logo"
                                fill
                                priority
                                className="object-contain"
                            />
                        </motion.div>
                        <motion.h1
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.3, duration: 0.5 }}
                            className="text-2xl font-bold text-primary tracking-tight"
                        >
                            JTL Ticketing
                        </motion.h1>
                        <motion.div className="mt-8 flex gap-1">
                            {[0, 1, 2].map((i) => (
                                <motion.div
                                    key={i}
                                    animate={{
                                        scale: [1, 1.5, 1],
                                        opacity: [0.3, 1, 0.3],
                                    }}
                                    transition={{
                                        duration: 1,
                                        repeat: Infinity,
                                        delay: i * 0.2,
                                    }}
                                    className="w-2 h-2 rounded-full bg-primary"
                                />
                            ))}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
            {children}
        </>
    );
}
