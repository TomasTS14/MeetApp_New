import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text, View } from '@/components/Themed';
import { Muted, useColors } from '@/components/ui';
import { formatEventDate } from '@/lib/dates';
import { eventPhotoUrl } from '@/lib/supabase';
import type { EventCategory } from '@/lib/types';

type Props = {
  id: string;
  title: string;
  startsAt: string;
  areaLabel: string;
  category: EventCategory;
  coverPhotoPath: string | null;
  // Extra line under the date, such as the distance or the person's role.
  detail?: string;
  badge?: string;
  cancelled?: boolean;
};

export function EventCard({ id, title, startsAt, areaLabel, category, coverPhotoPath, detail, badge, cancelled }: Props) {
  const { t, i18n } = useTranslation();
  const colors = useColors();

  return (
    <Link href={{ pathname: '/event/[id]', params: { id } }} asChild>
      <Pressable
        accessibilityRole="link"
        style={({ pressed }) => [
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border },
          pressed && { opacity: 0.8 },
        ]}>
        {coverPhotoPath ? (
          <Image source={{ uri: eventPhotoUrl(coverPhotoPath) }} style={styles.cover} contentFit="cover" />
        ) : null}
        <View style={[styles.body, { backgroundColor: colors.card }]}>
          <View style={[styles.row, { backgroundColor: colors.card }]}>
            <Muted style={styles.category}>{t(`categories.${category}`)}</Muted>
            {badge ? <Text style={[styles.badge, { color: colors.accent }]}>{badge}</Text> : null}
          </View>
          <Text style={[styles.title, cancelled && styles.cancelled]} numberOfLines={2}>
            {title}
          </Text>
          <Muted>{formatEventDate(startsAt, i18n.language)}</Muted>
          <Muted>{[areaLabel, detail].filter(Boolean).join(' · ')}</Muted>
          {cancelled ? <Text style={{ color: colors.danger }}>{t('event.cancelled')}</Text> : null}
        </View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cover: {
    width: '100%',
    aspectRatio: 16 / 9,
    maxHeight: 220,
  },
  body: {
    padding: 14,
    gap: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  category: {
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  badge: {
    fontSize: 13,
    fontWeight: '600',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  cancelled: {
    textDecorationLine: 'line-through',
  },
});
