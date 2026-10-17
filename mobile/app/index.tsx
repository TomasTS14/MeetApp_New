import { Redirect } from 'expo-router';

import { useAuth } from '@/lib/auth';

// The app opens on For you, or on sign-in or onboarding when those come first.
export default function Index() {
  const { session, profile } = useAuth();
  if (!session) return <Redirect href="/sign-in" />;
  if (!profile) return <Redirect href="/onboarding" />;
  return <Redirect href="/for-you" />;
}
