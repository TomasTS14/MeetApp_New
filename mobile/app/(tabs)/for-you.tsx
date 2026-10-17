import { Link, router } from 'expo-router';
import { FlatList, Pressable, RefreshControl, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Avatar } from '@/components/Avatar';
import { Text, View } from '@/components/Themed';
import { Button, Loading, Muted, useColors } from '@/components/ui';
import { formatRelative } from '@/lib/dates';
import { useForYouFeed, useFriends } from '@/lib/social';

export default function ForYouScreen() {
  const { t, i18n } = useTranslation();
  const colors = useColors();
  const feed = useForYouFeed();
  const friends = useFriends();
  const requests = friends.data?.incoming.length ?? 0;

  const header = (
    <Button
      label={requests > 0 ? t('forYou.friendsWithRequests', { count: requests }) : t('friends.title')}
      variant={requests > 0 ? 'primary' : 'secondary'}
      onPress={() => router.push('/friends')}
    />
  );

  return (
    <FlatList
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.list}
      data={feed.data ?? []}
      keyExtractor={(item, index) => `${item.kind}-${item.event_id}-${item.occurred_at}-${index}`}
      ListHeaderComponent={header}
      refreshControl={<RefreshControl refreshing={feed.isRefetching} onRefresh={() => void feed.refetch()} />}
      ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: colors.border }]} />}
      renderItem={({ item }) => {
        const who = item.friend_username ? `@${item.friend_username}` : '';
        const headline =
          item.kind === 'event_update'
            ? t('forYou.update', { event: item.event_title })
            : item.kind === 'friend_comment'
              ? t('forYou.comment', { who, event: item.event_title })
              : t(item.rsvp_status === 'yes' ? 'forYou.going' : 'forYou.interested', { who, event: item.event_title });
        return (
          <Link href={{ pathname: '/event/[id]', params: { id: item.event_id } }} asChild>
            <Pressable accessibilityRole="link" style={styles.item}>
              {item.kind === 'event_update' ? (
                <View style={[styles.updateMark, { backgroundColor: colors.accent }]}>
                  <Text style={[styles.updateMarkText, { color: colors.onAccent }]}>!</Text>
                </View>
              ) : (
                <Avatar path={item.friend_avatar_path} name={item.friend_username ?? '?'} />
              )}
              <View style={styles.text}>
                <Text style={styles.headline}>{headline}</Text>
                {item.body ? (
                  <Text style={styles.body} numberOfLines={3}>
                    {item.body}
                  </Text>
                ) : null}
                <Muted style={styles.time}>{formatRelative(item.occurred_at, i18n.language)}</Muted>
              </View>
            </Pressable>
          </Link>
        );
      }}
      ListEmptyComponent={
        feed.isPending ? (
          <Loading />
        ) : (
          <View style={styles.empty}>
            <Muted>{feed.isError ? t('common.error') : t('forYou.empty')}</Muted>
          </View>
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, gap: 12, width: '100%', maxWidth: 720, alignSelf: 'center' },
  separator: { height: StyleSheet.hairlineWidth },
  item: { flexDirection: 'row', gap: 12, paddingVertical: 6 },
  updateMark: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  updateMarkText: { fontSize: 20, fontWeight: '800' },
  text: { flex: 1, gap: 3 },
  headline: { fontSize: 15, fontWeight: '600', lineHeight: 20 },
  body: { fontSize: 15, lineHeight: 21 },
  time: { fontSize: 13 },
  empty: { alignItems: 'center', paddingVertical: 32 },
});
