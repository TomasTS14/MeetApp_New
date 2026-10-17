import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { PersonRow } from '@/components/PersonRow';
import { Text, View } from '@/components/Themed';
import { Button, Muted, useColors } from '@/components/ui';
import { useInviteCode, useInviteFriend, useInvitees, useUninvite } from '@/lib/invites';
import { shareEvent } from '@/lib/share';
import { useFriends } from '@/lib/social';

// For the organizer of a private event: the invite link, friends to invite, and who has
// been invited with their answer so far.
export function EventInvites({ eventId, title }: { eventId: string; title: string }) {
  const { t } = useTranslation();
  const colors = useColors();
  const code = useInviteCode(eventId, true);
  const invitees = useInvitees(eventId, true);
  const friends = useFriends();
  const invite = useInviteFriend(eventId);
  const uninvite = useUninvite(eventId);
  const [note, setNote] = useState<'copied' | 'failed' | null>(null);

  const invitedIds = new Set((invitees.data ?? []).map((i) => i.user_id));
  const notInvited = (friends.data?.friends ?? []).filter((f) => !invitedIds.has(f.id));

  const shareLink = async () => {
    setNote(null);
    try {
      if ((await shareEvent(eventId, title, code.data)) === 'copied') setNote('copied');
    } catch {
      setNote('failed');
    }
  };

  const compact = styles.compact;
  return (
    <View style={[styles.section, { borderColor: colors.border }]}>
      <Text style={styles.heading}>{t('invites.title')}</Text>
      <Muted>{t('invites.hint')}</Muted>
      <Button label={t('invites.shareLink')} variant="secondary" onPress={shareLink} disabled={!code.data} />
      {note === 'copied' && <Muted>{t('invites.linkCopied')}</Muted>}
      {note === 'failed' && <Text style={{ color: colors.danger }}>{t('common.error')}</Text>}

      {(invitees.data ?? []).length > 0 && <Text style={styles.subheading}>{t('invites.invited')}</Text>}
      {(invitees.data ?? []).map((person) => (
        <PersonRow
          key={person.user_id}
          person={{ id: person.user_id, username: person.username, avatar_path: person.avatar_path, bio: '', id_verified_at: null }}
          actions={
            <>
              <Muted>{person.rsvp ? t(`invites.answer.${person.rsvp}`) : t('invites.answer.none')}</Muted>
              <Button
                label={t('invites.remove')}
                variant="secondary"
                onPress={() => uninvite.mutate(person.user_id)}
                disabled={uninvite.isPending}
                style={compact}
              />
            </>
          }
        />
      ))}

      {notInvited.length > 0 && <Text style={styles.subheading}>{t('invites.friends')}</Text>}
      {notInvited.map((person) => (
        <PersonRow
          key={person.id}
          person={person}
          actions={
            <Button
              label={t('invites.invite')}
              onPress={() => invite.mutate(person.id)}
              disabled={invite.isPending}
              style={compact}
            />
          }
        />
      ))}
      {friends.isSuccess && friends.data.friends.length === 0 && <Muted>{t('invites.noFriends')}</Muted>}
      {(invite.isError || uninvite.isError) && <Text style={{ color: colors.danger }}>{t('common.error')}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 10, borderTopWidth: 1, paddingTop: 16 },
  heading: { fontSize: 20, fontWeight: '700' },
  subheading: { fontSize: 15, fontWeight: '700', marginTop: 4 },
  compact: { minHeight: 36, paddingHorizontal: 14 },
});
