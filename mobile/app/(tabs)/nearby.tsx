import Slider from '@react-native-community/slider';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, ScrollView, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { EventCard } from '@/components/EventCard';
import { Text, View } from '@/components/Themed';
import { Button, Centered, Chip, Loading, Muted, useColors } from '@/components/ui';
import { dateFilterRange, dateFilters, type DateFilter } from '@/lib/dates';
import { useCurrentPosition } from '@/lib/location';
import { useNearbyEvents } from '@/lib/queries';
import { eventCategories, type EventCategory } from '@/lib/types';

const MIN_RADIUS_KM = 1;
const MAX_RADIUS_KM = 200;
const DEFAULT_RADIUS_KM = 10;

// Phase 1 shows Nearby as a list; the swipe cards replace it in phase 2.
export default function NearbyScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const position = useCurrentPosition();
  // The label follows the slider while dragging; the search runs when it is released.
  const [draftRadius, setDraftRadius] = useState(DEFAULT_RADIUS_KM);
  const [radiusKm, setRadiusKm] = useState(DEFAULT_RADIUS_KM);
  const [dateFilter, setDateFilter] = useState<DateFilter>('any');
  const [categories, setCategories] = useState<EventCategory[]>([]);

  const filters = useMemo(() => {
    if (position.status === 'loading') return null;
    const range = dateFilterRange(dateFilter);
    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      radiusKm,
      startsAfter: range.from,
      startsBefore: range.to,
      categories,
    };
  }, [position, radiusKm, dateFilter, categories]);

  const events = useNearbyEvents(filters);

  const toggleCategory = (category: EventCategory) =>
    setCategories((current) =>
      current.includes(category) ? current.filter((c) => c !== category) : [...current, category]
    );

  const header = (
    <View style={styles.header}>
      <Text style={styles.radius}>{t('nearby.radius', { km: draftRadius })}</Text>
      <Slider
        accessibilityLabel={t('nearby.radius', { km: draftRadius })}
        minimumValue={MIN_RADIUS_KM}
        maximumValue={MAX_RADIUS_KM}
        step={1}
        value={radiusKm}
        onValueChange={setDraftRadius}
        onSlidingComplete={(value) => {
          setDraftRadius(value);
          setRadiusKm(value);
        }}
        minimumTrackTintColor={colors.accent}
        maximumTrackTintColor={colors.border}
        thumbTintColor={colors.accent}
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {dateFilters.map((filter) => (
          <Chip
            key={filter}
            label={t(`dates.${filter}`)}
            selected={dateFilter === filter}
            onPress={() => setDateFilter(filter)}
          />
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {eventCategories.map((category) => (
          <Chip
            key={category}
            label={t(`categories.${category}`)}
            selected={categories.includes(category)}
            onPress={() => toggleCategory(category)}
          />
        ))}
      </ScrollView>
      {position.status === 'denied' && <Muted>{t('nearby.locationDenied')}</Muted>}
    </View>
  );

  if (position.status === 'loading') {
    return (
      <Centered>
        <ActivityIndicator />
        <Muted>{t('nearby.locating')}</Muted>
      </Centered>
    );
  }

  return (
    <FlatList
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.list}
      data={events.data ?? []}
      keyExtractor={(event) => event.id}
      ListHeaderComponent={header}
      refreshControl={<RefreshControl refreshing={events.isRefetching} onRefresh={() => void events.refetch()} />}
      renderItem={({ item }) => (
        <EventCard
          id={item.id}
          title={item.title}
          startsAt={item.starts_at}
          areaLabel={item.area_label}
          category={item.category}
          coverPhotoPath={item.cover_photo_path}
          detail={t('nearby.distance', { km: item.distance_km })}
          badge={item.my_rsvp && item.my_rsvp !== 'no' ? t(`myEvents.role.${item.my_rsvp}`) : undefined}
        />
      )}
      ListEmptyComponent={
        events.isPending ? (
          <Loading />
        ) : events.isError ? (
          <View style={styles.empty}>
            <Muted>{t('common.error')}</Muted>
            <Button label={t('common.retry')} variant="secondary" onPress={() => events.refetch()} />
          </View>
        ) : (
          <View style={styles.empty}>
            <Muted>{t('nearby.empty')}</Muted>
          </View>
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  list: {
    padding: 16,
    gap: 16,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  header: {
    gap: 12,
    marginBottom: 4,
  },
  radius: {
    fontSize: 16,
    fontWeight: '600',
  },
  chips: {
    gap: 8,
  },
  empty: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 32,
  },
});
