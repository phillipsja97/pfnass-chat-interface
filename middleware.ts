import { auth } from "@/auth"
import { NextResponse } from "next/server"

export default auth((req) => {
  const { nextUrl, auth: session } = req

  // Always pass through Auth.js internal routes
  if (nextUrl.pathname.startsWith("/api/auth")) {
    return NextResponse.next()
  }

  // Redirect unauthenticated users to Keycloak sign-in
  if (!session) {
    const signInUrl = new URL("/api/auth/signin", nextUrl.origin)
    signInUrl.searchParams.set("callbackUrl", nextUrl.href)
    return NextResponse.redirect(signInUrl)
  }

  // Force re-auth if the refresh token has also expired
  if ((session as { error?: string }).error === "RefreshAccessTokenError") {
    const signInUrl = new URL("/api/auth/signin", nextUrl.origin)
    signInUrl.searchParams.set("callbackUrl", nextUrl.href)
    return NextResponse.redirect(signInUrl)
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static (static files)
     * - _next/image (image optimisation)
     * - favicon.ico, robots.txt, sitemap.xml
     * - Public icon assets referenced in layout.tsx metadata
     */
    "/((?!_next/static|_next/image|favicon.ico|icon.*|apple-icon.*|robots.txt|sitemap.xml).*)",
  ],
}
