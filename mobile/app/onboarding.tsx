import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text, View } from '@/components/Themed';
import { Button, Muted, TextField, useColors } from '@/components/ui';
import { profileQueryKey, useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

const USERNAME_PATTERN = /^[a-z0-9_.]{3,30}$/;

export default function OnboardingScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [username, setUsername] = useState('');
  const [olderThanMinimum, setOlderThanMinimum] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const name = username.trim().toLowerCase();
    if (!USERNAME_PATTERN.test(name)) {
      setError(t('onboarding.usernameInvalid'));
      return;
    }
    if (!session) return;
    setBusy(true);
    setError(null);
    const { error: insertError } = await supabase
      .from('profiles')
      .insert({ id: session.user.id, username: name, confirmed_minimum_age: true });
    if (insertError) {
      setBusy(false);
      setError(insertError.code === '23505' ? t('onboarding.usernameTaken') : t('common.error'));
      return;
    }
    // Loading the new profile swaps this screen for the app.
    await queryClient.invalidateQueries({ queryKey: profileQueryKey(session.user.id) });
  };

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{t('onboarding.title')}</Text>
        <Muted style={styles.subtitle}>{t('onboarding.subtitle')}</Muted>
        <TextField
          label={t('onboarding.username')}
          hint={t('onboarding.usernameHint')}
          value={username}
          onChangeText={(value) => setUsername(value.toLowerCase())}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={30}
          error={error}
        />
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: olderThanMinimum }}
          onPress={() => setOlderThanMinimum((value) => !value)}
          style={styles.ageRow}>
          <Text style={styles.ageLabel}>{t('onboarding.age')}</Text>
          <Switch
            value={olderThanMinimum}
            onValueChange={setOlderThanMinimum}
            trackColor={{ true: colors.accent, false: colors.border }}
          />
        </Pressable>
        {!olderThanMinimum && <Muted>{t('onboarding.ageRequired')}</Muted>}
        <Button
          label={t('onboarding.continue')}
          onPress={submit}
          loading={busy}
          disabled={!olderThanMinimum || username.trim().length < 3}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    gap: 16,
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  title: { fontSize: 28, fontWeight: 'bold' },
  subtitle: { fontSize: 16, marginBottom: 8 },
  ageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  ageLabel: { fontSize: 16, flex: 1 },
});
