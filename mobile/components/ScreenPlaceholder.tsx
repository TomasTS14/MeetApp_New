import { StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text, View } from '@/components/Themed';

type Props = {
  screen: 'profile' | 'forYou' | 'events' | 'nearby' | 'settings';
  phase: number;
};

// Stand-in for each tab until its phase is built.
export default function ScreenPlaceholder({ screen, phase }: Props) {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t(`screens.${screen}.title`)}</Text>
      <Text style={styles.description}>{t(`screens.${screen}.description`)}</Text>
      <Text style={styles.phase}>{t('comingSoon', { phase })}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    maxWidth: 420,
  },
  phase: {
    fontSize: 14,
    opacity: 0.6,
  },
});
