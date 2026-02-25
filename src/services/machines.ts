import { createClient } from '@/lib/supabase/client';
import type { MachineRequest, CreateMachineInput, MachineReason, MachineStatus } from '@/types/database';

const supabase = createClient();

export async function getMachines(filters?: {
    reason?: MachineReason;
    status?: MachineStatus;
    search?: string;
}): Promise<MachineRequest[]> {
    let query = supabase
        .from('machine_requests')
        .select('*')
        .order('number', { ascending: false });

    if (filters?.reason) {
        query = query.eq('reason', filters.reason);
    }
    if (filters?.status) {
        query = query.eq('status', filters.status);
    }
    if (filters?.search) {
        query = query.or(
            `requester_name.ilike.%${filters.search}%,user_name.ilike.%${filters.search}%,work_email.ilike.%${filters.search}%`
        );
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
}

export async function addMachine(input: CreateMachineInput): Promise<MachineRequest> {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
        .from('machine_requests')
        .insert({ ...input, created_by: user?.id })
        .select('*')
        .single();
    if (error) throw error;
    return data;
}

export async function updateMachine(id: string, updates: Partial<MachineRequest>): Promise<MachineRequest> {
    const { data, error } = await supabase
        .from('machine_requests')
        .update(updates)
        .eq('id', id)
        .select('*')
        .single();
    if (error) throw error;
    return data;
}

export async function deleteMachine(id: string): Promise<void> {
    const { error } = await supabase.from('machine_requests').delete().eq('id', id);
    if (error) throw error;
}

export async function getMachineStats() {
    const { data, error } = await supabase.from('machine_requests').select('reason, status, importance');
    if (error) throw error;
    const machines = data || [];
    return {
        total: machines.length,
        pending: machines.filter(m => m.status === 'pending').length,
        approved: machines.filter(m => m.status === 'approved').length,
        fulfilled: machines.filter(m => m.status === 'fulfilled').length,
        rejected: machines.filter(m => m.status === 'rejected').length,
        oldHardware: machines.filter(m => m.reason === 'old-hardware').length,
        faulty: machines.filter(m => m.reason === 'faulty').length,
        newUser: machines.filter(m => m.reason === 'new-user').length,
    };
}
