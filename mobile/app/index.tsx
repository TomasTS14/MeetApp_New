import { Redirect } from 'expo-router';

import { useAuth } from '@/lib/auth';
import { pendingLink } from '@/lib/pendingLink';

// The app opens on For you, or on sign-in or onboarding when those come first. An event
// link opened while signed out opens once the person is in.
export default function Index() {
  const { session, profile } = useAuth();
  if (!session) return <Redirect href="/sign-in" />;
  if (!profile) return <Redirect href="/onboarding" />;
  return <Redirect href={pendingLink() ?? '/for-you'} />;
}
