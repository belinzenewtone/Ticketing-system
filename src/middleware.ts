import { auth } from "@/auth";

export default auth((req) => {
    const isLoggedIn = !!req.auth;
    const isAuthRoute = req.nextUrl.pathname.startsWith('/login');

    if (isAuthRoute) {
        if (isLoggedIn) {
            return Response.redirect(new URL('/tickets', req.nextUrl));
        }
        return;
    }

    if (!isLoggedIn) {
        return Response.redirect(new URL('/login', req.nextUrl));
    }
});

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
