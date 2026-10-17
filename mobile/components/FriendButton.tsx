import { StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui';
import { isRateLimited } from '@/lib/errors';
import {
  useAnswerFriendRequest,
  useRelationship,
  useRemoveFriend,
  useSendFriendRequest,
  useUnblock,
} from '@/lib/social';

// The one action that fits where you stand with this person.
export function FriendButton({ personId, compact }: { personId: string; compact?: boolean }) {
  const { t } = useTranslation();
  const relationship = useRelationship(personId);
  const send = useSendFriendRequest();
  const answer = useAnswerFriendRequest();
  const remove = useRemoveFriend();
  const unblock = useUnblock();
  const style = compact ? styles.compact : undefined;

  switch (relationship) {
    case 'none':
      return (
        <Button
          label={isRateLimited(send.error) ? t('friends.tryLater') : t('friends.add')}
          onPress={() => send.mutate(personId)}
          loading={send.isPending}
          style={style}
        />
      );
    case 'incoming':
      return (
        <Button
          label={t('friends.accept')}
          onPress={() => answer.mutate({ personId, accept: true })}
          loading={answer.isPending}
          style={style}
        />
      );
    case 'outgoing':
      return (
        <Button
          label={t('friends.requested')}
          variant="secondary"
          onPress={() => remove.mutate(personId)}
          loading={remove.isPending}
          style={style}
        />
      );
    case 'friend':
      return (
        <Button
          label={t('friends.unfriend')}
          variant="secondary"
          onPress={() => remove.mutate(personId)}
          loading={remove.isPending}
          style={style}
        />
      );
    case 'blocked':
      return (
        <Button
          label={t('friends.unblock')}
          variant="secondary"
          onPress={() => unblock.mutate(personId)}
          loading={unblock.isPending}
          style={style}
        />
      );
    default:
      return null;
  }
}

const styles = StyleSheet.create({
  compact: { minHeight: 36, paddingHorizontal: 14 },
});
