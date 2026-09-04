import type { NextConfig } from "next";

const corsHeaders = [
    { key: 'Access-Control-Allow-Origin', value: '*' },
    { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PATCH,DELETE,OPTIONS' },
    { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
];

const nextConfig: NextConfig = {
    compiler: {
        removeConsole: process.env.NODE_ENV === 'production',
    },
    poweredByHeader: false,
    // Enable native TypeScript 7 (Corsa/Go) compiler for faster builds (Next.js 16.3+)
    experimental: {
        useTypeScriptCli: true,
    },
    // Turbopack: explicit root so npm workspaces inside the user home dir resolve correctly
    turbopack: {
        root: __dirname,
    },
    async headers() {
        return [
            {
                source: '/api/mobile/:path*',
                headers: corsHeaders,
            },
        ];
    },
};



export default nextConfig;
