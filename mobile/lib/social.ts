import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { profileQueryKey, useAuth } from '@/lib/auth';
import type { Tables } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

export type Person = Pick<Tables<'profiles'>, 'id' | 'username' | 'bio' | 'avatar_path' | 'id_verified_at'>;
export type Relationship = 'self' | 'friend' | 'incoming' | 'outgoing' | 'blocked' | 'none';

const PERSON_COLUMNS = 'id, username, bio, avatar_path, id_verified_at';

async function peopleById(ids: string[]): Promise<Map<string, Person>> {
  if (ids.length === 0) return new Map();
  const { data, error } = await supabase.from('profiles').select(PERSON_COLUMNS).in('id', ids);
  if (error) throw error;
  return new Map(data.map((p) => [p.id, p]));
}

// Friends, plus requests waiting on me and requests I sent. A declined request keeps
// showing as sent to the person who asked, so they are not told it was declined.
export function useFriends() {
  const { session } = useAuth();
  const me = session?.user.id;
  return useQuery({
    queryKey: ['friends', me],
    enabled: !!me,
    queryFn: async () => {
      const { data, error } = await supabase.from('friendships').select('requester_id, addressee_id, status');
      if (error) throw error;
      const other = (row: (typeof data)[number]) => (row.requester_id === me ? row.addressee_id : row.requester_id);
      const people = await peopleById(data.map(other));
      const pick = (rows: typeof data) => rows.map((row) => people.get(other(row))).filter((p): p is Person => !!p);
      return {
        friends: pick(data.filter((r) => r.status === 'accepted')),
        incoming: pick(data.filter((r) => r.status === 'pending' && r.addressee_id === me)),
        outgoing: pick(data.filter((r) => r.status !== 'accepted' && r.requester_id === me)),
      };
    },
  });
}

export function useBlocks() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['blocks', session?.user.id],
    enabled: !!session,
    queryFn: async () => {
      const { data, error } = await supabase.from('blocks').select('blocked_id');
      if (error) throw error;
      const people = await peopleById(data.map((row) => row.blocked_id));
      return [...people.values()];
    },
  });
}

export function useRelationship(personId: string | undefined): Relationship | null {
  const { session } = useAuth();
  const friends = useFriends();
  const blocks = useBlocks();
  if (!personId || !friends.data || !blocks.data) return null;
  const has = (list: Person[]) => list.some((p) => p.id === personId);
  if (personId === session?.user.id) return 'self';
  if (has(blocks.data)) return 'blocked';
  if (has(friends.data.friends)) return 'friend';
  if (has(friends.data.incoming)) return 'incoming';
  if (has(friends.data.outgoing)) return 'outgoing';
  return 'none';
}

export function usePerson(username: string) {
  return useQuery({
    queryKey: ['person', username],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select(PERSON_COLUMNS).eq('username', username).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

// Usernames containing the text, leaving out the caller and people they blocked.
export function useSearchPeople(query: string) {
  const { session } = useAuth();
  const blocks = useBlocks();
  const text = query.trim().toLowerCase().replace(/[^a-z0-9_.]/g, '');
  return useQuery({
    queryKey: ['people-search', text],
    enabled: text.length >= 2 && !!blocks.data,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select(PERSON_COLUMNS)
        .ilike('username', `%${text}%`)
        .neq('id', session!.user.id)
        .order('username')
        .limit(20);
      if (error) throw error;
      const blocked = new Set(blocks.data!.map((p) => p.id));
      return data.filter((p) => !blocked.has(p.id));
    },
  });
}

function useSocialMutation<T>(run: (me: string, arg: T) => Promise<{ error: unknown }>) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (arg: T) => {
      const { error } = await run(session!.user.id, arg);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friends'] });
      queryClient.invalidateQueries({ queryKey: ['blocks'] });
      queryClient.invalidateQueries({ queryKey: ['for-you'] });
      // Comments and organizer names switch between alias and username with friendship.
      queryClient.invalidateQueries({ queryKey: ['comments'] });
      queryClient.invalidateQueries({ queryKey: ['event'] });
    },
  });
}

export const useSendFriendRequest = () =>
  useSocialMutation(async (_me, personId: string) => supabase.from('friendships').insert({ addressee_id: personId }));

export const useAnswerFriendRequest = () =>
  useSocialMutation(async (me, { personId, accept }: { personId: string; accept: boolean }) =>
    supabase
      .from('friendships')
      .update({ status: accept ? 'accepted' : 'declined' })
      .eq('requester_id', personId)
      .eq('addressee_id', me)
  );

// Unfriending, and withdrawing a request I sent.
export const useRemoveFriend = () =>
  useSocialMutation(async (me, personId: string) =>
    supabase
      .from('friendships')
      .delete()
      .or(`and(requester_id.eq.${me},addressee_id.eq.${personId}),and(requester_id.eq.${personId},addressee_id.eq.${me})`)
  );

// Blocking also ends any friendship (a database trigger does that).
export const useBlock = () =>
  useSocialMutation(async (_me, personId: string) => supabase.from('blocks').insert({ blocked_id: personId }));

export const useUnblock = () =>
  useSocialMutation(async (_me, personId: string) => supabase.from('blocks').delete().eq('blocked_id', personId));

export function useForYouFeed() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['for-you', session?.user.id],
    enabled: !!session,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('for_you_feed', { p_limit: 50 });
      if (error) throw error;
      return data;
    },
  });
}

// The avatar lives at "<user id>/avatar-<time>.<ext>"; the old file is removed afterwards.
export function useUploadAvatar() {
  const { session, profile } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (photo: { uri: string; mimeType: string }) => {
      const me = session!.user.id;
      const body = await (await fetch(photo.uri)).arrayBuffer();
      const path = `${me}/avatar-${Date.now()}.${photo.mimeType.split('/')[1] ?? 'jpg'}`;
      const upload = await supabase.storage.from('avatars').upload(path, body, { contentType: photo.mimeType });
      if (upload.error) throw upload.error;
      const { error } = await supabase.from('profiles').update({ avatar_path: path }).eq('id', me);
      if (error) throw error;
      if (profile?.avatar_path) await supabase.storage.from('avatars').remove([profile.avatar_path]);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: profileQueryKey(session?.user.id) }),
  });
}
