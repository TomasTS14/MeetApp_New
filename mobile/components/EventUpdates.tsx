import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ReportButton } from '@/components/ReportButton';
import { Text, View } from '@/components/Themed';
import { Button, Muted, TextField, useColors } from '@/components/ui';
import { formatRelative } from '@/lib/dates';
import { errorText } from '@/lib/errors';
import { useDeleteUpdate, useEventUpdates, usePostUpdate } from '@/lib/queries';

type Props = { eventId: string; isOrganizer: boolean };

// The organizer's announcements, newest first, kept apart from the comments.
export function EventUpdates({ eventId, isOrganizer }: Props) {
  const { t, i18n } = useTranslation();
  const colors = useColors();
  const updates = useEventUpdates(eventId);
  const postUpdate = usePostUpdate(eventId);
  const deleteUpdate = useDeleteUpdate(eventId);
  const [draft, setDraft] = useState('');

  const list = updates.data ?? [];
  if (!isOrganizer && list.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.heading}>{t('updates.title')}</Text>
      {isOrganizer && (
        <View style={styles.composer}>
          <TextField
            label={t('updates.new')}
            hint={t('updates.hint')}
            value={draft}
            onChangeText={setDraft}
            multiline
            maxLength={4000}
            style={styles.input}
            error={postUpdate.isError ? errorText(t, postUpdate.error) : null}
          />
          <Button
            label={t('updates.post')}
            disabled={!draft.trim()}
            loading={postUpdate.isPending}
            onPress={() => postUpdate.mutate(draft, { onSuccess: () => setDraft('') })}
          />
        </View>
      )}
      {list.map((update) => (
        <View key={update.id} style={[styles.update, { borderColor: colors.accent, backgroundColor: colors.card }]}>
          <Text style={styles.body}>{update.body}</Text>
          <View style={[styles.meta, { backgroundColor: colors.card }]}>
            <Muted style={styles.time}>{formatRelative(update.created_at, i18n.language)}</Muted>
            {isOrganizer ? (
              <Pressable accessibilityRole="button" onPress={() => deleteUpdate.mutate(update.id)}>
                <Text style={[styles.time, { color: colors.danger }]}>{t('comments.delete')}</Text>
              </Pressable>
            ) : (
              <ReportButton targetType="event_update" targetId={update.id} textStyle={styles.time} />
            )}
          </View>
        </View>
      ))}
      {isOrganizer && list.length === 0 && <Muted>{t('updates.empty')}</Muted>}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  heading: { fontSize: 20, fontWeight: '700' },
  composer: { gap: 8 },
  input: { minHeight: 70, textAlignVertical: 'top' },
  update: { borderLeftWidth: 3, borderRadius: 8, padding: 12, gap: 6 },
  body: { fontSize: 16, lineHeight: 22 },
  meta: { flexDirection: 'row', justifyContent: 'space-between' },
  time: { fontSize: 13 },
});
