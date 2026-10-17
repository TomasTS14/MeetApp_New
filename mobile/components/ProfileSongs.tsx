import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { SpotifyPlayer } from '@/components/SpotifyPlayer';
import { Text, View } from '@/components/Themed';
import { Button, Muted, TextField, useColors } from '@/components/ui';
import { MAX_SONGS, SongError, useAddSong, useRemoveSong, useSongs } from '@/lib/songs';

// A person's favourite songs. Tapping one opens Spotify's player under it. On your own
// profile you can paste a Spotify link to add a song and remove songs.
export function ProfileSongs({ profileId, editable = false }: { profileId: string; editable?: boolean }) {
  const { t } = useTranslation();
  const colors = useColors();
  const songs = useSongs(profileId);
  const addSong = useAddSong();
  const removeSong = useRemoveSong();
  const [link, setLink] = useState('');
  const [playing, setPlaying] = useState<string | null>(null);

  const list = songs.data ?? [];
  if (!editable && list.length === 0) return null;

  const add = () =>
    addSong.mutate(link, {
      onSuccess: (song) => {
        setLink('');
        setPlaying(song.spotify_url);
      },
    });
  const addError = addSong.error instanceof SongError ? addSong.error.code : addSong.error ? 'other' : null;

  return (
    <View style={styles.section}>
      <View style={styles.headingRow}>
        <Text style={styles.heading}>{t('songs.title')}</Text>
        {editable && <Muted>{t('songs.count', { count: list.length, max: MAX_SONGS })}</Muted>}
      </View>

      {list.map((song) => {
        const open = playing === song.spotify_url;
        const title = song.title ?? t('songs.untitled');
        return (
          <View key={song.spotify_url} style={styles.song}>
            <View style={styles.row}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={open ? t('songs.hidePlayer', { title }) : t('songs.play', { title })}
                onPress={() => setPlaying(open ? null : song.spotify_url)}
                style={styles.track}
              >
                {song.artwork_url ? (
                  <Image source={{ uri: song.artwork_url }} style={styles.artwork} accessibilityIgnoresInvertColors />
                ) : (
                  <View style={[styles.artwork, { backgroundColor: colors.border }]} />
                )}
                <View style={styles.names}>
                  <Text style={styles.songTitle} numberOfLines={1}>
                    {title}
                  </Text>
                  {song.artist ? <Muted>{song.artist}</Muted> : null}
                </View>
                <Text style={[styles.toggle, { color: colors.accent }]}>{open ? '▲' : '▶'}</Text>
              </Pressable>
              {editable && (
                <Button
                  label={t('songs.remove')}
                  variant="secondary"
                  onPress={() => {
                    if (open) setPlaying(null);
                    removeSong.mutate(song.position);
                  }}
                  disabled={removeSong.isPending}
                  style={styles.compact}
                />
              )}
            </View>
            {open && <SpotifyPlayer spotifyUrl={song.spotify_url} title={title} />}
          </View>
        );
      })}

      {editable && list.length === 0 && <Muted>{t('songs.empty')}</Muted>}
      {editable && list.length < MAX_SONGS && (
        <View style={styles.add}>
          <TextField
            label={t('songs.addLabel')}
            hint={t('songs.addHint')}
            placeholder="https://open.spotify.com/track/…"
            value={link}
            onChangeText={(value) => {
              setLink(value);
              addSong.reset();
            }}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            onSubmitEditing={add}
            error={addError ? t(`songs.errors.${addError}`) : null}
          />
          <Button label={t('songs.add')} onPress={add} loading={addSong.isPending} disabled={!link.trim()} />
        </View>
      )}
      {removeSong.isError && <Text style={{ color: colors.danger }}>{t('common.error')}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  headingRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  heading: { fontSize: 18, fontWeight: '700' },
  song: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  track: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  artwork: { width: 48, height: 48, borderRadius: 6 },
  names: { flex: 1 },
  songTitle: { fontSize: 16, fontWeight: '600' },
  toggle: { fontSize: 16, paddingHorizontal: 8 },
  compact: { minHeight: 36, paddingHorizontal: 14 },
  add: { gap: 8 },
});
