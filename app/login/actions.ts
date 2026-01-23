'use server'

import { redirect } from 'next/navigation'
import { initializeMockSession } from '@/server/auth'
import { prisma } from '@/server/prisma/client'

/**
 * Mock login action for development.
 * In production, this would integrate with a real auth provider.
 */
export async function loginAction() {
    // First, check if user has a baseline (onboarding complete)
    const userId = process.env.MOCK_USER_ID || "user_cm618aaa0000001dummyuser01"

    const dbUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { baseline: true },
    })

    const hasBaseline = !!dbUser?.baseline

    // Initialize session with baseline status
    const user = await initializeMockSession(hasBaseline)

    if (!user) {
        // Mock auth is disabled (NEXT_PUBLIC_MOCK_AUTH_LOGOUT=true)
        return { error: 'Authentication disabled' }
    }

    // Redirect to main app (middleware will allow access now that cookie is set)
    // If no baseline, middleware will redirect to /onboarding
    redirect('/')
}
