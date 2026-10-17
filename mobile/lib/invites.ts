import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

// The organizer's secret for the event's invite link.
export function useInviteCode(eventId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['invite-code', eventId],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('event_invite_code', { p_event: eventId });
      if (error) throw error;
      return data;
    },
  });
}

export function useInvitees(eventId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['invitees', eventId],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('event_invitees', { p_event: eventId });
      if (error) throw error;
      return data;
    },
  });
}

export function useInviteFriend(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (personId: string) => {
      const { error } = await supabase.rpc('invite_friends', { p_event: eventId, p_users: [personId] });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invitees', eventId] }),
  });
}

export function useUninvite(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (personId: string) => {
      const { error } = await supabase.rpc('uninvite', { p_event: eventId, p_user: personId });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invitees', eventId] }),
  });
}

// Opening an invite link. Returns whether the code let the person in.
export function useAcceptInvite(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (code: string) => {
      const { data, error } = await supabase.rpc('accept_invite', { p_event: eventId, p_code: code });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      queryClient.invalidateQueries({ queryKey: ['my-events'] });
    },
  });
}
