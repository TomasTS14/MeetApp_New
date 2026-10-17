import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Alert, Platform, ScrollView, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Avatar } from '@/components/Avatar';
import { FriendButton } from '@/components/FriendButton';
import { Text, View } from '@/components/Themed';
import { Button, Centered, Loading, Muted, useColors } from '@/components/ui';
import { useBlock, usePerson, useRelationship } from '@/lib/social';

function confirm(message: string, cancel: string, action: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(message)) onConfirm();
    return;
  }
  Alert.alert(message, undefined, [
    { text: cancel, style: 'cancel' },
    { text: action, style: 'destructive', onPress: onConfirm },
  ]);
}

export default function PersonScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const { t } = useTranslation();
  const colors = useColors();
  const person = usePerson(username);
  const relationship = useRelationship(person.data?.id);
  const block = useBlock();

  if (person.isPending) return <Loading />;
  const p = person.data;
  if (!p) {
    return (
      <Centered>
        <Muted>{t('friends.notFound')}</Muted>
      </Centered>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: `@${p.username}` }} />
      <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.page}>
        <View style={styles.header}>
          <Avatar path={p.avatar_path} name={p.username} size={96} />
          <Text style={styles.username}>@{p.username}</Text>
          {p.id_verified_at && <Text style={[styles.verified, { color: colors.accent }]}>✓ {t('event.verified')}</Text>}
        </View>
        {p.bio ? <Text style={styles.bio}>{p.bio}</Text> : null}
        {relationship === 'friend' && <Muted>{t('friends.youAreFriends')}</Muted>}
        {relationship === 'incoming' && <Muted>{t('friends.wantsToBeFriends')}</Muted>}
        {relationship === 'self' ? (
          <Button label={t('profile.edit')} variant="secondary" onPress={() => router.navigate('/profile')} />
        ) : (
          <>
            <FriendButton personId={p.id} />
            {relationship !== 'blocked' && relationship !== null && (
              <Button
                label={t('friends.block')}
                variant="danger"
                loading={block.isPending}
                onPress={() =>
                  confirm(t('friends.blockConfirm', { username: p.username }), t('common.back'), t('friends.block'), () =>
                    block.mutate(p.id)
                  )
                }
              />
            )}
          </>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 16, width: '100%', maxWidth: 720, alignSelf: 'center' },
  header: { alignItems: 'center', gap: 8, paddingVertical: 8 },
  username: { fontSize: 24, fontWeight: 'bold' },
  verified: { fontSize: 15, fontWeight: '600' },
  bio: { fontSize: 16, lineHeight: 23 },
});
