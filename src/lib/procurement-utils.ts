import type { RequisitionStage } from '@/types/database';

// ─── Sequential stage order ────────────────────────────────────────────────────
// Exported from a shared (non-server) module so it can be used in both
// server actions and client components without the 'use server' async restriction.
export const STAGE_ORDER: RequisitionStage[] = [
    'draft',
    'requestor',
    'head_department',
    'cio',
    'head_hr',
    'general_manager',
    'director_strategy',
    'head_finance',
    'chairman',
    'procurement',
    'awaiting_delivery',
    'delivered',
];

export function nextStage(current: RequisitionStage): RequisitionStage {
    const idx = STAGE_ORDER.indexOf(current);
    return idx >= 0 && idx < STAGE_ORDER.length - 1 ? STAGE_ORDER[idx + 1] : 'delivered';
}
