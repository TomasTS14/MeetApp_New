import { StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

import { spotifyEmbedUrl } from '@/lib/songs';

// Spotify's own embedded player. Without a Spotify login it plays a 30 second preview.
export function SpotifyPlayer({ spotifyUrl, title }: { spotifyUrl: string; title: string }) {
  return (
    <WebView
      accessibilityLabel={title}
      source={{ uri: spotifyEmbedUrl(spotifyUrl) }}
      style={styles.player}
      allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction={false}
      scrollEnabled={false}
    />
  );
}

const styles = StyleSheet.create({
  player: { height: 152, borderRadius: 12, backgroundColor: 'transparent' },
});
