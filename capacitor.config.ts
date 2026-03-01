import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.jtl.ticketing',
  appName: 'JTL Ticketing',
  webDir: 'out',
  server: {
    url: 'https://ticketingjtl.vercel.app/',
    cleartext: true
  }
};


export default config;
