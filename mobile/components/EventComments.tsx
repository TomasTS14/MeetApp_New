import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ReportButton } from '@/components/ReportButton';
import { Text, View } from '@/components/Themed';
import { Button, Muted, TextField, useColors } from '@/components/ui';
import { formatRelative } from '@/lib/dates';
import { errorText } from '@/lib/errors';
import { useDeleteComment, useEventComments, usePostComment } from '@/lib/queries';
import type { EventComment } from '@/lib/types';

type Props = { eventId: string; isOrganizer: boolean };

// Comments and questions. Everyone appears under their alias for this event, except
// friends, who see each other's usernames. Replies sit one level under their comment.
export function EventComments({ eventId, isOrganizer }: Props) {
  const { t } = useTranslation();
  const colors = useColors();
  const comments = useEventComments(eventId);
  const postComment = usePostComment(eventId);
  const deleteComment = useDeleteComment(eventId);
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<EventComment | null>(null);

  const all = comments.data ?? [];
  const topLevel = all.filter((c) => !c.reply_to);
  const repliesTo = (id: string) => all.filter((c) => c.reply_to === id);

  const renderComment = (comment: EventComment, isReply: boolean) => (
    <CommentRow
      key={comment.id}
      comment={comment}
      isReply={isReply}
      canDelete={!comment.is_deleted && (comment.is_mine || isOrganizer)}
      onReply={() => setReplyTo(isReply ? (all.find((c) => c.id === comment.reply_to) ?? comment) : comment)}
      onDelete={() => deleteComment.mutate(comment.id)}
    />
  );

  return (
    <View style={styles.section}>
      <Text style={styles.heading}>{t('comments.title')}</Text>
      <Muted style={styles.note}>{t('comments.aliasNote')}</Muted>

      {comments.isError && <Muted>{t('common.error')}</Muted>}
      {comments.isSuccess && all.length === 0 && <Muted>{t('comments.empty')}</Muted>}
      {topLevel.map((comment) => (
        <View key={comment.id} style={styles.thread}>
          {renderComment(comment, false)}
          {repliesTo(comment.id).map((reply) => renderComment(reply, true))}
        </View>
      ))}

      <View style={styles.composer}>
        {replyTo && (
          <View style={styles.replying}>
            <Muted>{t('comments.replyingTo', { name: replyTo.author_name })}</Muted>
            <Pressable accessibilityRole="button" onPress={() => setReplyTo(null)}>
              <Text style={{ color: colors.accent }}>{t('create.clear')}</Text>
            </Pressable>
          </View>
        )}
        <TextField
          label={t('comments.new')}
          placeholder={t('comments.placeholder')}
          value={draft}
          onChangeText={setDraft}
          multiline
          maxLength={2000}
          style={styles.input}
          error={postComment.isError ? errorText(t, postComment.error) : null}
        />
        <Button
          label={t('comments.post')}
          variant="secondary"
          disabled={!draft.trim()}
          loading={postComment.isPending}
          onPress={() =>
            postComment.mutate(
              { body: draft, replyTo: replyTo?.id },
              {
                onSuccess: () => {
                  setDraft('');
                  setReplyTo(null);
                },
              }
            )
          }
        />
      </View>
    </View>
  );
}

type RowProps = {
  comment: EventComment;
  isReply: boolean;
  canDelete: boolean;
  onReply: () => void;
  onDelete: () => void;
};

function CommentRow({ comment, isReply, canDelete, onReply, onDelete }: RowProps) {
  const { t, i18n } = useTranslation();
  const colors = useColors();

  const badges = [
    comment.author_is_organizer && t('event.organizer'),
    comment.author_is_friend && t('event.friend'),
    comment.author_is_verified && `✓ ${t('event.verified')}`,
    comment.is_mine && t('comments.you'),
  ].filter(Boolean);

  return (
    <View style={[styles.comment, isReply && [styles.reply, { borderColor: colors.border }]]}>
      <View style={styles.authorRow}>
        <Text style={styles.author}>{comment.author_name}</Text>
        {badges.map((badge) => (
          <Text key={badge as string} style={[styles.badge, { color: colors.accent }]}>
            {badge}
          </Text>
        ))}
      </View>
      {comment.is_deleted ? (
        <Muted style={styles.deleted}>{t('comments.deleted')}</Muted>
      ) : (
        <Text style={styles.body}>{comment.body}</Text>
      )}
      <View style={styles.actions}>
        <Muted style={styles.small}>{formatRelative(comment.created_at, i18n.language)}</Muted>
        {!comment.is_deleted && (
          <Pressable accessibilityRole="button" onPress={onReply}>
            <Text style={[styles.small, { color: colors.accent }]}>{t('comments.reply')}</Text>
          </Pressable>
        )}
        {canDelete && (
          <Pressable accessibilityRole="button" onPress={onDelete}>
            <Text style={[styles.small, { color: colors.danger }]}>{t('comments.delete')}</Text>
          </Pressable>
        )}
        {!comment.is_mine && !comment.is_deleted && (
          <ReportButton targetType="comment" targetId={comment.id} textStyle={styles.small} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12 },
  heading: { fontSize: 20, fontWeight: '700' },
  note: { fontSize: 13, marginTop: -6 },
  thread: { gap: 10 },
  comment: { gap: 4 },
  reply: { marginLeft: 16, paddingLeft: 12, borderLeftWidth: 2 },
  authorRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: 8 },
  author: { fontSize: 15, fontWeight: '700' },
  badge: { fontSize: 12, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 22 },
  deleted: { fontStyle: 'italic' },
  actions: { flexDirection: 'row', gap: 16 },
  small: { fontSize: 13 },
  composer: { gap: 8, marginTop: 4 },
  replying: { flexDirection: 'row', justifyContent: 'space-between' },
  input: { minHeight: 60, textAlignVertical: 'top' },
});
