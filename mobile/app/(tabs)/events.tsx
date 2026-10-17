import { router } from 'expo-router';
import { RefreshControl, SectionList, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { EventCard } from '@/components/EventCard';
import { Text, View } from '@/components/Themed';
import { Button, Loading, Muted, useColors } from '@/components/ui';
import { useMyEvents } from '@/lib/queries';

export default function YourEventsScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const events = useMyEvents();

  const all = events.data ?? [];
  const sections = [
    { key: 'organizing', title: t('myEvents.organizing'), data: all.filter((e) => e.my_role === 'organizer') },
    { key: 'attending', title: t('myEvents.attending'), data: all.filter((e) => e.my_role !== 'organizer') },
  ].filter((section) => section.data.length > 0);

  return (
    <SectionList
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.list}
      sections={sections}
      keyExtractor={(event) => event.id}
      stickySectionHeadersEnabled={false}
      refreshControl={<RefreshControl refreshing={events.isRefetching} onRefresh={() => void events.refetch()} />}
      ListHeaderComponent={<Button label={t('myEvents.create')} onPress={() => router.push('/event/new')} />}
      renderSectionHeader={({ section }) => <Text style={styles.section}>{section.title}</Text>}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      renderItem={({ item }) => (
        <EventCard
          id={item.id}
          title={item.title}
          startsAt={item.starts_at}
          areaLabel={item.area_label}
          category={item.category}
          coverPhotoPath={item.cover_photo_path}
          badge={t(`myEvents.role.${item.my_role}`)}
          cancelled={!!item.cancelled_at}
        />
      )}
      ListEmptyComponent={
        events.isPending ? (
          <Loading />
        ) : (
          <View style={styles.empty}>
            <Muted>{events.isError ? t('common.error') : t('myEvents.empty')}</Muted>
          </View>
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  list: {
    padding: 16,
    gap: 8,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  section: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  separator: { height: 16 },
  empty: { alignItems: 'center', paddingVertical: 32 },
});
