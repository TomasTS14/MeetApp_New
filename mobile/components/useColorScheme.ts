import { useColorScheme as useColorSchemeCore } from 'react-native';

import { useSettings } from '@/lib/settings';

// The theme chosen in Settings, or the device's when it is set to follow the system.
export const useColorScheme = () => {
  const coreScheme = useColorSchemeCore();
  const { theme } = useSettings();
  if (theme !== 'system') return theme;
  return coreScheme === 'dark' ? 'dark' : 'light';
};
