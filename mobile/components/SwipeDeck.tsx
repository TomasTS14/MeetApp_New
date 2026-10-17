import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Text, View } from '@/components/Themed';
import { Muted, useColors } from '@/components/ui';
import { formatEventDate } from '@/lib/dates';
import { eventPhotoUrl } from '@/lib/supabase';
import type { NearbyEvent } from '@/lib/types';

export type SwipeAnswer = 'yes' | 'no' | 'interested';

// How far a card has to travel before letting go counts as an answer.
const SWIPE_THRESHOLD = 110;

type CardProps = {
  event: NearbyEvent;
  onAnswer: (answer: SwipeAnswer) => void;
  onOpen: () => void;
};

// The top card: drag right for yes, left for no, up for interested.
function SwipeCard({ event, onAnswer, onOpen }: CardProps) {
  const { t, i18n } = useTranslation();
  const colors = useColors();
  const { width } = useWindowDimensions();
  // With "reduce motion" on, the springs and fly-outs finish at once (Reanimated follows
  // the system setting) and the card stays upright while dragged.
  const reduceMotion = useReducedMotion();
  const x = useSharedValue(0);
  const y = useSharedValue(0);

  const pan = usePanGesture({
    onUpdate: (e) => {
      x.value = e.translationX;
      y.value = e.translationY;
    },
    onDeactivate: (e) => {
      const answer: SwipeAnswer | null =
        e.translationX > SWIPE_THRESHOLD
          ? 'yes'
          : e.translationX < -SWIPE_THRESHOLD
            ? 'no'
            : e.translationY < -SWIPE_THRESHOLD
              ? 'interested'
              : null;
      if (!answer) {
        x.value = withSpring(0);
        y.value = withSpring(0);
        return;
      }
      const done = (finished?: boolean) => {
        'worklet';
        if (finished) scheduleOnRN(onAnswer, answer);
      };
      if (answer === 'interested') {
        y.value = withTiming(-1.5 * width, { duration: 220 }, done);
      } else {
        x.value = withTiming((answer === 'yes' ? 1.5 : -1.5) * width, { duration: 220 }, done);
      }
    },
  });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value },
      { translateY: y.value },
      { rotate: reduceMotion ? '0deg' : `${interpolate(x.value, [-width, width], [-12, 12])}deg` },
    ],
  }));
  const yesStyle = useAnimatedStyle(() => ({ opacity: interpolate(x.value, [0, SWIPE_THRESHOLD], [0, 1], 'clamp') }));
  const noStyle = useAnimatedStyle(() => ({ opacity: interpolate(x.value, [-SWIPE_THRESHOLD, 0], [1, 0], 'clamp') }));
  const interestedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(y.value, [-SWIPE_THRESHOLD, 0], [1, 0], 'clamp'),
  }));

  const spotsLeft = event.max_participants === null ? null : Math.max(event.max_participants - event.going_count, 0);

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, cardStyle]}
        accessibilityHint={t('nearby.swipeHint')}>
        {event.cover_photo_path ? (
          <Image source={{ uri: eventPhotoUrl(event.cover_photo_path) }} style={styles.photo} contentFit="cover" />
        ) : (
          <View style={[styles.photo, styles.noPhoto, { backgroundColor: colors.accent }]}>
            <Text style={[styles.noPhotoLabel, { color: colors.onAccent }]}>{t(`categories.${event.category}`)}</Text>
          </View>
        )}
        <View style={[styles.body, { backgroundColor: colors.card }]}>
          <Muted style={styles.category}>{t(`categories.${event.category}`)}</Muted>
          <Text style={styles.title} numberOfLines={2}>
            {event.title}
          </Text>
          <Text style={styles.line}>{formatEventDate(event.starts_at, i18n.language)}</Text>
          <Muted>{[event.area_label, t('nearby.distance', { km: event.distance_km })].join(' · ')}</Muted>
          <Muted>
            {[
              t('event.going', { count: event.going_count }),
              spotsLeft === null ? null : spotsLeft > 0 ? t('event.spotsLeft', { count: spotsLeft }) : t('event.full'),
              event.organizer_is_verified ? `✓ ${t('event.verified')}` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Muted>
          <Pressable accessibilityRole="link" onPress={onOpen} style={styles.details}>
            <Text style={[styles.detailsLabel, { color: colors.accent }]}>{t('nearby.details')}</Text>
          </Pressable>
        </View>
        <Animated.View style={[styles.stamp, styles.stampYes, { borderColor: colors.accent }, yesStyle]}>
          <Text style={[styles.stampLabel, { color: colors.accent }]}>{t('event.yes')}</Text>
        </Animated.View>
        <Animated.View style={[styles.stamp, styles.stampNo, { borderColor: colors.danger }, noStyle]}>
          <Text style={[styles.stampLabel, { color: colors.danger }]}>{t('event.no')}</Text>
        </Animated.View>
        <Animated.View style={[styles.stamp, styles.stampInterested, { borderColor: colors.text }, interestedStyle]}>
          <Text style={styles.stampLabel}>{t('event.interested')}</Text>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

type DeckProps = {
  events: NearbyEvent[];
  onAnswer: (event: NearbyEvent, answer: SwipeAnswer) => void;
  onOpen: (event: NearbyEvent) => void;
};

export function SwipeDeck({ events, onAnswer, onOpen }: DeckProps) {
  const colors = useColors();
  const [top, next] = events;

  return (
    <View style={styles.deck}>
      {next && (
        <View style={[styles.card, styles.behind, { backgroundColor: colors.card, borderColor: colors.border }]} />
      )}
      {top && (
        // Keyed by event so each card starts from the centre with its own drag position.
        <SwipeCard key={top.id} event={top} onAnswer={(answer) => onAnswer(top, answer)} onOpen={() => onOpen(top)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  deck: {
    flex: 1,
    minHeight: 380,
  },
  card: {
    ...StyleSheet.absoluteFill,
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  behind: {
    transform: [{ scale: 0.95 }, { translateY: 10 }],
  },
  photo: {
    flex: 1,
    minHeight: 140,
  },
  noPhoto: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  noPhotoLabel: {
    fontSize: 28,
    fontWeight: '700',
  },
  body: {
    padding: 16,
    gap: 4,
  },
  category: {
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  line: {
    fontSize: 16,
  },
  details: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    marginTop: 4,
  },
  detailsLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  stamp: {
    position: 'absolute',
    top: 24,
    borderWidth: 3,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'transparent',
  },
  stampYes: { left: 20, transform: [{ rotate: '-12deg' }] },
  stampNo: { right: 20, transform: [{ rotate: '12deg' }] },
  stampInterested: { left: '25%', right: '25%', top: 40, alignItems: 'center' },
  stampLabel: {
    fontSize: 22,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
});
