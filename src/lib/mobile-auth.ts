import { SignJWT, jwtVerify } from 'jose';
import type { UserRole } from '@/types/database';

export interface MobileSession {
    id: string;
    email: string;
    name: string;
    role: UserRole;
}

const secret = new TextEncoder().encode(process.env.AUTH_SECRET!);

export async function signMobileJWT(payload: MobileSession): Promise<string> {
    return new SignJWT({ ...payload })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('30d')
        .sign(secret);
}

export async function verifyMobileJWT(token: string): Promise<MobileSession | null> {
    try {
        const { payload } = await jwtVerify(token, secret);
        return payload as unknown as MobileSession;
    } catch {
        return null;
    }
}

export function getBearerToken(request: Request): string | null {
    const auth = request.headers.get('Authorization');
    if (!auth?.startsWith('Bearer ')) return null;
    return auth.slice(7);
}

export async function getSession(request: Request): Promise<MobileSession | null> {
    const token = getBearerToken(request);
    if (!token) return null;
    return verifyMobileJWT(token);
}
