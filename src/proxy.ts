import NextAuth from 'next-auth';
import { authConfig } from './auth.config';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// When BYPASS_AUTH is true every request passes through unchanged.
// ONLY honoured in development — silently disabled in production.
const BYPASS_AUTH =
    process.env.BYPASS_AUTH === 'true' && process.env.NODE_ENV !== 'production';

const { auth } = NextAuth(authConfig);

// Real auth middleware — redirects unauthenticated users to /login
const authMiddleware = auth;

// No-op middleware for bypass mode
function bypassMiddleware(_request: NextRequest) {
    return NextResponse.next();
}

export default BYPASS_AUTH ? bypassMiddleware : authMiddleware;

export const config = {
    matcher: [
        /*
         * Match all paths EXCEPT:
         *  - _next/static / _next/image  (assets)
         *  - favicon.ico
         *  - /login                      (sign-in page)
         *  - /api/auth                   (NextAuth endpoints)
         *  - /api/mobile                 (mobile app endpoints — handle own JWT auth)
         *  - /portal                     (employee portal — has its own gate)
         */
        '/((?!_next/static|_next/image|favicon.ico|login|api/auth|api/mobile|portal).*)',
    ],
};
