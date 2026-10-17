import { useQueryClient } from '@tanstack/react-query';
import { ScrollView, StyleSheet, Switch } from 'react-native';
import { useTranslation } from 'react-i18next';

import { PersonRow } from '@/components/PersonRow';
import { Text, View } from '@/components/Themed';
import { Button, Chip, Loading, Muted, useColors } from '@/components/ui';
import { useSettings, useUpdateSettings, type Settings } from '@/lib/settings';
import { useBlocks, useUnblock } from '@/lib/social';
import { supabase } from '@/lib/supabase';

const textSizes = [
  { key: 'small', scale: 0.9 },
  { key: 'default', scale: 1 },
  { key: 'large', scale: 1.2 },
  { key: 'larger', scale: 1.4 },
] as const;
const radiusOptions = [5, 10, 25, 50, 100];

export default function SettingsScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const queryClient = useQueryClient();
  const { settings } = useSettings();
  const update = useUpdateSettings();
  const blocks = useBlocks();
  const unblock = useUnblock();

  const signOut = async () => {
    await supabase.auth.signOut();
    // Nothing from the previous account should stay in memory.
    queryClient.clear();
  };

  if (!settings) return <Loading />;
  const set = (changes: Partial<Settings>) => update.mutate(changes);

  const toggle = (key: 'share_activity_with_friends' | 'share_attendance_with_friends', label: string, hint: string) => (
    <View style={styles.switchRow}>
      <View style={styles.switchText}>
        <Text style={styles.label}>{label}</Text>
        <Muted style={styles.hint}>{hint}</Muted>
      </View>
      <Switch
        accessibilityLabel={label}
        value={settings[key]}
        onValueChange={(value) => set({ [key]: value })}
        trackColor={{ true: colors.accent, false: colors.border }}
      />
    </View>
  );

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.page}>
      <View style={styles.section}>
        <Text style={styles.heading}>{t('settings.language')}</Text>
        <View style={styles.chips}>
          <Chip label="English" selected={settings.locale === 'en'} onPress={() => set({ locale: 'en' })} />
          <Chip label="Español" selected={settings.locale === 'es'} onPress={() => set({ locale: 'es' })} />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.heading}>{t('settings.theme')}</Text>
        <View style={styles.chips}>
          {(['system', 'light', 'dark'] as const).map((theme) => (
            <Chip
              key={theme}
              label={t(`settings.themes.${theme}`)}
              selected={settings.theme === theme}
              onPress={() => set({ theme })}
            />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.heading}>{t('settings.textSize')}</Text>
        <View style={styles.chips}>
          {textSizes.map(({ key, scale }) => (
            <Chip
              key={key}
              label={t(`settings.textSizes.${key}`)}
              selected={Number(settings.font_scale) === scale}
              onPress={() => set({ font_scale: scale })}
            />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.heading}>{t('settings.defaultDistance')}</Text>
        <View style={styles.chips}>
          {radiusOptions.map((km) => (
            <Chip
              key={km}
              label={`${km} km`}
              selected={settings.default_radius_km === km}
              onPress={() => set({ default_radius_km: km })}
            />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.heading}>{t('settings.privacy')}</Text>
        {toggle('share_activity_with_friends', t('settings.shareComments'), t('settings.shareCommentsHint'))}
        {toggle('share_attendance_with_friends', t('settings.shareAttendance'), t('settings.shareAttendanceHint'))}
        {update.isError && <Text style={{ color: colors.danger }}>{t('common.error')}</Text>}
      </View>

      <View style={styles.section}>
        <Text style={styles.heading}>{t('settings.blocked')}</Text>
        {blocks.data?.length === 0 && <Muted>{t('settings.noBlocked')}</Muted>}
        {blocks.data?.map((person) => (
          <PersonRow
            key={person.id}
            person={person}
            actions={
              <Button
                label={t('friends.unblock')}
                variant="secondary"
                onPress={() => unblock.mutate(person.id)}
                style={styles.compact}
              />
            }
          />
        ))}
      </View>

      <Button label={t('settings.signOut')} variant="secondary" onPress={signOut} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 28, width: '100%', maxWidth: 720, alignSelf: 'center', paddingBottom: 40 },
  section: { gap: 10 },
  heading: { fontSize: 18, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  switchText: { flex: 1, gap: 2 },
  label: { fontSize: 16 },
  hint: { fontSize: 13 },
  compact: { minHeight: 36, paddingHorizontal: 14 },
});
