import { Link } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Avatar } from '@/components/Avatar';
import { Text, View } from '@/components/Themed';
import { useColors } from '@/components/ui';
import type { Person } from '@/lib/social';

// One person in a list, opening their profile, with optional buttons on the right.
export function PersonRow({ person, actions }: { person: Person; actions?: ReactNode }) {
  const { t } = useTranslation();
  const colors = useColors();
  return (
    <View style={styles.row}>
      <Link href={{ pathname: '/user/[username]', params: { username: person.username } }} asChild>
        <Pressable accessibilityRole="link" style={styles.person}>
          <Avatar path={person.avatar_path} name={person.username} />
          <View style={styles.names}>
            <Text style={styles.username}>@{person.username}</Text>
            {person.id_verified_at && (
              <Text style={[styles.verified, { color: colors.accent }]}>✓ {t('event.verified')}</Text>
            )}
          </View>
        </Pressable>
      </Link>
      {actions ? <View style={styles.actions}>{actions}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  person: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  names: { flexShrink: 1 },
  username: { fontSize: 16, fontWeight: '600' },
  verified: { fontSize: 13, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 8 },
});
