import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';

import { EventComments } from '@/components/EventComments';
import { EventInvites } from '@/components/EventInvites';
import { EventUpdates } from '@/components/EventUpdates';
import { ReportButton } from '@/components/ReportButton';
import { Text, View } from '@/components/Themed';
import { Button, Centered, Loading, Muted, useColors } from '@/components/ui';
import { addToCalendar } from '@/lib/calendar';
import { formatEventDate } from '@/lib/dates';
import { useAcceptInvite } from '@/lib/invites';
import { clearPendingLink } from '@/lib/pendingLink';
import { useCancelEvent, useEvent, useSetRsvp } from '@/lib/queries';
import { shareEvent } from '@/lib/share';
import { eventPhotoUrl } from '@/lib/supabase';
import type { RsvpStatus } from '@/lib/types';

const answers: Exclude<RsvpStatus, 'waitlisted'>[] = ['yes', 'interested', 'no'];

function confirm(message: string, back: string, action: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(message)) onConfirm();
    return;
  }
  Alert.alert(message, undefined, [
    { text: back, style: 'cancel' },
    { text: action, style: 'destructive', onPress: onConfirm },
  ]);
}

export default function EventScreen() {
  // "invite" carries the code from a private event's invite link.
  const { id, invite } = useLocalSearchParams<{ id: string; invite?: string }>();
  const { t, i18n } = useTranslation();
  const colors = useColors();
  const { width } = useWindowDimensions();
  const acceptInvite = useAcceptInvite(id);
  const { mutate: accept } = acceptInvite;
  // With an invite link, load the event only once the invite is accepted. A load started
  // alongside it can finish first and cache "not found".
  const event = useEvent(id, !invite || acceptInvite.isSuccess || acceptInvite.isError);
  const setRsvp = useSetRsvp(id);
  const cancelEvent = useCancelEvent(id);
  const [shareNote, setShareNote] = useState<'copied' | 'failed' | null>(null);

  useEffect(() => {
    clearPendingLink();
    if (invite) accept(invite);
  }, [invite, accept]);

  if (event.isPending || acceptInvite.isPending) return <Loading />;
  if (event.isError) {
    return (
      <Centered>
        <Muted>{t('common.error')}</Muted>
        <Button label={t('common.retry')} variant="secondary" onPress={() => event.refetch()} />
      </Centered>
    );
  }
  const e = event.data;
  if (!e) {
    return (
      <Centered>
        <Muted>{acceptInvite.data === false ? t('invites.badLink') : t('event.notFound')}</Muted>
      </Centered>
    );
  }

  const cancelled = !!e.cancelled_at;
  const spotsLeft = e.max_participants === null ? null : Math.max(e.max_participants - e.going_count, 0);
  const photoWidth = Math.min(width, 720);
  // While waitlisted, the "Going" button stays selected: the person asked for a spot.
  const selected = e.my_rsvp === 'waitlisted' ? 'yes' : e.my_rsvp;

  const share = async () => {
    setShareNote(null);
    try {
      const result = await shareEvent(id, e.title);
      if (result === 'copied') setShareNote('copied');
    } catch {
      setShareNote('failed');
    }
  };
  const calendar = async () => {
    setShareNote(null);
    try {
      await addToCalendar({ ...e, id });
    } catch {
      setShareNote('failed');
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: e.title }} />
      <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.page}>
        {e.photo_paths.length > 0 && (
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
            {e.photo_paths.map((path) => (
              <Image
                key={path}
                source={{ uri: eventPhotoUrl(path) }}
                style={{ width: photoWidth, height: (photoWidth * 9) / 16 }}
                contentFit="cover"
              />
            ))}
          </ScrollView>
        )}

        <View style={styles.content}>
          <Muted style={styles.category}>
            {t(`categories.${e.category}`)}
            {e.visibility === 'private' ? ` · ${t('invites.private')}` : ''}
          </Muted>
          <Text style={[styles.title, cancelled && styles.cancelledTitle]}>{e.title}</Text>
          {cancelled && <Text style={{ color: colors.danger }}>{t('event.cancelled')}</Text>}

          <View style={styles.facts}>
            <Text style={styles.fact}>
              {formatEventDate(e.starts_at, i18n.language)}
              {e.ends_at ? ` – ${formatEventDate(e.ends_at, i18n.language)}` : ''}
            </Text>
            <Text style={styles.fact}>{e.address ?? e.area_label}</Text>
            {!e.address && <Muted>{t('event.addressHidden')}</Muted>}
            <Text style={styles.fact}>
              {[
                t('event.going', { count: e.going_count }),
                spotsLeft === null ? null : spotsLeft > 0 ? t('event.spotsLeft', { count: spotsLeft }) : t('event.full'),
                e.waitlist_count > 0 ? t('event.waitlist', { count: e.waitlist_count }) : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          </View>

          {!cancelled && (
            <View style={styles.shareRow}>
              {/* A private event is shared through its invite link, below. */}
              {e.visibility === 'public' && (
                <Button label={t('event.share')} variant="secondary" onPress={share} style={styles.answer} />
              )}
              <Button label={t('event.addToCalendar')} variant="secondary" onPress={calendar} style={styles.answer} />
            </View>
          )}
          {shareNote === 'copied' && <Muted>{t('event.linkCopied')}</Muted>}
          {shareNote === 'failed' && <Text style={{ color: colors.danger }}>{t('common.error')}</Text>}

          <View style={[styles.organizer, { borderColor: colors.border }]}>
            <Muted>{t('event.organizer')}</Muted>
            <Text style={styles.organizerName}>{e.organizer_name ?? '—'}</Text>
            <View style={styles.badges}>
              {e.organizer_is_verified && (
                <Text style={[styles.badge, { color: colors.accent }]}>✓ {t('event.verified')}</Text>
              )}
              {e.organizer_is_friend && <Text style={[styles.badge, { color: colors.accent }]}>{t('event.friend')}</Text>}
            </View>
          </View>

          {e.description ? <Text style={styles.description}>{e.description}</Text> : null}

          {e.is_organizer ? (
            <View style={styles.actions}>
              <Muted>{t('event.youOrganize')}</Muted>
              {!cancelled && (
                <Button
                  label={t('edit.title')}
                  variant="secondary"
                  onPress={() => router.push({ pathname: '/event/edit/[id]', params: { id } })}
                />
              )}
              {!cancelled && (
                <Button
                  label={t('event.cancel')}
                  variant="danger"
                  loading={cancelEvent.isPending}
                  onPress={() => confirm(t('event.cancelConfirm'), t('common.back'), t('event.cancel'), () => cancelEvent.mutate())}
                />
              )}
            </View>
          ) : (
            !cancelled && (
              <View style={styles.actions}>
                <View style={styles.answerRow}>
                  {answers.map((answer) => (
                    <Button
                      key={answer}
                      label={t(`event.${answer}`)}
                      variant={selected === answer ? 'primary' : 'secondary'}
                      style={styles.answer}
                      disabled={setRsvp.isPending}
                      onPress={() => setRsvp.mutate(answer)}
                    />
                  ))}
                </View>
                {e.my_rsvp === 'waitlisted' && <Muted>{t('event.waitlisted')}</Muted>}
                {setRsvp.isError && <Text style={{ color: colors.danger }}>{t('common.error')}</Text>}
              </View>
            )
          )}

          {e.is_organizer && e.visibility === 'private' && !cancelled && <EventInvites eventId={id} title={e.title} />}
          <EventUpdates eventId={id} isOrganizer={e.is_organizer} />
          <EventComments eventId={id} isOrganizer={e.is_organizer} />
          {!e.is_organizer && <ReportButton targetType="event" targetId={id} look="button" />}
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  page: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    paddingBottom: 32,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  category: {
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: -12,
  },
  title: { fontSize: 26, fontWeight: 'bold' },
  cancelledTitle: { textDecorationLine: 'line-through' },
  facts: { gap: 6 },
  fact: { fontSize: 16 },
  organizer: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    paddingVertical: 12,
    gap: 2,
  },
  organizerName: { fontSize: 17, fontWeight: '600' },
  badges: { flexDirection: 'row', gap: 12 },
  badge: { fontSize: 14, fontWeight: '600' },
  description: { fontSize: 16, lineHeight: 23 },
  actions: { gap: 10 },
  answerRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  answer: { flexGrow: 1 },
  shareRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
});
