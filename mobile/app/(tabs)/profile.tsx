import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Avatar } from '@/components/Avatar';
import { Text, View } from '@/components/Themed';
import { Button, Muted, TextField, useColors } from '@/components/ui';
import { profileQueryKey, useAuth } from '@/lib/auth';
import { useFriends, useUploadAvatar } from '@/lib/social';
import { supabase } from '@/lib/supabase';

// Photo, username, bio and friends. Spotify songs come in phase 4.
export default function ProfileScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const friends = useFriends();
  const uploadAvatar = useUploadAvatar();
  const [bio, setBio] = useState(profile?.bio ?? '');

  const saveBio = useMutation({
    mutationFn: async (value: string) => {
      const { error } = await supabase.from('profiles').update({ bio: value.trim() }).eq('id', profile!.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: profileQueryKey(profile?.id) }),
  });

  const pickPhoto = async () => {
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (picked.canceled) return;
    const asset = picked.assets[0];
    uploadAvatar.mutate({ uri: asset.uri, mimeType: asset.mimeType ?? 'image/jpeg' });
  };

  if (!profile) return null;
  const friendCount = friends.data?.friends.length ?? 0;
  const requests = friends.data?.incoming.length ?? 0;

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.page}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('profile.changePhoto')} onPress={pickPhoto}>
          <Avatar path={profile.avatar_path} name={profile.username} size={96} />
        </Pressable>
        <Pressable accessibilityRole="button" onPress={pickPhoto} disabled={uploadAvatar.isPending}>
          <Text style={{ color: colors.accent }}>
            {uploadAvatar.isPending ? t('profile.uploading') : t('profile.changePhoto')}
          </Text>
        </Pressable>
        {uploadAvatar.isError && <Text style={{ color: colors.danger }}>{t('common.error')}</Text>}
        <Text style={styles.username}>@{profile.username}</Text>
        {profile.id_verified_at && (
          <Text style={[styles.verified, { color: colors.accent }]}>✓ {t('profile.verified')}</Text>
        )}
      </View>

      <Button
        label={
          requests > 0
            ? t('forYou.friendsWithRequests', { count: requests })
            : t('profile.friends', { count: friendCount })
        }
        variant={requests > 0 ? 'primary' : 'secondary'}
        onPress={() => router.push('/friends')}
      />

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
      <Muted>{t('profile.songsSoon')}</Muted>
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
  header: { alignItems: 'center', gap: 6 },
  username: { fontSize: 26, fontWeight: 'bold', marginTop: 6 },
  verified: { fontSize: 15, fontWeight: '600' },
  bio: { minHeight: 90, textAlignVertical: 'top' },
});
