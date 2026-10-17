import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FunctionsHttpError } from '@supabase/supabase-js';

import { useAuth } from '@/lib/auth';
import type { Tables } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

export const MAX_SONGS = 10;

export type Song = Pick<Tables<'profile_songs'>, 'position' | 'spotify_url' | 'title' | 'artist' | 'artwork_url'>;

// Error codes the spotify-song function returns, each with its own message in the app.
export type AddSongError = 'not_a_track' | 'song_not_found' | 'already_added' | 'too_many_songs' | 'other';

const songsKey = (profileId: string | undefined) => ['songs', profileId];

export function useSongs(profileId: string | undefined) {
  return useQuery({
    queryKey: songsKey(profileId),
    enabled: !!profileId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profile_songs')
        .select('position, spotify_url, title, artist, artwork_url')
        .eq('profile_id', profileId!)
        .order('position');
      if (error) throw error;
      return data;
    },
  });
}

export class SongError extends Error {
  constructor(public code: AddSongError) {
    super(code);
  }
}

const knownErrors: AddSongError[] = ['not_a_track', 'song_not_found', 'already_added', 'too_many_songs'];

// The edge function looks the link up on Spotify and stores it in the first free slot.
export function useAddSong() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (url: string) => {
      const { data, error } = await supabase.functions.invoke<Song>('spotify-song', { body: { url } });
      if (error) {
        const body = error instanceof FunctionsHttpError ? await error.context.json().catch(() => null) : null;
        const code = knownErrors.find((known) => known === body?.error) ?? 'other';
        throw new SongError(code);
      }
      return data!;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: songsKey(session?.user.id) }),
  });
}

export function useRemoveSong() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const me = session?.user.id;
  return useMutation({
    mutationFn: async (position: number) => {
      const { error } = await supabase.from('profile_songs').delete().eq('profile_id', me!).eq('position', position);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: songsKey(me) }),
  });
}

export function spotifyEmbedUrl(spotifyUrl: string) {
  return spotifyUrl.replace('https://open.spotify.com/track/', 'https://open.spotify.com/embed/track/');
}
