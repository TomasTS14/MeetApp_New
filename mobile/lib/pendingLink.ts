import type { Href } from 'expo-router';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

// An event link opened while signed out leads to sign-in first. It is kept here so the
// app can open the event once the person has signed in (and finished onboarding).
let pending: string | null = null;

const EVENT_PATH = /^\/?event\/([0-9a-f-]{36})$/i;

function remember(url: string | null) {
  if (!url) return;
  const { path, queryParams } = Linking.parse(url);
  const match = path?.match(EVENT_PATH);
  if (!match) return;
  const invite = typeof queryParams?.invite === 'string' ? queryParams.invite : null;
  pending = `/event/${match[1]}${invite ? `?invite=${encodeURIComponent(invite)}` : ''}`;
}

if (Platform.OS === 'web') {
  if (typeof window !== 'undefined') remember(window.location.href);
} else {
  Linking.getInitialURL().then(remember);
  Linking.addEventListener('url', ({ url }) => remember(url));
}

export function pendingLink(): Href | null {
  return pending as Href | null;
}

// Called once the event has opened, so the link is not followed again.
export function clearPendingLink() {
  pending = null;
}
