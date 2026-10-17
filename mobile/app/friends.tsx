import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { FriendButton } from '@/components/FriendButton';
import { PersonRow } from '@/components/PersonRow';
import { Text, View } from '@/components/Themed';
import { Button, Loading, Muted, TextField, useColors } from '@/components/ui';
import { useAnswerFriendRequest, useFriends, useSearchPeople } from '@/lib/social';

export default function FriendsScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const [query, setQuery] = useState('');
  const friends = useFriends();
  const search = useSearchPeople(query);
  const answer = useAnswerFriendRequest();

  const searching = query.trim().length >= 2;

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.page}>
      <TextField
        label={t('friends.search')}
        placeholder={t('friends.searchPlaceholder')}
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
        autoCorrect={false}
      />

      {searching ? (
        <View style={styles.section}>
          {search.isPending && <Loading />}
          {search.data?.length === 0 && <Muted>{t('friends.noResults')}</Muted>}
          {search.data?.map((person) => (
            <PersonRow key={person.id} person={person} actions={<FriendButton personId={person.id} compact />} />
          ))}
        </View>
      ) : friends.isPending ? (
        <Loading />
      ) : (
        <>
          {!!friends.data?.incoming.length && (
            <View style={styles.section}>
              <Text style={styles.heading}>{t('friends.incoming')}</Text>
              {friends.data.incoming.map((person) => (
                <PersonRow
                  key={person.id}
                  person={person}
                  actions={
                    <>
                      <Button
                        label={t('friends.accept')}
                        onPress={() => answer.mutate({ personId: person.id, accept: true })}
                        style={styles.compact}
                      />
                      <Button
                        label={t('friends.decline')}
                        variant="secondary"
                        onPress={() => answer.mutate({ personId: person.id, accept: false })}
                        style={styles.compact}
                      />
                    </>
                  }
                />
              ))}
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.heading}>{t('friends.yourFriends')}</Text>
            {friends.data?.friends.length === 0 && <Muted>{t('friends.none')}</Muted>}
            {friends.data?.friends.map((person) => <PersonRow key={person.id} person={person} />)}
          </View>

          {!!friends.data?.outgoing.length && (
            <View style={styles.section}>
              <Text style={styles.heading}>{t('friends.outgoing')}</Text>
              {friends.data.outgoing.map((person) => (
                <PersonRow key={person.id} person={person} actions={<FriendButton personId={person.id} compact />} />
              ))}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 24, width: '100%', maxWidth: 720, alignSelf: 'center' },
  section: { gap: 4 },
  heading: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  compact: { minHeight: 36, paddingHorizontal: 14 },
});
