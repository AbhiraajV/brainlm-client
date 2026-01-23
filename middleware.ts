import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Routes that don't require authentication
const PUBLIC_ROUTES = ['/login', '/api']

// Routes that require auth but not onboarding
const AUTH_ONLY_ROUTES = ['/onboarding']

// Static assets and Next.js internals to skip
const SKIP_PATTERNS = ['/_next', '/favicon.ico', '/robots.txt', '/sitemap.xml']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip static assets and Next.js internals
  if (SKIP_PATTERNS.some(pattern => pathname.startsWith(pattern))) {
    return NextResponse.next()
  }

  // Skip public routes
  if (PUBLIC_ROUTES.some(route => pathname.startsWith(route))) {
    return NextResponse.next()
  }

  // Check auth session from cookie
  const sessionCookie = request.cookies.get('brainlm-session')?.value

  if (!sessionCookie) {
    // No session - redirect to login
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Parse and validate session
  try {
    const session = JSON.parse(sessionCookie)
    if (!session.userId) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    // Check if user is on onboarding route (doesn't need baseline check)
    if (AUTH_ONLY_ROUTES.some(route => pathname.startsWith(route))) {
      return NextResponse.next()
    }

    // Check if user has completed onboarding (baseline exists)
    // hasBaseline is stored in session cookie when onboarding completes
    // For backwards compatibility: if hasBaseline is undefined, allow through
    // (existing users before this change won't have it set)
    if (session.hasBaseline === false) {
      return NextResponse.redirect(new URL('/onboarding', request.url))
    }

    // Add user info to headers for downstream use (layouts/pages)
    const response = NextResponse.next()
    response.headers.set('x-user-id', session.userId)
    if (session.email) {
      response.headers.set('x-user-email', session.email)
    }
    return response
  } catch {
    // Invalid session cookie - redirect to login
    return NextResponse.redirect(new URL('/login', request.url))
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
