import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/Themed';
import { Button, Muted, TextField, useColors } from '@/components/ui';
import { profileQueryKey, useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

// Phase 1 covers the username and bio; the photo and Spotify songs come in phase 3.
export default function ProfileScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [bio, setBio] = useState(profile?.bio ?? '');

  const saveBio = useMutation({
    mutationFn: async (value: string) => {
      const { error } = await supabase.from('profiles').update({ bio: value.trim() }).eq('id', profile!.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: profileQueryKey(profile?.id) }),
  });

  if (!profile) return null;

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.page}>
      <Text style={styles.username}>@{profile.username}</Text>
      {profile.id_verified_at && (
        <Text style={[styles.verified, { color: colors.accent }]}>✓ {t('profile.verified')}</Text>
      )}
      <TextField
        label={t('profile.bio')}
        placeholder={t('profile.bioPlaceholder')}
        value={bio}
        onChangeText={(value) => {
          setBio(value);
          saveBio.reset();
        }}
        multiline
        maxLength={300}
        style={styles.bio}
        error={saveBio.isError ? t('common.error') : null}
      />
      <Button
        label={saveBio.isSuccess ? t('common.saved') : t('common.save')}
        onPress={() => saveBio.mutate(bio)}
        loading={saveBio.isPending}
        disabled={bio.trim() === profile.bio}
      />
      <Muted>{t('comingSoon', { phase: 3 })}: {t('screens.profile.description')}</Muted>
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
  username: { fontSize: 26, fontWeight: 'bold' },
  verified: { fontSize: 15, fontWeight: '600', marginTop: -8 },
  bio: { minHeight: 90, textAlignVertical: 'top' },
});
