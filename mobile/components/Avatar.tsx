import { Image } from 'expo-image';
import { StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';
import { useColors } from '@/components/ui';
import { avatarUrl } from '@/lib/supabase';

type Props = { path: string | null; name: string; size?: number };

// A person's photo, or the first letter of their name on the accent colour.
export function Avatar({ path, name, size = 40 }: Props) {
  const colors = useColors();
  const round = { width: size, height: size, borderRadius: size / 2 };
  if (path) {
    return <Image source={{ uri: avatarUrl(path) }} style={round} contentFit="cover" accessibilityIgnoresInvertColors />;
  }
  return (
    <View style={[round, styles.initial, { backgroundColor: colors.accent }]}>
      <Text style={[styles.letter, { color: colors.onAccent, fontSize: size * 0.45 }]}>
        {name.slice(0, 1).toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  initial: { alignItems: 'center', justifyContent: 'center' },
  letter: { fontWeight: '700' },
});
