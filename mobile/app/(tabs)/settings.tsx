import { useQueryClient } from '@tanstack/react-query';
import { ScrollView, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button, Muted, useColors } from '@/components/ui';
import { supabase } from '@/lib/supabase';

export default function SettingsScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const queryClient = useQueryClient();

  const signOut = async () => {
    await supabase.auth.signOut();
    // Nothing from the previous account should stay in memory.
    queryClient.clear();
  };

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.page}>
      <Muted>{t('settings.more')}</Muted>
      <Button label={t('settings.signOut')} variant="secondary" onPress={signOut} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    padding: 16,
    gap: 16,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
});
