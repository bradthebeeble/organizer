import { auth } from "@/auth"

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const isAuthPage = req.nextUrl.pathname.startsWith('/auth')
  const isApiAuthRoute = req.nextUrl.pathname.startsWith('/api/auth')
  
  // Allow API auth routes to pass through
  if (isApiAuthRoute) {
    return
  }
  
  // Redirect to login if not logged in and not on auth page
  if (!isLoggedIn && !isAuthPage) {
    return Response.redirect(new URL('/auth/signin', req.url))
  }
  
  // Redirect to dashboard if logged in and on auth page
  if (isLoggedIn && isAuthPage) {
    return Response.redirect(new URL('/dashboard', req.url))
  }
})

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)" ],
}