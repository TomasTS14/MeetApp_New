import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';

function TabIcon({ name, color }: { name: SymbolViewProps['name']; color: SymbolViewProps['tintColor'] }) {
  return <SymbolView name={name} tintColor={color} size={26} />;
}

export const unstable_settings = {
  anchor: 'for-you',
};

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { t } = useTranslation();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme].tint,
        // Disable the static render of the header on web
        // to prevent a hydration error in React Navigation v6.
        headerShown: useClientOnlyValue(false, true),
      }}>
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarIcon: ({ color }) => (
            <TabIcon name={{ ios: 'person.crop.circle', android: 'account_circle', web: 'account_circle' }} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="for-you"
        options={{
          title: t('tabs.forYou'),
          tabBarIcon: ({ color }) => (
            <TabIcon name={{ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          title: t('tabs.events'),
          tabBarIcon: ({ color }) => (
            <TabIcon name={{ ios: 'calendar', android: 'event', web: 'event' }} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="nearby"
        options={{
          title: t('tabs.nearby'),
          tabBarIcon: ({ color }) => (
            <TabIcon name={{ ios: 'location.circle', android: 'near_me', web: 'near_me' }} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('tabs.settings'),
          tabBarIcon: ({ color }) => (
            <TabIcon name={{ ios: 'gearshape', android: 'settings', web: 'settings' }} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
