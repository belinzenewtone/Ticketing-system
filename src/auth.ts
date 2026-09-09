import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { authConfig } from "./auth.config";
import { queryOne } from "@/lib/db";
import type { Session } from "next-auth";

// ─── Dev bypass ───────────────────────────────────────────────────────────────
// When BYPASS_AUTH=true the app runs without Supabase / any database for auth.
// ONLY honoured in development — any attempt to set this in production is ignored
// and a warning is logged so the misconfiguration is visible in logs.
const BYPASS_AUTH =
    process.env.BYPASS_AUTH === 'true' && process.env.NODE_ENV !== 'production';

if (process.env.BYPASS_AUTH === 'true' && process.env.NODE_ENV === 'production') {
    console.error(
        '[auth] BYPASS_AUTH=true is set in a production environment — ignoring. ' +
        'Remove this env var from your production configuration immediately.'
    );
}

const DEV_SESSION: Session = {
    user: {
        id: 'dev-admin-bypass-id',
        email: 'dev@jtl.co.ke',
        name: 'Dev Admin (Bypass)',
        role: 'ADMIN' as any,
    },
    expires: '2099-12-31T23:59:59.999Z',
};

// ─── Real NextAuth setup ──────────────────────────────────────────────────────
const _nextAuth = NextAuth({
    ...authConfig,
    secret: (() => {
        const secret = process.env.AUTH_SECRET;
        if (!secret) {
            if (process.env.NODE_ENV === 'production') {
                throw new Error('[auth] AUTH_SECRET environment variable is not set. Set it in your production environment.');
            }
            console.warn('[auth] AUTH_SECRET is not set — using an insecure dev secret. Set AUTH_SECRET before deploying.');
            return 'dev-insecure-secret-set-AUTH_SECRET-in-env';
        }
        return secret;
    })(),
    session: { strategy: "jwt" },
    providers: [
        CredentialsProvider({
            name: "Email and Password",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
            },
            async authorize(credentials) {
                try {
                    if (!credentials?.email || !credentials?.password) {
                        return null;
                    }

                    const user = await queryOne<any>(
                        'SELECT * FROM "User" WHERE email = $1',
                        credentials.email as string
                    );

                    if (!user || !user.password) {
                        return null;
                    }

                    const isPasswordValid = await bcrypt.compare(
                        credentials.password as string,
                        user.password
                    );

                    if (!isPasswordValid) {
                        return null;
                    }

                    return {
                        id: user.id,
                        email: user.email,
                        name: user.name,
                        role: user.role,
                    };
                } catch (e) {
                    console.error('CRITICAL AUTH ERROR:', e);
                    return null;
                }
            },
        }),
    ],
});

export const handlers = _nextAuth.handlers;
export const signIn  = _nextAuth.signIn;
export const signOut = _nextAuth.signOut;

// In bypass mode, auth() always returns the dev admin session without touching the DB.
export const auth: typeof _nextAuth.auth = BYPASS_AUTH
    ? (async (..._args: unknown[]) => DEV_SESSION) as typeof _nextAuth.auth
    : _nextAuth.auth;
