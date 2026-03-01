import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';
import { PWARegistration } from '@/components/pwa-registration';
import { SplashScreen } from '@/components/splash-screen';
import { NativeMobileFixes } from '@/components/native-mobile-fixes';


const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Ticketing System | JTL',
  description: 'Internal ticketing system for Jamii Telecommunications Limited',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'JTL Ticketing',
  },
};

export const viewport: Viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} antialiased`} suppressHydrationWarning>
        <NativeMobileFixes />
        <PWARegistration />

        <SplashScreen>
          <Providers>{children}</Providers>
        </SplashScreen>
      </body>
    </html>
  );
}
