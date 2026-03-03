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
