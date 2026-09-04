'use server';

import { query, execute } from '@/lib/db';

export interface LookupValue {
    id: string;
    category: string;
    value: string;
    label: string;
    display_order: number;
    active: boolean;
}

// ─── Hardcoded fallbacks (used when DB is unavailable) ────────────────────────
const FALLBACKS: Record<string, { value: string; label: string }[]> = {
    ticket_priority:    [{ value: 'critical', label: 'Critical' }, { value: 'high', label: 'High' }, { value: 'medium', label: 'Medium' }, { value: 'low', label: 'Low' }],
    ticket_category:    [{ value: 'email', label: 'Email' }, { value: 'account-login', label: 'Account / Login' }, { value: 'password-reset', label: 'Password Reset' }, { value: 'hardware', label: 'Hardware' }, { value: 'software', label: 'Software' }, { value: 'network-vpn', label: 'Network / VPN' }, { value: 'other', label: 'Other' }],
    ticket_department:  [{ value: 'IT', label: 'IT' }, { value: 'Finance', label: 'Finance' }, { value: 'HR', label: 'HR' }, { value: 'Operations', label: 'Operations' }, { value: 'Sales', label: 'Sales' }, { value: 'Management', label: 'Management' }],
    inventory_category: [{ value: 'laptops', label: 'Laptops' }, { value: 'desktops', label: 'Desktops' }, { value: 'peripherals', label: 'Peripherals' }, { value: 'networking', label: 'Networking' }, { value: 'supplies', label: 'Supplies' }, { value: 'other', label: 'Other' }],
    procurement_type:   [{ value: 'it-equipment', label: 'IT Equipment' }, { value: 'office-supplies', label: 'Office Supplies' }, { value: 'services', label: 'Services' }, { value: 'other', label: 'Other' }],
    procurement_supplier: [{ value: 'ELEVETUS', label: 'ELEVETUS' }, { value: 'OPENSOL', label: 'OPENSOL' }, { value: 'DIGITAL LEO', label: 'DIGITAL LEO' }, { value: 'SAI OFFICE', label: 'SAI OFFICE' }, { value: 'ADTEL', label: 'ADTEL' }, { value: 'ANGANI', label: 'ANGANI' }],
};

export async function getLookupValues(category: string): Promise<LookupValue[]> {
    try {
        const rows = await query<LookupValue>(
            `SELECT * FROM lookup_values WHERE category = $1 AND active = TRUE ORDER BY display_order ASC, label ASC`,
            category
        );
        if (rows.length > 0) return rows;
        // DB reachable but no rows — return fallback as synthetic rows
    } catch {
        // DB unreachable — return fallback
    }
    return (FALLBACKS[category] ?? []).map((f, i) => ({
        id: `fallback-${category}-${i}`,
        category,
        value: f.value,
        label: f.label,
        display_order: i,
        active: true,
    }));
}

export async function getAllLookupCategories(): Promise<Record<string, LookupValue[]>> {
    const categories = Object.keys(FALLBACKS);
    const results = await Promise.all(categories.map(c => getLookupValues(c)));
    return Object.fromEntries(categories.map((c, i) => [c, results[i]]));
}

export async function addLookupValue(category: string, label: string): Promise<void> {
    const value = label.trim();
    if (!value) throw new Error('Label cannot be empty');

    // Get current max order
    let maxOrder = 0;
    try {
        const rows = await query<{ max_order: number }>(
            `SELECT COALESCE(MAX(display_order), 0) AS max_order FROM lookup_values WHERE category = $1`,
            category
        );
        maxOrder = rows[0]?.max_order ?? 0;
    } catch { /* use 0 */ }

    await execute(
        `INSERT INTO lookup_values (id, category, value, label, display_order)
         VALUES (gen_random_uuid(), $1, $2, $3, $4)
         ON CONFLICT (category, value) DO UPDATE SET active = TRUE, label = EXCLUDED.label`,
        category, value, label.trim(), maxOrder + 1
    );
}

export async function removeLookupValue(id: string): Promise<void> {
    // Soft-delete so existing records referencing this value still work
    await execute(`UPDATE lookup_values SET active = FALSE WHERE id = $1`, id);
}

export async function restoreLookupValue(id: string): Promise<void> {
    await execute(`UPDATE lookup_values SET active = TRUE WHERE id = $1`, id);
}
