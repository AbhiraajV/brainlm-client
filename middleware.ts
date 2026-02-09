import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

// Public routes that don't require auth
const isPublicRoute = createRouteMatcher([
  '/api/webhooks(.*)',
  '/test(.*)',  // Test routes for development
  '/api/google-fit/callback',
  '/pricing(.*)',
  '/onboarding(.*)',
])

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect() // Redirects to Clerk signin if not authenticated
  }
})

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}
