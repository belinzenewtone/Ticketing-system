import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Auth is bypassed in dev mode (BYPASS_AUTH=true in .env.local).
// Swap this file back to the NextAuth-based version when Supabase access is restored.
export default function middleware(_request: NextRequest) {
    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
