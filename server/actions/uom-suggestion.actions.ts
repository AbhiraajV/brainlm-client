"use server";

import { requireUser } from "@/server/auth";
import { prisma } from "@/server/prisma/client";
import { UOMSuggestionStatus } from "@prisma/client";

/**
 * UOM (User Operational Model) Suggestion Actions
 * Manage suggestions for updating user's baseline profile.
 */

export interface ActionResult {
    success: boolean;
    error?: string;
}

/**
 * Get pending UOM suggestions for current user.
 */
export async function getPendingUOMSuggestions() {
    const user = await requireUser();
    return prisma.uOMUpdateSuggestion.findMany({
        where: { userId: user.id, status: UOMSuggestionStatus.PENDING },
        orderBy: { createdAt: 'desc' }
    });
}

/**
 * Accept a UOM suggestion and update the user's baseline.
 */
export async function acceptUOMSuggestion(suggestionId: string): Promise<ActionResult> {
    const user = await requireUser();

    const suggestion = await prisma.uOMUpdateSuggestion.findFirst({
        where: { id: suggestionId, userId: user.id },
        include: { user: { select: { baseline: true } } }
    });

    if (!suggestion) return { success: false, error: 'Suggestion not found' };
    if (suggestion.status !== UOMSuggestionStatus.PENDING) {
        return { success: false, error: `Cannot accept suggestion with status: ${suggestion.status}` };
    }

    const currentBaseline = suggestion.user.baseline || '';
    const timestamp = new Date().toISOString().split('T')[0];

    let newBaseline: string;
    switch (suggestion.driftType) {
        case 'ADDITION':
            newBaseline = currentBaseline
                ? `${currentBaseline.trimEnd()}\n\n---\n**Update (${timestamp}):**\n- ${suggestion.suggestion}`
                : `# User Baseline\n\n- ${suggestion.suggestion}\n\n*Added: ${timestamp}*`;
            break;
        case 'MODIFICATION':
            newBaseline = `${currentBaseline.trimEnd()}\n\n---\n**Modification (${timestamp}):**\n- ${suggestion.suggestion}`;
            break;
        case 'REMOVAL':
            newBaseline = `${currentBaseline.trimEnd()}\n\n---\n**Deprecated (${timestamp}):**\n- ~~${suggestion.suggestion}~~`;
            break;
        default:
            newBaseline = `${currentBaseline.trimEnd()}\n\n- ${suggestion.suggestion}`;
    }

    try {
        await prisma.$transaction([
            prisma.uOMUpdateSuggestion.update({
                where: { id: suggestionId },
                data: { status: UOMSuggestionStatus.ACCEPTED, statusChangedAt: new Date() }
            }),
            prisma.user.update({
                where: { id: user.id },
                data: { baseline: newBaseline, lastBaselineUpdate: new Date() }
            })
        ]);
        return { success: true };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Database error' };
    }
}

/**
 * Reject a UOM suggestion.
 */
export async function rejectUOMSuggestion(suggestionId: string, reason?: string): Promise<ActionResult> {
    const user = await requireUser();

    const suggestion = await prisma.uOMUpdateSuggestion.findFirst({
        where: { id: suggestionId, userId: user.id }
    });

    if (!suggestion) return { success: false, error: 'Suggestion not found' };
    if (suggestion.status !== UOMSuggestionStatus.PENDING) {
        return { success: false, error: `Cannot reject suggestion with status: ${suggestion.status}` };
    }

    try {
        await prisma.uOMUpdateSuggestion.update({
            where: { id: suggestionId },
            data: {
                status: UOMSuggestionStatus.REJECTED,
                statusChangedAt: new Date(),
                reasoning: reason ? `${suggestion.reasoning}\n\n---\n**Rejected:** ${reason}` : suggestion.reasoning
            }
        });
        return { success: true };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Database error' };
    }
}

/**
 * Ignore/dismiss a UOM suggestion.
 */
export async function ignoreUOMSuggestion(suggestionId: string): Promise<ActionResult> {
    const user = await requireUser();

    const suggestion = await prisma.uOMUpdateSuggestion.findFirst({
        where: { id: suggestionId, userId: user.id }
    });

    if (!suggestion) return { success: false, error: 'Suggestion not found' };
    if (suggestion.status !== UOMSuggestionStatus.PENDING) {
        return { success: false, error: `Cannot ignore suggestion with status: ${suggestion.status}` };
    }

    try {
        await prisma.uOMUpdateSuggestion.update({
            where: { id: suggestionId },
            data: { status: UOMSuggestionStatus.IGNORED, statusChangedAt: new Date() }
        });
        return { success: true };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Database error' };
    }
}
