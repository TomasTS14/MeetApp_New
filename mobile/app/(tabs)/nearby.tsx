import Slider from '@react-native-community/slider';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, ScrollView, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { EventCard } from '@/components/EventCard';
import { SwipeDeck, type SwipeAnswer } from '@/components/SwipeDeck';
import { Text, View } from '@/components/Themed';
import { Button, Centered, Chip, Loading, Muted, useColors } from '@/components/ui';
import { dateFilterRange, dateFilters, type DateFilter } from '@/lib/dates';
import { useCurrentPosition } from '@/lib/location';
import { useAnswerEvent, useClearRsvp, useNearbyEvents } from '@/lib/queries';
import { eventCategories, type EventCategory, type NearbyEvent } from '@/lib/types';

const MIN_RADIUS_KM = 1;
const MAX_RADIUS_KM = 200;
const DEFAULT_RADIUS_KM = 10;

type Mode = 'cards' | 'list';

export default function NearbyScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const position = useCurrentPosition();
  const [mode, setMode] = useState<Mode>('cards');
  // The label follows the slider while dragging; the search runs when it is released.
  const [draftRadius, setDraftRadius] = useState(DEFAULT_RADIUS_KM);
  const [radiusKm, setRadiusKm] = useState(DEFAULT_RADIUS_KM);
  const [dateFilter, setDateFilter] = useState<DateFilter>('any');
  const [categories, setCategories] = useState<EventCategory[]>([]);
  // Cards answered in this visit leave the deck straight away; the last one can be undone.
  const [answered, setAnswered] = useState<Set<string>>(new Set());
  const [lastAnswered, setLastAnswered] = useState<string | null>(null);
  const answer = useAnswerEvent();
  const clearRsvp = useClearRsvp();

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
  // The deck only holds events without an answer; answered ones live in Your events.
  const deck = (events.data ?? []).filter((event) => !event.my_rsvp && !answered.has(event.id));

  const toggleCategory = (category: EventCategory) =>
    setCategories((current) =>
      current.includes(category) ? current.filter((c) => c !== category) : [...current, category]
    );

  const forget = (eventId: string) =>
    setAnswered((current) => {
      const next = new Set(current);
      next.delete(eventId);
      return next;
    });

  const handleAnswer = (event: NearbyEvent, status: SwipeAnswer) => {
    setAnswered((current) => new Set(current).add(event.id));
    setLastAnswered(event.id);
    answer.mutate(
      { eventId: event.id, status },
      {
        onError: () => {
          forget(event.id);
          setLastAnswered(null);
        },
      }
    );
  };

  const undo = () => {
    const eventId = lastAnswered;
    if (!eventId) return;
    clearRsvp.mutate(eventId, {
      onSuccess: () => {
        forget(eventId);
        setLastAnswered(null);
      },
    });
  };

  const openEvent = (event: NearbyEvent) => router.push({ pathname: '/event/[id]', params: { id: event.id } });

  const filtersView = (
    <View style={styles.filters}>
      <View style={styles.modeRow}>
        <Text style={styles.radius}>{t('nearby.radius', { km: draftRadius })}</Text>
        <View style={styles.modes}>
          {(['cards', 'list'] as const).map((m) => (
            <Chip key={m} label={t(`nearby.${m}`)} selected={mode === m} onPress={() => setMode(m)} />
          ))}
        </View>
      </View>
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

  const failed = (
    <View style={styles.empty}>
      <Muted>{t('common.error')}</Muted>
      <Button label={t('common.retry')} variant="secondary" onPress={() => void events.refetch()} />
    </View>
  );

  if (mode === 'cards') {
    return (
      <View style={styles.page}>
        <View style={styles.cardsPage}>
          {filtersView}
          {events.isPending ? (
            <Loading />
          ) : events.isError ? (
            failed
          ) : deck.length === 0 ? (
            <View style={[styles.empty, styles.flex]}>
              <Muted>{t('nearby.deckEmpty')}</Muted>
            </View>
          ) : (
            <SwipeDeck events={deck} onAnswer={handleAnswer} onOpen={openEvent} />
          )}
          {answer.isError && <Text style={{ color: colors.danger }}>{t('common.error')}</Text>}
          <View style={styles.actions}>
            <Button
              label={t('nearby.undo')}
              variant="secondary"
              onPress={undo}
              disabled={!lastAnswered}
              loading={clearRsvp.isPending}
              style={styles.action}
            />
            {(['no', 'interested', 'yes'] as const).map((status) => (
              <Button
                key={status}
                label={t(`nearby.answer${status === 'no' ? 'No' : status === 'yes' ? 'Yes' : 'Interested'}`)}
                variant={status === 'yes' ? 'primary' : status === 'no' ? 'danger' : 'secondary'}
                disabled={deck.length === 0}
                onPress={() => deck[0] && handleAnswer(deck[0], status)}
                style={styles.action}
              />
            ))}
          </View>
        </View>
      </View>
    );
  }

  return (
    <FlatList
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.list}
      data={events.data ?? []}
      keyExtractor={(event) => event.id}
      ListHeaderComponent={filtersView}
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
          failed
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
  flex: { flex: 1 },
  page: { flex: 1 },
  cardsPage: {
    flex: 1,
    padding: 16,
    gap: 16,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  list: {
    padding: 16,
    gap: 16,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  filters: {
    gap: 10,
  },
  modeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  modes: {
    flexDirection: 'row',
    gap: 6,
  },
  radius: {
    fontSize: 16,
    fontWeight: '600',
  },
  chips: {
    gap: 8,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  action: {
    flex: 1,
    paddingHorizontal: 6,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 32,
  },
});
