// Stands in for Spotify's oEmbed endpoint so song tests don't depend on Spotify.
import { createServer } from 'node:http';

const titles = {
  '4cOdK2wGLETKBW3PvgPWqT': 'Never Gonna Give You Up',
  '0VjIjW4GlUZAMYd2vXMi3b': 'Blinding Lights',
  '3n3Ppam7vgaVa1iaRUc9Lp': 'Mr. Brightside',
};

createServer((req, res) => {
  const url = new URL(req.url, 'http://x').searchParams.get('url') ?? '';
  const id = url.match(/track\/([A-Za-z0-9]{22})/)?.[1];
  if (!id || !titles[id]) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({
    title: titles[id],
    thumbnail_url: 'https://i.scdn.co/image/ab67616d00001e02' + id,
    provider_name: 'Spotify',
  }));
}).listen(8787, '0.0.0.0');
