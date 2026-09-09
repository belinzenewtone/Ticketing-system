import type { NextConfig } from "next";

// ─── CORS headers for the mobile REST API ─────────────────────────────────────
// The mobile API is consumed by a React Native app — native apps are not bound by
// the browser same-origin policy so wildcard origin is safe here. If you ever add
// a web-based consumer, replace '*' with that specific origin.
const mobileApiCorsHeaders = [
    { key: 'Access-Control-Allow-Origin',  value: '*' },
    { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PATCH,DELETE,OPTIONS' },
    { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
];

// ─── Security headers applied to every page / route ──────────────────────────
const securityHeaders = [
    // Prevent embedding in iframes (clickjacking)
    { key: 'X-Frame-Options', value: 'DENY' },

    // Stop browsers from sniffing the MIME type
    { key: 'X-Content-Type-Options', value: 'nosniff' },

    // Limit referrer info sent to third parties
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },

    // Enforce HTTPS for 2 years, including subdomains
    { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },

    // Disable sensitive browser features the app doesn't need
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },

    // Content Security Policy
    // - script-src: self + inline (Next.js hydration requires this; tighten with nonces in future)
    // - style-src:  self + inline (Tailwind inlines critical CSS)
    // - img-src:    self + data URIs + Supabase storage bucket
    // - font-src:   self + Google Fonts
    // - connect-src: self + Supabase for direct API calls
    {
        key: 'Content-Security-Policy',
        value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "font-src 'self' https://fonts.gstatic.com",
            "img-src 'self' data: blob: https://*.supabase.co",
            "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
            "frame-src 'none'",
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self'",
        ].join('; '),
    },
];

const nextConfig: NextConfig = {
    compiler: {
        removeConsole: process.env.NODE_ENV === 'production',
    },
    poweredByHeader: false,
    experimental: {},
    async headers() {
        return [
            // Security headers on all routes
            {
                source: '/(.*)',
                headers: securityHeaders,
            },
            // CORS on mobile API routes (must come after the global rule so
            // mobile routes get both security headers AND CORS headers)
            {
                source: '/api/mobile/:path*',
                headers: mobileApiCorsHeaders,
            },
        ];
    },
};

export default nextConfig;
