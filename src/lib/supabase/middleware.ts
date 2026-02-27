import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
    let supabaseResponse = NextResponse.next({ request });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) =>
                        request.cookies.set(name, value)
                    );
                    supabaseResponse = NextResponse.next({ request });
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    );
                },
            },
        }
    );

    const { data: { user } } = await supabase.auth.getUser();

    // Fetch user profile to check role for RBAC
    let userRole = null;
    if (user) {
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();
        userRole = profile?.role;
    }

    const adminRoutes = ['/reports', '/dashboard/settings', '/tasks', '/machines'];
    const isAdminRoute = adminRoutes.some(route => request.nextUrl.pathname.startsWith(route));

    // Redirect unauthenticated users to login
    if (
        !user &&
        !request.nextUrl.pathname.startsWith('/login') &&
        !request.nextUrl.pathname.startsWith('/auth')
    ) {
        const url = request.nextUrl.clone();
        url.pathname = '/login';
        return NextResponse.redirect(url);
    }

    // Role-based Access Control (RBAC) - Redirect non-admins from admin routes
    if (user && isAdminRoute && userRole !== 'ADMIN' && userRole !== 'IT_STAFF') {
        const url = request.nextUrl.clone();
        url.pathname = '/portal'; // Redirect to their safe area
        return NextResponse.redirect(url);
    }

    // Redirect authenticated users away from login
    if (user && request.nextUrl.pathname === '/login') {
        const url = request.nextUrl.clone();
        url.pathname = '/tickets';
        return NextResponse.redirect(url);
    }

    return supabaseResponse;
}
