import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import 'react-native-reanimated';

import { Loading } from '@/components/ui';
import { useColorScheme } from '@/components/useColorScheme';
import { AuthProvider, useAuth } from '@/lib/auth';
import '@/lib/i18n';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

// When a guard hides the current screen, the router falls back to index, which sends
// people to sign-in, onboarding or For you.
export const unstable_settings = {
  anchor: 'index',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <RootStack />
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

// Signed out: only sign-in. Signed in without a profile: only onboarding. Otherwise the app.
function RootStack() {
  const { session, profile, loading } = useAuth();
  const { t } = useTranslation();

  if (loading) {
    return <Loading />;
  }

  const signedIn = !!session;
  const ready = signedIn && !!profile;

  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && !profile}>
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={ready}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="event/[id]" options={{ title: '', headerBackTitle: t('tabs.nearby') }} />
        <Stack.Screen name="event/new" options={{ title: t('create.title'), presentation: 'modal' }} />
      </Stack.Protected>
    </Stack>
  );
}
