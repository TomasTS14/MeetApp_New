import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, type ReactNode } from 'react';

import { useAuth } from '@/lib/auth';
import type { Tables } from '@/lib/database.types';
import i18n, { deviceLanguage } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';

export type Settings = Pick<
  Tables<'user_settings'>,
  | 'locale'
  | 'font_scale'
  | 'theme'
  | 'default_radius_km'
  | 'share_activity_with_friends'
  | 'share_attendance_with_friends'
>;
export type ThemePreference = 'system' | 'light' | 'dark';

type SettingsState = {
  settings: Settings | null;
  theme: ThemePreference;
  fontScale: number;
};

const SettingsContext = createContext<SettingsState>({ settings: null, theme: 'system', fontScale: 1 });

const settingsQueryKey = (userId: string | undefined) => ['settings', userId] as const;

// Loads the signed-in person's settings and applies the language. Theme and text size are
// read through useColorScheme() and the themed Text component.
export function SettingsProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user.id;
  const query = useQuery({
    queryKey: settingsQueryKey(userId),
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_settings')
        .select(
          'locale, font_scale, theme, default_radius_km, share_activity_with_friends, share_attendance_with_friends'
        )
        .eq('user_id', userId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const settings = userId ? (query.data ?? null) : null;

  // Signed out, the app follows the device language again.
  const language = settings?.locale ?? deviceLanguage();
  useEffect(() => {
    if (i18n.language !== language) void i18n.changeLanguage(language);
  }, [language]);

  return (
    <SettingsContext.Provider
      value={{
        settings,
        theme: (settings?.theme as ThemePreference | undefined) ?? 'system',
        fontScale: settings?.font_scale ?? 1,
      }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}

export function useUpdateSettings() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const userId = session?.user.id;
  return useMutation({
    mutationFn: async (changes: Partial<Settings>) => {
      const { error } = await supabase
        .from('user_settings')
        .update({ ...changes, updated_at: new Date().toISOString() })
        .eq('user_id', userId!);
      if (error) throw error;
    },
    // Apply right away so the screen reacts while the save is in flight.
    onMutate: (changes) => {
      queryClient.setQueryData(settingsQueryKey(userId), (current: Settings | null | undefined) =>
        current ? { ...current, ...changes } : current
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: settingsQueryKey(userId) }),
  });
}
