import { useMutation, useQueryClient } from '@tanstack/react-query';

import { saveTextFile } from '@/lib/saveFile';
import { supabase } from '@/lib/supabase';

// "Download my data": everything MeetApp holds about the person, as a JSON file.
export function useExportData() {
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('export_my_data');
      if (error) throw error;
      const date = new Date().toISOString().slice(0, 10);
      await saveTextFile(`meetapp-data-${date}.json`, JSON.stringify(data, null, 2), 'application/json');
    },
  });
}

// Deletes the account and everything about it, then signs out on this device.
export function useDeleteAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
      if (error) throw error;
      // The session no longer exists on the server, so only clear it here.
      await supabase.auth.signOut({ scope: 'local' });
      queryClient.clear();
    },
  });
}
