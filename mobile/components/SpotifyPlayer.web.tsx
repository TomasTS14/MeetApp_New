import { spotifyEmbedUrl } from '@/lib/songs';

// Spotify's own embedded player. Without a Spotify login it plays a 30 second preview.
export function SpotifyPlayer({ spotifyUrl, title }: { spotifyUrl: string; title: string }) {
  return (
    <iframe
      title={title}
      src={spotifyEmbedUrl(spotifyUrl)}
      style={{ width: '100%', height: 152, border: 0, borderRadius: 12 }}
      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
      loading="lazy"
    />
  );
}
