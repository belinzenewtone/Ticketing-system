import type { NextAuthConfig } from "next-auth";

export const authConfig = {
    pages: {
        signIn: "/login",
    },
    callbacks: {
        async jwt({ token, user, trigger, session }) {
            if (user) {
                token.role = user.role;
                token.id = user.id;
            }
            if (trigger === "update" && session?.name) {
                token.name = session.name;
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                session.user.role = token.role as any;
                session.user.id = token.id as string;
            }
            return session;
        },
        authorized({ auth, request: { nextUrl, headers } }) {
            // Server actions handle their own auth internally — never redirect them,
            // as redirecting breaks the RSC response format Next.js expects.
            if (headers.get('next-action') !== null) return true;

            const isLoggedIn = !!auth?.user;
            const isLoginPage = nextUrl.pathname.startsWith('/login');

            if (isLoginPage) {
                if (isLoggedIn) return Response.redirect(new URL('/tickets', nextUrl));
                return true;
            }

            return isLoggedIn;
        },
    },
    providers: [], // Configured in auth.ts
} satisfies NextAuthConfig;
