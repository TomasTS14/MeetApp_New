import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/lib/auth';
import type { Database } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

export type ReportTarget = Database['public']['Enums']['report_target'];
export const reportReasons = ['spam', 'harassment', 'inappropriate', 'dangerous', 'other'] as const;
export type ReportReason = (typeof reportReasons)[number];

// A report's reason is stored as "<reason>" or "<reason>: <details>".
export function parseReason(stored: string): { reason: ReportReason | null; details: string } {
  const [key, ...rest] = stored.split(': ');
  const reason = reportReasons.find((r) => r === key) ?? null;
  return reason ? { reason, details: rest.join(': ') } : { reason: null, details: stored };
}

export function useReport() {
  return useMutation({
    mutationFn: async (report: { targetType: ReportTarget; targetId: string; reason: ReportReason; details: string }) => {
      const details = report.details.trim();
      const { error } = await supabase.from('reports').insert({
        target_type: report.targetType,
        target_id: report.targetId,
        reason: details ? `${report.reason}: ${details}`.slice(0, 1000) : report.reason,
      });
      // Already reported and still open: nothing more to do.
      if (error && error.code !== '23505') throw error;
    },
  });
}

export function useIsAdmin() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['is-admin', session?.user.id],
    enabled: !!session,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('is_admin');
      if (error) throw error;
      return data;
    },
  });
}

export type QueuedReport = Database['public']['Functions']['admin_reports']['Returns'][number];

export function useAdminReports() {
  return useQuery({
    queryKey: ['admin-reports'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_reports');
      if (error) throw error;
      return data;
    },
  });
}

export type ReportAction = 'dismiss' | 'remove' | 'ban' | 'remove_and_ban';

// Dismissing and removing are database calls; banning goes through the ban-user edge
// function, which can also remove the reported thing in the same step.
export function useActOnReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ report, action }: { report: QueuedReport; action: ReportAction }) => {
      if (action === 'dismiss' || action === 'remove') {
        const { error } = await supabase.rpc('admin_resolve_reports', {
          p_target_type: report.target_type,
          p_target: report.target_id,
          p_resolution: action === 'dismiss' ? 'dismissed' : 'removed',
        });
        if (error) throw error;
        return;
      }
      const { error } = await supabase.functions.invoke('ban-user', {
        body: { target_type: report.target_type, target_id: report.target_id, remove: action === 'remove_and_ban' },
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-reports'] }),
  });
}
